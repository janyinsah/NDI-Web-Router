#!/bin/bash
set -e

echo "Building NDI Web Router for Linux..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script must be run on Linux"
    exit 1
fi

# Check for required tools
print_status "Checking build dependencies..."

# Check for cmake
if ! command -v cmake &> /dev/null; then
    print_error "CMake is required but not installed. Install with: sudo apt install cmake"
    exit 1
fi

# Check for g++
if ! command -v g++ &> /dev/null; then
    print_error "g++ is required but not installed. Install with: sudo apt install build-essential"
    exit 1
fi

# Check for Node.js and npm
if ! command -v node &> /dev/null; then
    print_warning "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check for NDI SDK
NDI_PATHS=(
    "/usr/local/include/Processing.NDI.Lib.h"
    "/usr/include/Processing.NDI.Lib.h"
    "/opt/ndi/include/Processing.NDI.Lib.h"
)

NDI_FOUND=false
for path in "${NDI_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        NDI_FOUND=true
        print_status "Found NDI SDK at: $(dirname $path)"
        break
    fi
done

if [[ "$NDI_FOUND" == false ]]; then
    print_error "NDI SDK not found. Please install NDI SDK first:"
    print_error "1. Download from https://ndi.video/sdk/"
    print_error "2. Extract and install: sudo ./install_ndi_sdk.sh"
    print_error "3. Or install via package manager if available"
    exit 1
fi

# Create build directory
print_status "Creating build directory..."
mkdir -p build
cd build

# Configure with CMake
print_status "Configuring with CMake..."
cmake .. -DCMAKE_BUILD_TYPE=Release

if [[ $? -ne 0 ]]; then
    print_error "CMake configuration failed!"
    exit 1
fi

# Build the project
print_status "Building C++ backend..."
cmake --build . --config Release -j$(nproc)

if [[ $? -ne 0 ]]; then
    print_error "Backend build failed!"
    exit 1
fi

cd ..

# Build frontend
print_status "Building React + Vite frontend..."
cd frontend

print_status "Installing npm dependencies..."
npm install

if [[ $? -ne 0 ]]; then
    print_error "npm install failed!"
    exit 1
fi

print_status "Building frontend..."
npm run build

if [[ $? -ne 0 ]]; then
    print_error "Frontend build failed!"
    exit 1
fi

cd ..

print_status "Build completed successfully!"
echo
print_status "Build artifacts:"
print_status "- Backend binary: ./build/ndi_router_v2"
print_status "- Frontend files: ./frontend/dist/"
echo
print_status "To install system-wide, run: sudo ./scripts/install-linux.sh"
print_status "To run locally: ./build/ndi_router_v2"
echo