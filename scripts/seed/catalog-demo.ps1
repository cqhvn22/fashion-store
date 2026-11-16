param([string]$ProjectName = 'fashion-codex')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$composeFile = Join-Path $repoRoot 'infrastructure/docker/compose.yaml'
$envFile = Join-Path $repoRoot '.env'
$seedFile = Join-Path $PSScriptRoot 'catalog-demo.sql'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Không tìm thấy .env tại $envFile"
}

Get-Content -LiteralPath $seedFile -Raw -Encoding utf8 |
    docker compose --env-file $envFile -f $composeFile -p $ProjectName exec -T postgres `
        sh -lc 'psql -U "$POSTGRES_USER" -d fashion_catalog -v ON_ERROR_STOP=1 -f -'

if ($LASTEXITCODE -ne 0) {
    throw "Nạp dữ liệu mẫu thất bại (exit code $LASTEXITCODE)."
}
