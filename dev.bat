@echo off
echo Starting NDI Web Router in Development Mode...

REM Check if backend executable exists
if not exist "build\Release\ndi_router_v2.exe" (
    echo Backend not found! Please run build.bat first.
    pause
    exit /b 1
)

REM Start backend in new window
echo Starting backend server...
start "NDI Backend" /d "build\Release" ndi_router_v2.exe

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in development mode
echo Starting frontend development server...
cd frontend
start "NDI Frontend Dev" cmd /k "npm run dev"

echo.
echo NDI Web Router is starting in development mode...
echo Backend: http://localhost:8080
echo Frontend: http://localhost:3000
echo.
echo Press any key to stop all servers...
pause >nul

REM Kill the servers
taskkill /f /im "ndi_router_v2.exe" 2>nul
taskkill /f /im "node.js" 2>nul

echo Servers stopped.
pause