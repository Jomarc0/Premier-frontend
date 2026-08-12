@echo off
setlocal

set "ROOT=%~dp0"

echo Starting Premier web frontends...
echo.

if exist "%ROOT%admin\package.json" (
    start "Premier Admin" cmd /k "cd /d ""%ROOT%admin"" && npm run dev -- --host 0.0.0.0"
)

if exist "%ROOT%users\package.json" (
    start "Premier Users" cmd /k "cd /d ""%ROOT%users"" && npm run dev -- --host 0.0.0.0"
)

@REM if exist "%ROOT%driver\package.json" (
@REM     start "Premier Driver" cmd /k "cd /d ""%ROOT%driver"" && npm run dev -- --host 0.0.0.0"
@REM )

if exist "%ROOT%staff\package.json" (
    start "Premier Staff Queue" cmd /k "cd /d ""%ROOT%staff"" && npm run dev -- --host 0.0.0.0 "
)

echo Started available web frontend dev servers.
echo Staff queue should open at http://localhost:5177
echo Close the opened terminal windows to stop them.
echo.
pause