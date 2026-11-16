param(
    [string]$ModelsPath = 'D:\Fashion-OllamaModels',
    [int]$Port = 11435
)

$ErrorActionPreference = 'Stop'
$ollama = (Get-Command ollama -ErrorAction Stop).Source
$resolved = [IO.Path]::GetFullPath($ModelsPath)
New-Item -ItemType Directory -Path $resolved -Force | Out-Null
$env:OLLAMA_MODELS = $resolved
$env:OLLAMA_HOST = "127.0.0.1:$Port"
$endpoint = "http://127.0.0.1:$Port"

try {
    $null = Invoke-RestMethod -Uri "$endpoint/api/tags" -TimeoutSec 2
} catch {
    Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $null = Invoke-RestMethod -Uri "$endpoint/api/tags" -TimeoutSec 2
            $ready = $true
            break
        } catch { }
    }
    if (-not $ready) { throw "Ollama could not start at $endpoint" }
}

$installed = @((Invoke-RestMethod -Uri "$endpoint/api/tags").models | ForEach-Object name)
foreach ($model in @('qwen3-embedding:0.6b')) {
    if ($model -notin $installed) {
        & $ollama pull $model
        if ($LASTEXITCODE -ne 0) { throw "Could not pull $model" }
    }
}
Write-Output "Ollama RAG ready at $endpoint; models at $resolved"
