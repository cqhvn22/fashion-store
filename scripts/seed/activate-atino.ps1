param([string]$ProjectName = 'fashion-codex')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$composeFile = Join-Path $repoRoot 'infrastructure/docker/compose.yaml'
$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Không tìm thấy .env tại $envFile"
}

$containerId = (& docker compose --env-file $envFile -f $composeFile -p $ProjectName ps -q postgres).Trim()
if ($LASTEXITCODE -ne 0 -or -not $containerId) {
    throw 'PostgreSQL chưa chạy. Hãy khởi động Docker Compose trước.'
}

foreach ($fileName in @('atino-catalog.sql', 'activate-atino-catalog.sql')) {
    $source = Join-Path $PSScriptRoot $fileName
    & docker cp $source "${containerId}:/tmp/$fileName"
    if ($LASTEXITCODE -ne 0) { throw "Không chép được $fileName vào PostgreSQL." }
}

& docker compose --env-file $envFile -f $composeFile -p $ProjectName exec -T postgres `
    sh -lc 'psql -q -U "$POSTGRES_USER" -d fashion_catalog -f /tmp/activate-atino-catalog.sql'
if ($LASTEXITCODE -ne 0) { throw 'Nạp dữ liệu ATINO thất bại.' }
