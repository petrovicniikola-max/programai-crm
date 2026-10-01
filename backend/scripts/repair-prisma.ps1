# Repairs a broken Prisma CLI install on Windows (missing build/index.js).
# Run from: C:\Course\programai-crm\backend
#   powershell -ExecutionPolicy Bypass -File .\scripts\repair-prisma.ps1

$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
$PrismaDir = Join-Path $BackendRoot "node_modules\prisma"
$IndexJs = Join-Path $PrismaDir "build\index.js"

Write-Host "Backend: $BackendRoot"
Write-Host "Checking Prisma CLI..."

if (Test-Path $IndexJs) {
    $len = (Get-Item $IndexJs).Length
    Write-Host "OK: index.js exists ($len bytes)"
    Set-Location $BackendRoot
    node .\scripts\prisma-cli.mjs --version
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "MISSING: $IndexJs"
Write-Host "Antivirus often quarantines this file after npm install."
Write-Host ""
Write-Host "Add a Windows Defender exclusion for:"
Write-Host "  $PrismaDir"
Write-Host ""
Write-Host "Then press Enter to reinstall prisma (or Ctrl+C to cancel)..."
Read-Host

Set-Location $BackendRoot
Remove-Item -Recurse -Force $PrismaDir -ErrorAction SilentlyContinue
npm install prisma@7.4.2 @prisma/client@7.4.2 --no-audit

if (-not (Test-Path $IndexJs)) {
    Write-Host ""
    Write-Host "Still missing after reinstall. Check Windows Security -> Protection history"
    Write-Host "for quarantined prisma files, restore them, and add the exclusion above."
    exit 1
}

Write-Host "Reinstalled successfully."
node .\scripts\prisma-cli.mjs generate
exit $LASTEXITCODE
