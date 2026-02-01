@echo off
setlocal enabledelayedexpansion
if not exist logs mkdir logs
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set DATE=%%i

start "admin-api" /b cmd /c "npm run dev -w apps/admin-api > logs\\admin-api-!DATE!.log 2>&1"

powershell -NoProfile -Command "for ($i=0; $i -lt 120; $i++) { try { $res = Invoke-WebRequest -UseBasicParsing http://localhost:8080/health; if ($res.StatusCode -eq 200) { exit 0 } } catch {} Start-Sleep -Milliseconds 500 } exit 1"
if errorlevel 1 goto :eof

start "" "http://localhost:8080/docs"

endlocal
