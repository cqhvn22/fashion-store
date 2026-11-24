$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$composeFile = Join-Path $repoRoot 'infrastructure/docker/compose.yaml'
$envFile = Join-Path $repoRoot '.env'
$productId = [guid]::NewGuid().ToString()
$variantId = [guid]::NewGuid().ToString()
$slug = "rag-check-$($productId.Substring(0, 8))"

function Sql([string]$Db, [string]$Command) {
    $result = & docker compose --env-file $envFile -f $composeFile -p fashion-codex exec -T postgres `
        psql -U fashion -d $Db -v ON_ERROR_STOP=1 -tAc $Command
    if ($LASTEXITCODE -ne 0) { throw "SQL failed in $Db" }
    return ($result | Out-String).Trim()
}

function Sync-Index {
    & docker exec fashion-codex-ai-service-1 python -c `
        'from app.services.products import sync_all; sync_all()'
    if ($LASTEXITCODE -ne 0) { throw 'AI sync failed' }
}

try {
    Sql 'fashion_catalog' "INSERT INTO products(id,category_id,slug,name,description,brand,status) VALUES ('$productId',(SELECT id FROM categories WHERE parent_id IS NULL AND is_active ORDER BY id LIMIT 1),'$slug','Áo kiểm tra RAG','Chất liệu cotton thử nghiệm','FashionHub','ACTIVE')" | Out-Null
    Sql 'fashion_catalog' "INSERT INTO product_variants(id,product_id,sku,color,size,price,stock_quantity) VALUES ('$variantId','$productId','RAG-$productId','Đen','M',99000,5)" | Out-Null
    Sync-Index
    $added = Sql 'fashion_ai' "SELECT count(*) FROM product_documents WHERE source='catalog' AND source_id='$productId'"
    if ($added -ne '1') { throw "Added product was not indexed: $added" }
    Sql 'fashion_catalog' "UPDATE products SET status='INACTIVE',updated_at=now() WHERE id='$productId'" | Out-Null
    Sync-Index
    $removed = Sql 'fashion_ai' "SELECT count(*) FROM product_documents WHERE source='catalog' AND source_id='$productId'"
    if ($removed -ne '0') { throw "Inactive product remained in index: $removed" }
    Write-Output 'PASS: added product indexed; inactive product removed'
} finally {
    Sql 'fashion_catalog' "DELETE FROM products WHERE id='$productId'" | Out-Null
    Sync-Index
}
