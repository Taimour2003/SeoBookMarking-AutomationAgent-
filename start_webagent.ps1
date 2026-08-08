$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$profilePath = Join-Path $projectRoot "data\chrome_profile"
$cdpPort = 9222

$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

if (-not $chrome) {
    Write-Error "Google Chrome was not found."
    exit 1
}

New-Item -ItemType Directory -Force -Path $profilePath | Out-Null

$debugEndpoint = "http://127.0.0.1:$cdpPort/json/version"
$chromeAlreadyReady = $false

try {
    $response = Invoke-WebRequest -Uri $debugEndpoint -UseBasicParsing -TimeoutSec 1
    $chromeAlreadyReady = $response.StatusCode -eq 200
}
catch {
    $chromeAlreadyReady = $false
}

if (-not $chromeAlreadyReady) {
    Write-Host "Starting dedicated WebAgent Chrome..."

    Start-Process `
        -FilePath $chrome `
        -ArgumentList @(
            "--remote-debugging-port=$cdpPort",
            "--user-data-dir=$profilePath",
            "--start-maximized"
        )

    Write-Host "Waiting for Chrome debugging port..."

    $maxAttempts = 40
    $chromeReady = $false

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest `
                -Uri $debugEndpoint `
                -UseBasicParsing `
                -TimeoutSec 1

            if ($response.StatusCode -eq 200) {
                $chromeReady = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $chromeReady) {
        Write-Error "Chrome started, but CDP port $cdpPort did not become ready."
        exit 1
    }
}
else {
    Write-Host "WebAgent Chrome is already running."
}

Set-Location $projectRoot

$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

Write-Host "Starting WebAgent..."

if (Test-Path $venvPython) {
    & $venvPython "src\main.py"
}
else {
    python "src\main.py"
}