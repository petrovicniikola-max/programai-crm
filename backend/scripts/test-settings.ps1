# Settings API – PowerShell test (run with backend on http://localhost:3000)
# Usage: .\scripts\test-settings.ps1
# Ensure: npm run start:dev and SEED_ADMIN_PASSWORD=Admin123! (or set below)

$BaseUrl = $env:API_URL ?? 'http://localhost:3000'
$AdminPass = $env:SEED_ADMIN_PASSWORD ?? 'Admin123!'

Write-Host "1. Login as SUPER_ADMIN (admin@demo.local)..." -ForegroundColor Cyan
$loginBody = @{ email = 'admin@demo.local'; password = $AdminPass } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $loginBody -ContentType 'application/json'
$token = $login.accessToken
$headers = @{ Authorization = "Bearer $token" }
Write-Host "   OK. Token received." -ForegroundColor Green

Write-Host "`n2. GET /settings/branding" -ForegroundColor Cyan
$branding = Invoke-RestMethod -Uri "$BaseUrl/settings/branding" -Headers $headers
$branding | ConvertTo-Json

Write-Host "`n3. POST /settings/users (create SUPPORT user)" -ForegroundColor Cyan
$newUser = @{
  email        = 'support@demo.local'
  displayName  = 'Support User'
  password     = 'Support123!'
  role         = 'SUPPORT'
} | ConvertTo-Json
$created = Invoke-RestMethod -Uri "$BaseUrl/settings/users" -Method Post -Headers $headers -Body $newUser -ContentType 'application/json'
$userId = $created.id
Write-Host "   Created user id: $userId" -ForegroundColor Green

Write-Host "`n4. POST /settings/users/:id/reset-password" -ForegroundColor Cyan
$resetBody = @{ password = 'NewPass456!' } | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/settings/users/$userId/reset-password" -Method Post -Headers $headers -Body $resetBody -ContentType 'application/json'
Write-Host "   Password reset OK." -ForegroundColor Green

Write-Host "`n5. GET /settings/export/tickets.csv" -ForegroundColor Cyan
$csv = Invoke-WebRequest -Uri "$BaseUrl/settings/export/tickets.csv" -Headers $headers -UseBasicParsing
Write-Host "   CSV length: $($csv.Content.Length) bytes; first line: $($csv.Content.Split("`n")[0])" -ForegroundColor Green

Write-Host "`n6. GET /settings/audit?limit=50" -ForegroundColor Cyan
$audit = Invoke-RestMethod -Uri "$BaseUrl/settings/audit?limit=50" -Headers $headers
Write-Host "   Audit entries: $($audit.Count)" -ForegroundColor Green
$audit | ConvertTo-Json -Depth 5

Write-Host "`nDone." -ForegroundColor Green
