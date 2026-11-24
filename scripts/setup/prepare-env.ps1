param([string]$EnvFile = ".env")

$resolved = Join-Path (Get-Location) $EnvFile
$values = @{}
if (Test-Path $resolved) {
    foreach ($line in Get-Content $resolved) {
        if ($line -match '^([A-Z_]+)=(.*)$') {
            $values[$Matches[1]] = $Matches[2]
        }
    }
}
if (-not $values.ContainsKey("JWT_SECRET") -or
    $values["JWT_SECRET"].StartsWith("replace-with-")) {
    $values["JWT_SECRET"] = [Convert]::ToHexString(
        [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}
if (-not $values.ContainsKey("INTERNAL_API_KEY") -or
    $values["INTERNAL_API_KEY"].StartsWith("replace-with-")) {
    $values["INTERNAL_API_KEY"] = [Convert]::ToHexString(
        [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}
if ($values["JWT_SECRET"].Length -lt 32) {
    throw "JWT_SECRET must contain at least 32 characters"
}
$secretBytes = [Text.Encoding]::UTF8.GetBytes($values["JWT_SECRET"])
$key = [Convert]::ToBase64String($secretBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
$jwk = '{"kty":"oct","alg":"HS256","k":"' + $key + '"}'
$values["JWT_VERIFY_JWK"] = [Convert]::ToBase64String(
    [Text.Encoding]::UTF8.GetBytes($jwk)).TrimEnd("=").Replace("+", "-").Replace("/", "_")

$lines = foreach ($name in $values.Keys | Sort-Object) { "$name=$($values[$name])" }
[IO.File]::WriteAllLines($resolved, $lines, [Text.UTF8Encoding]::new($false))
Write-Output "Prepared local environment file: $resolved"
