@echo off
setlocal

REM Resolve local Node 20 install (if present)
set NODE20_ROOT=
for /f "delims=" %%D in ('powershell -NoProfile -Command "Get-ChildItem -Directory C:\52\tools\node20 | Where-Object { $_.Name -like \"node-v20.*-win-x64\" } | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName"') do set NODE20_ROOT=%%D
if defined NODE20_ROOT set PATH=%NODE20_ROOT%;%PATH%

REM Server config
set HOST=0.0.0.0
set PORT=3000

REM Optional admin token (set via env or 1st arg)
if "%ADMIN_TOKEN%"=="" (
  if not "%~1"=="" (
    set ADMIN_TOKEN=%~1
  ) else (
    set ADMIN_TOKEN=fr3ak4zoid
  )
)

cd /d C:\52\htown
npx pnpm --filter @htown/server dev
