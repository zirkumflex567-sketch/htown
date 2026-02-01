@echo off
setlocal

REM Resolve local Node 20 install (if present)
set NODE20_ROOT=
for /f "delims=" %%D in ('powershell -NoProfile -Command "Get-ChildItem -Directory C:\52\tools\node20 | Where-Object { $_.Name -like \"node-v20.*-win-x64\" } | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName"') do set NODE20_ROOT=%%D
if defined NODE20_ROOT set PATH=%NODE20_ROOT%;%PATH%

REM Server host/IP (pass as first arg)
set SERVER_HOST=%~1
if "%SERVER_HOST%"=="" set SERVER_HOST=10.0.4.10
set VITE_SERVER_URL=http://%SERVER_HOST%:3000

cd /d C:\52\htown
npx pnpm --filter @htown/client dev -- --host 0.0.0.0 --port 5173
