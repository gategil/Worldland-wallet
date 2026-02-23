@echo off
setlocal enabledelayedexpansion

REM 플랫폼 감지
if exist "%SYSTEMROOT%\System32\WindowsPowerShell\v1.0\powershell.exe" (
    set "PS_PATH=%SYSTEMROOT%\System32\WindowsPowerShell\v1.0\powershell.exe"
) else (
    set "PS_PATH=powershell"
)

REM 검색할 문자열 입력받기
if "%~1"=="" (
    set /p "SEARCH_STRING=검색할 문자열을 입력하세요: "
) else (
    set "SEARCH_STRING=%~1"
)

REM PowerShell 명령 실행
"%PS_PATH%" -Command "Get-ChildItem -Path . -Recurse -File | Select-String -Pattern '%SEARCH_STRING%' -List | ForEach-Object { Write-Host $_.Path }"

pause