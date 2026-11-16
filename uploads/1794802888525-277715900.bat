@echo off
title Enable Task Manager

reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /f >nul 2>&1

reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr >nul 2>&1
if %errorlevel%==0 goto Failed

reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr >nul 2>&1
if %errorlevel%==0 goto Failed

:Success
echo Success
start taskmgr.exe
goto End

:Failed
echo Failed

:End
pause
