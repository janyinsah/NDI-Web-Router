@echo off
echo Starting NDI Web Router...

REM Check if backend executable exists
if not exist "build\Release\ndi_router_v2.exe" (
    echo Backend not found! Please run build.bat first.
    pause
    exit /b 1
)

REM Check if frontend is built
if not exist "frontend\dist" (
    echo Frontend not built! Please run build.bat first.
    pause
    exit /b 1
)

REM Start backend in new window
echo Starting backend server...
start "NDI Backend" /d "build\Release" ndi_router_v2.exe

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend with network access
echo Starting frontend server...
cd frontend
start "NDI Frontend" cmd /k "npm run preview -- --host"

echo.
echo NDI Web Router is starting...
echo Backend: http://localhost:8080 (also accessible on network)
echo Frontend: http://localhost:4173 (also accessible on network)
echo.
echo For network access, use your computer's IP address instead of localhost
echo.
echo Press any key to stop all servers...
pause >nul

REM Kill the servers
taskkill /f /im "ndi_router_v2.exe" 2>nul
taskkill /f /im "node.exe" 2>nul

echo Servers stopped.
pause