param([string]$BaseUrl = 'http://localhost:8080/api/v1')
$ErrorActionPreference = 'Stop'
$composeDir = Join-Path $PSScriptRoot '..\..\infrastructure\docker'
$composeArgs = @('compose', '-p', 'fashion-codex', '--env-file', '../../.env', '-f', 'compose.yaml')
$suffix = [guid]::NewGuid().ToString('N')
$userId = $null
$otherUserId = $null
$orderId = [guid]::NewGuid().ToString()
$itemId = [guid]::NewGuid().ToString()
$productId = $null

function Invoke-TestSql([string]$Database, [string]$Statement) {
  Push-Location $composeDir
  try {
    & docker @composeArgs exec -T postgres psql -U fashion -d $Database -v ON_ERROR_STOP=1 -q -c $Statement | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "SQL failed in $Database" }
  } finally { Pop-Location }
}

try {
  $email = "review-check-$suffix@example.test"
  $password = 'ReviewCheck@2026!'
  $registered = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/register" -ContentType 'application/json' `
    -Body (@{ fullName = 'Review Check'; email = $email; phone = '0900000000'; password = $password } | ConvertTo-Json)
  $userId = $registered.data.id
  $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' `
    -Body (@{ email = $email; password = $password } | ConvertTo-Json)
  $headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
  $otherEmail = "review-other-$suffix@example.test"
  $other = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/register" -ContentType 'application/json' `
    -Body (@{ fullName = 'Other Customer'; email = $otherEmail; phone = '0900000001'; password = $password } | ConvertTo-Json)
  $otherUserId = $other.data.id
  $otherLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' `
    -Body (@{ email = $otherEmail; password = $password } | ConvertTo-Json)
  $otherHeaders = @{ Authorization = "Bearer $($otherLogin.data.accessToken)" }
  $products = Invoke-RestMethod -Uri "$BaseUrl/products?limit=1"
  $product = $products.data.content[0]
  $productId = $product.id
  $variantId = $product.variants[0].id
  if (-not $variantId) {
    $detail = Invoke-RestMethod -Uri "$BaseUrl/products/$productId"
    $variantId = $detail.data.variants[0].id
  }
  if (-not $variantId) { throw 'No product variant available for review test' }
  $checkoutId = [guid]::NewGuid().ToString()
  $historyId = [guid]::NewGuid().ToString()
  $orderCode = "TEST-$($suffix.Substring(0, 16))"
  Invoke-TestSql 'fashion_order' "INSERT INTO orders(id,order_code,user_id,checkout_id,idempotency_key,status,payment_method,payment_status,shipping_address,subtotal,shipping_fee,discount_amount,total_amount) VALUES ('$orderId','$orderCode','$userId','$checkoutId','$suffix','PENDING','COD','UNPAID',jsonb_build_object('recipientName','Review Check'),100000,0,0,100000)"
  Invoke-TestSql 'fashion_order' "INSERT INTO order_items(id,order_id,product_id,variant_id,product_name,sku,size,color,unit_price,quantity,line_total) VALUES ('$itemId','$orderId','$productId','$variantId','Review test','TEST-SKU','M','Đen',100000,1,100000)"
  $beforeDelivery = Invoke-RestMethod -Uri "$BaseUrl/reviews/eligibility/$itemId" -Headers $headers
  if ($beforeDelivery.data.eligible) { throw 'Pending order was incorrectly eligible' }
  try {
    Invoke-RestMethod -Uri "$BaseUrl/reviews/eligibility/$itemId" -Headers $otherHeaders | Out-Null
    throw 'Another user could access the order item'
  } catch {
    if ($_.Exception.Response.StatusCode -ne 404) { throw }
  }
  $draft = @{ orderItemId = $itemId; rating = 5; content = 'Sản phẩm vừa vặn và chất liệu rất tốt.'; imageUrls = @() } | ConvertTo-Json
  try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/reviews" -Headers $headers -ContentType 'application/json' -Body $draft | Out-Null
    throw 'Pending order review was accepted'
  } catch {
    if ($_.Exception.Response.StatusCode -ne 409) { throw }
  }
  Invoke-TestSql 'fashion_order' "UPDATE orders SET status='DELIVERED',updated_at=now() WHERE id='$orderId'"
  Invoke-TestSql 'fashion_order' "INSERT INTO order_status_history(id,order_id,status,actor_role) VALUES ('$historyId','$orderId','DELIVERED','SYSTEM')"

  $eligibility = Invoke-RestMethod -Uri "$BaseUrl/reviews/eligibility/$itemId" -Headers $headers
  if (-not $eligibility.data.eligible) { throw 'Delivered order is not eligible for review' }
  $created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/reviews" -Headers $headers -ContentType 'application/json' -Body $draft
  if ($created.data.rating -ne 5) { throw 'Review creation failed' }
  $public = Invoke-RestMethod -Uri "$BaseUrl/reviews/product/$productId"
  if (-not ($public.data.content | Where-Object id -eq $created.data.id)) { throw 'Public review is missing' }
  $edited = Invoke-RestMethod -Method Put -Uri "$BaseUrl/reviews/$($created.data.id)" -Headers $headers -ContentType 'application/json' `
    -Body (@{ rating = 4; content = 'Đã sử dụng và thấy sản phẩm phù hợp.'; imageUrls = @() } | ConvertTo-Json)
  if ($edited.data.rating -ne 4 -or $edited.data.editCount -ne 1) { throw 'Review edit failed' }
  try {
    Invoke-RestMethod -Method Put -Uri "$BaseUrl/reviews/$($created.data.id)" -Headers $headers -ContentType 'application/json' `
      -Body (@{ rating = 3; content = 'Muốn sửa lần thứ hai nhưng phải bị chặn.'; imageUrls = @() } | ConvertTo-Json) | Out-Null
    throw 'Second edit was accepted unexpectedly'
  } catch {
    if ($_.Exception.Response.StatusCode -ne 409) { throw }
  }
  Write-Output 'PASS: ownership, delivery, create, public list, one edit'
} finally {
  if ($productId) {
    Invoke-TestSql 'fashion_catalog' "DELETE FROM product_reviews WHERE order_item_id='$itemId'; UPDATE products SET rating_average=COALESCE((SELECT round(avg(rating)::numeric,2) FROM product_reviews WHERE product_id='$productId' AND status='VISIBLE'),0),review_count=(SELECT count(*) FROM product_reviews WHERE product_id='$productId' AND status='VISIBLE') WHERE id='$productId'"
  }
  Invoke-TestSql 'fashion_order' "DELETE FROM orders WHERE id='$orderId'"
  if ($otherUserId) { Invoke-TestSql 'fashion_auth' "DELETE FROM users WHERE id='$otherUserId'" }
  if ($userId) { Invoke-TestSql 'fashion_auth' "DELETE FROM users WHERE id='$userId'" }
}
