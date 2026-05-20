@echo off
cd /d "%~dp0"

REM ── Move any previous backup files from Downloads to app\backup ──
for %%f in ("%USERPROFILE%\Downloads\20??_??_??.json") do (
    move "%%f" "app\backup\" >nul 2>&1
)

REM ── Open the app in default browser ──
start "" "app\index.html"

REM ── Wait for the browser to download today's backup, then move it ──
timeout /t 8 /nobreak >nul
for %%f in ("%USERPROFILE%\Downloads\20??_??_??.json") do (
    move "%%f" "app\backup\" >nul 2>&1
)

REM ── Push daily backup to the backup branch ──
REM Skip if there are no backup JSON files at all
dir /b "app\backup\20??_??_??.json" >nul 2>&1
if errorlevel 1 goto :eof

REM Build today's date for the commit message
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do (
    set "DD=%%a"
    set "MM=%%b"
    set "YYYY=%%c"
)

git checkout backup
git add app\backup\*.json
git commit -m "Backup giornaliero %DD%/%MM%/%YYYY%" >nul 2>&1
git push && goto :push_ok
goto :push_fail

:push_ok
git checkout main
goto :eof

:push_fail
REM Push failed (no internet?) — commit stays local, will retry next run
git checkout main
