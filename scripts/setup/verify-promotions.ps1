$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$settings = @{}
Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
    $pair = $_ -split '=', 2
    $settings[$pair[0]] = $pair[1]
}
if (-not $settings.ADMIN_EMAIL -or -not $settings.ADMIN_PASSWORD) {
    throw 'Cần ADMIN_EMAIL và ADMIN_PASSWORD trong .env để chạy kiểm tra.'
}
$base = 'http://localhost:8080/api/v1'
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' `
    -Body (@{ email = $settings.ADMIN_EMAIL; password = $settings.ADMIN_PASSWORD } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
$category = (Invoke-RestMethod -Uri "$base/categories").data | Select-Object -First 1
$slug = 'verify-promotion-' + (Get-Date -Format 'yyyyMMddHHmmss')
$productId = $null
try {
    $firstImage = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab'
    $secondImage = 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246'
    $product = @{
        name = 'Kiểm tra giá và ảnh biến thể'; slug = $slug; description = 'Dữ liệu kiểm tra tạm thời'
        categoryId = $category.id; brand = 'Verification'; status = 'ACTIVE'
        images = @(@{ url = $firstImage; alt = 'Ảnh chung'; isPrimary = $true })
        variants = @(
            @{ sku = "$slug-a"; color = 'Đen'; size = 'M'; price = 200000; stockQuantity = 3
               images = @(@{ url = $firstImage; alt = 'Đen trước'; isPrimary = $true },
                          @{ url = $secondImage; alt = 'Đen sau'; isPrimary = $false }) },
            @{ sku = "$slug-b"; color = 'Trắng'; size = 'M'; price = 250000; stockQuantity = 3
               images = @(@{ url = $secondImage; alt = 'Trắng'; isPrimary = $true }) }
        )
    }
    $created = Invoke-RestMethod -Uri "$base/admin/products" -Method Post -Headers $headers `
        -ContentType 'application/json' -Body ($product | ConvertTo-Json -Depth 10)
    $productId = $created.data.id
    if ($created.data.variants.Count -ne 2 -or ($created.data.variants | Where-Object { $_.images.Count -eq 2 }).Count -ne 1) {
        throw 'Ảnh riêng cho biến thể chưa được lưu đúng.'
    }
    for ($index = 0; $index -lt $product.variants.Count; $index++) {
        $product.variants[$index].id = $created.data.variants[$index].id
    }
    $product.variants[0].images = @(@{ url = $secondImage; alt = 'Ảnh đen mới'; isPrimary = $true })
    Invoke-RestMethod -Uri "$base/admin/products/$productId" -Method Put -Headers $headers `
        -ContentType 'application/json' -Body ($product | ConvertTo-Json -Depth 10) | Out-Null
    $edited = (Invoke-RestMethod -Uri "$base/products/slug/$slug").data
    if ($edited.variants[0].images.Count -ne 1 -or $edited.variants[0].images[0].url -ne $secondImage) {
        throw 'Sửa ảnh riêng của biến thể chưa lưu đúng.'
    }
    $now = [DateTimeOffset]::UtcNow
    $promotion = @{
        productId = $productId; name = 'Kiểm tra giảm 10%'; discountType = 'PERCENT'
        discountValue = 10; startsAt = $now.AddMinutes(30).ToString('o')
        endsAt = $now.AddMinutes(90).ToString('o'); isEnabled = $true
    }
    $saved = Invoke-RestMethod -Uri "$base/admin/promotions" -Method Post -Headers $headers `
        -ContentType 'application/json' -Body ($promotion | ConvertTo-Json)
    $before = (Invoke-RestMethod -Uri "$base/products/slug/$slug").data
    if ($before.minPrice -ne 200000 -or $before.promotion) { throw 'Chương trình chưa bắt đầu nhưng giá đã giảm.' }
    $promotion.startsAt = $now.AddMinutes(-1).ToString('o')
    $updated = Invoke-RestMethod -Uri "$base/admin/promotions/$($saved.data.id)" -Method Put -Headers $headers `
        -ContentType 'application/json' -Body ($promotion | ConvertTo-Json)
    $active = (Invoke-RestMethod -Uri "$base/products/slug/$slug").data
    if ($active.minPrice -ne 180000 -or $active.originalPrice -ne 200000 -or -not $active.promotion) {
        throw 'Giá giảm đang áp dụng không đúng.'
    }
    try {
        Invoke-RestMethod -Uri "$base/admin/promotions" -Method Post -Headers $headers `
            -ContentType 'application/json' -Body ($promotion | ConvertTo-Json) | Out-Null
        throw 'Cho phép tạo hai chương trình trùng thời gian.'
    } catch {
        if ($_.Exception.Response.StatusCode -ne 409) { throw }
    }
    $promotion.isEnabled = $false
    Invoke-RestMethod -Uri "$base/admin/promotions/$($updated.data.id)" -Method Put -Headers $headers `
        -ContentType 'application/json' -Body ($promotion | ConvertTo-Json) | Out-Null
    $after = (Invoke-RestMethod -Uri "$base/products/slug/$slug").data
    if ($after.minPrice -ne 200000 -or $after.promotion) { throw 'Tắt chương trình chưa hoàn nguyên giá.' }
    Write-Output 'PASS: tạo/sửa ảnh biến thể, lịch giảm giá, giá hiệu lực, chống trùng lịch và tắt chương trình.'
} finally {
    if ($productId) {
        $dbUser = if ($settings.POSTGRES_USER) { $settings.POSTGRES_USER } else { 'fashion' }
        docker compose -p fashion-codex --env-file (Join-Path $root '.env') `
            -f (Join-Path $root 'infrastructure/docker/compose.yaml') exec -T postgres `
            psql -U $dbUser -d fashion_catalog -v ON_ERROR_STOP=1 `
            -c "DELETE FROM products WHERE id='$productId' AND slug='$slug';" | Out-Null
    }
}
