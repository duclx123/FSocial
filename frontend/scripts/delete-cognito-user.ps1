# Script to delete a user from AWS Cognito User Pool
# Usage: .\delete-cognito-user.ps1 -Email "user@example.com"

param(
    [Parameter(Mandatory=$true)]
    [string]$Email
)

$UserPoolId = "us-east-1_ra3KwfSmc"
$Region = "us-east-1"

Write-Host "Deleting user: $Email from User Pool: $UserPoolId" -ForegroundColor Yellow

try {
    # Delete the user
    aws cognito-idp admin-delete-user `
        --user-pool-id $UserPoolId `
        --username $Email `
        --region $Region

    Write-Host "✓ User $Email has been deleted successfully!" -ForegroundColor Green
    Write-Host "You can now register with this email again." -ForegroundColor Cyan
}
catch {
    Write-Host "✗ Error deleting user: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. AWS CLI not installed - Install from: https://aws.amazon.com/cli/" -ForegroundColor Gray
    Write-Host "2. AWS credentials not configured - Run: aws configure" -ForegroundColor Gray
    Write-Host "3. User doesn't exist in Cognito" -ForegroundColor Gray
    Write-Host "4. Insufficient permissions - Need cognito-idp:AdminDeleteUser permission" -ForegroundColor Gray
}
