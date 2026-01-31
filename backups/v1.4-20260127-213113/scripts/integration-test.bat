@echo off
REM Integration Test Suite - v1.2 (Windows Version)
REM Run this after every deployment to verify all 9 bug fixes

echo ========================================================================
echo         Integration Test Suite - v1.2 Bug Verification
echo ========================================================================
echo.

REM Check if running in Git Bash
where bash >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Running tests via Git Bash...
    bash scripts/integration-test.sh
    exit /b %ERRORLEVEL%
)

REM Fallback to WSL if available
where wsl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Running tests via WSL...
    wsl bash scripts/integration-test.sh
    exit /b %ERRORLEVEL%
)

REM No bash available
echo ERROR: Bash not found.
echo.
echo Please install one of:
echo   - Git for Windows (includes Git Bash)
echo   - WSL (Windows Subsystem for Linux)
echo.
echo Or run the tests manually using Node.js:
echo   node scripts/integration-test.js
echo.
exit /b 1
