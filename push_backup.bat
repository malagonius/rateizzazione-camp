@echo off
cd /d "%~dp0"

REM ── This script runs in a separate window to push backups to the backup branch ──

echo ============================================================
echo    BACKUP IN CORSO - NON CHIUDERE QUESTA FINESTRA
echo    Mentre c'e questa finestra non fare altre azioni!
echo ============================================================
echo.

REM Skip if there are no backup JSON files at all
dir /b "app\backup\20??_??_??.json" >nul 2>&1
if errorlevel 1 (
    echo Nessun file di backup trovato. Nulla da fare.
    timeout /t 3 /nobreak >nul
    exit /b
)

REM Build today's date string (YYYY_MM_DD) to check if today's backup exists
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do (
    set "DD=%%a"
    set "MM=%%b"
    set "YYYY=%%c"
)

REM Skip if today's backup already exists on the backup branch
git log backup --oneline -1 --grep="Backup giornaliero %DD%/%MM%/%YYYY%" >nul 2>&1
if not errorlevel 1 (
    git log backup --oneline -1 --grep="Backup giornaliero %DD%/%MM%/%YYYY%" | findstr /c:"Backup giornaliero" >nul 2>&1
    if not errorlevel 1 (
        echo Backup di oggi (%DD%/%MM%/%YYYY%) gia' eseguito. Nulla da fare.
        timeout /t 3 /nobreak >nul
        exit /b
    )
)

echo Esecuzione backup per %DD%/%MM%/%YYYY%...
echo.

git checkout backup
if errorlevel 1 (
    echo ERRORE: impossibile passare al branch backup.
    pause
    exit /b
)

git add app\backup\*.json
git commit -m "Backup giornaliero %DD%/%MM%/%YYYY%"
git push

if errorlevel 1 (
    echo.
    echo ATTENZIONE: Push fallito. Il commit resta locale.
)

REM Always switch back to main
git checkout main

echo.
echo ============================================================
echo    BACKUP COMPLETATO
echo    La finestra si chiudera' tra 3 secondi...
echo ============================================================
timeout /t 3 /nobreak >nul
