@echo off
setlocal

REM Usage:
REM   run-all.cmd [serverHost] [adminToken]
REM Example:
REM   run-all.cmd 185.253.170.200 MySecretToken

set SERVER_HOST=%~1
set ADMIN_TOKEN=%~2

if "%SERVER_HOST%"=="" set SERVER_HOST=10.0.4.10

start "htown-server" cmd /k "%~dp0run-server.cmd" %ADMIN_TOKEN%
start "htown-client" cmd /k "%~dp0run-client.cmd" %SERVER_HOST%
