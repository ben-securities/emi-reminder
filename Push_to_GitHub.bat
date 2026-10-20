@echo off
title Uploading EMI Reminder to GitHub...
cd /d "D:\Projects\ios-reminder-app"

echo Configuring remote...
git remote remove origin 2>nul
git remote add origin https://github.com/ben-securities/emi-reminder.git
git branch -M main

echo.
echo Pushing code to https://github.com/ben-securities/emi-reminder ...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================
    echo SUCCESS! Your code has been uploaded to GitHub!
    echo.
    echo The Cloud Mac is now building your EMI_Reminder.ipa file.
    echo You can track the build progress at:
    echo https://github.com/ben-securities/emi-reminder/actions
    echo ================================================================
) else (
    echo.
    echo [Notice] If GitHub requested a sign-in or token, please complete it and run this again.
)

pause
