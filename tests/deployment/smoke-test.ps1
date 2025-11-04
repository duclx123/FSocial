param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = 'dev'
)

Write-Host "Starting smoke tests for environment: $Environment"

# Default target - local development URL
$defaultUrl = 'http://localhost:8080/health'

try {
    $url = $env:SMOKE_TEST_URL
    if ([string]::IsNullOrEmpty($url)) { $url = $defaultUrl }

    Write-Host "Checking health endpoint: $url"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "Smoke test passed: HTTP $($response.StatusCode)"
        exit 0
    } else {
        Write-Host "Smoke test failed: HTTP $($response.StatusCode)"
        exit 1
    }
} catch {
    Write-Host "Smoke test error: $($_.Exception.Message)"
    exit 1
}
