@echo off
echo Building NDI Web Router...

REM Create build directory
if not exist "build" mkdir build
cd build

REM Configure with CMake
echo Configuring with CMake...
cmake ..
if %ERRORLEVEL% neq 0 (
    echo CMake configuration failed!
    pause
    exit /b 1
)

REM Build the project
echo Building C++ backend...
cmake --build . --config Release
if %ERRORLEVEL% neq 0 (
    echo Backend build failed!
    pause
    exit /b 1
)

cd ..

REM Build frontend
echo Building React + Vite frontend...
cd frontend
call npm install
if %ERRORLEVEL% neq 0 (
    echo npm install failed!
    pause
    exit /b 1
)

call npm run build
if %ERRORLEVEL% neq 0 (
    echo Frontend build failed!
    pause
    exit /b 1
)

cd ..

echo.
echo Build completed successfully!
echo.
echo To run:
echo 1. Start backend: build\Release\ndi_router_v2.exe
echo 2. Start frontend: cd frontend && npm run preview (production) or npm run dev (development)
echo 3. Open http://localhost:3000 in your browser
echo.
pause