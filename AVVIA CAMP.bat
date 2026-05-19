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
