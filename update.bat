@echo off
echo Fetching from remote repository...
git fetch

git checkout main

echo.
echo Pulling latest changes...
git pull

echo.
echo Done!
pause
