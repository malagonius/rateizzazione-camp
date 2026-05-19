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

REM ── Push daily backup to the backup branch (once per day) ──
REM Build today's date in YYYY_MM_DD format for the filename check
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do (
    set "DD=%%a"
    set "MM=%%b"
    set "YYYY=%%c"
)
set "TODAY_FILE=app\backup\%YYYY%_%MM%_%DD%.json"
set "COMMIT_MSG=Backup giornaliero %DD%/%MM%/%YYYY%"

REM Only proceed if today's backup file exists locally
if not exist "%TODAY_FILE%" goto :eof

REM Check if we already committed today's backup on the backup branch
git log backup --oneline --grep="%COMMIT_MSG%" -- >nul 2>&1
for /f %%n in ('git log backup --oneline --grep^="%COMMIT_MSG%" 2^>nul ^| find /c /v ""') do set "ALREADY_DONE=%%n"
if "%ALREADY_DONE%" NEQ "0" goto :eof

REM Commit and push
git checkout backup
git add app\backup\*
git commit -m "%COMMIT_MSG%"
git push
git checkout main
