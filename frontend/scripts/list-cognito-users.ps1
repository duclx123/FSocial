# Script to list all users in AWS Cognito User Pool
# Usage: .\list-cognito-users.ps1

$UserPoolId = "us-east-1_ra3KwfSmc"
$Region = "us-east-1"

Write-Host "Listing users in User Pool: $UserPoolId" -ForegroundColor Cyan
Write-Host ""

try {
    $result = aws cognito-idp list-users `
        --user-pool-id $UserPoolId `
        --region $Region `
        --output json | ConvertFrom-Json

    if ($result.Users.Count -eq 0) {
        Write-Host "No users found in the User Pool." -ForegroundColor Yellow
    }
    else {
        Write-Host "Found $($result.Users.Count) user(s):" -ForegroundColor Green
        Write-Host ""
        
        foreach ($user in $result.Users) {
            $email = ($user.Attributes | Where-Object { $_.Name -eq "email" }).Value
            $name = ($user.Attributes | Where-Object { $_.Name -eq "name" }).Value
            $status = $user.UserStatus
            $enabled = $user.Enabled
            
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
            Write-Host "Email:    $email" -ForegroundColor White
            Write-Host "Name:     $name" -ForegroundColor White
            Write-Host "Status:   $status" -ForegroundColor $(if ($status -eq "CONFIRMED") { "Green" } else { "Yellow" })
            Write-Host "Enabled:  $enabled" -ForegroundColor $(if ($enabled) { "Green" } else { "Red" })
            Write-Host "Username: $($user.Username)" -ForegroundColor Gray
            Write-Host ""
        }
    }
}
catch {
    Write-Host "✗ Error listing users: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. AWS CLI not installed - Install from: https://aws.amazon.com/cli/" -ForegroundColor Gray
    Write-Host "2. AWS credentials not configured - Run: aws configure" -ForegroundColor Gray
    Write-Host "3. Insufficient permissions - Need cognito-idp:ListUsers permission" -ForegroundColor Gray
}
