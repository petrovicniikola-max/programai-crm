@echo off
setlocal
cd /d "%~dp0.."

echo ============================================
echo Prisma repair (CMD)
echo ============================================
echo.
echo VAZNO: Pre pokretanja dodaj izuzetak u Windows Defender za:
echo   %CD%\node_modules\prisma
echo.
pause

echo [1/4] Brisanje node_modules\prisma ...
if exist node_modules\prisma rmdir /s /q node_modules\prisma

echo [2/4] npm install prisma ...
call npm install prisma@7.4.2 @prisma/client@7.4.2 --no-audit
if errorlevel 1 goto fail

echo [3/4] Provera index.js ...
if exist node_modules\prisma\build\index.js (
  echo OK - index.js postoji
) else (
  echo GRESKA - index.js i dalje nedostaje.
  echo Windows Defender je verovatno blokirao fajl.
  echo Otvori: Windows Security - Protection history - vrati karantinovane fajlove.
  goto fail
)

echo [4/4] prisma generate ...
call npm run prisma:generate
if errorlevel 1 goto fail

echo.
echo Gotovo.
exit /b 0

:fail
echo.
echo Repair nije uspeo. Probaj na PI serveru u Docker kontejneru:
echo   npx prisma generate
echo   npx prisma migrate deploy
exit /b 1
