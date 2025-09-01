# NDI Web Router v2

A web-based NDI source routing application that allows any device on the network to route NDI sources without requiring NDI tools to be installed locally. Built with C++ backend for high-performance video processing and React/Next.js frontend for an intuitive web interface.

## Features

- **NDI Source Discovery**: Automatically discovers all NDI sources on the network
- **Web-based Interface**: Access from any device with a web browser
- **Real-time Routing**: Create and manage NDI routes with minimal latency
- **No Local Installation**: No need to install NDI tools on client devices
- **High Performance**: C++ backend ensures efficient video processing without freezing
- **Cross-platform**: Works on Windows, with potential for Linux/macOS support

## Architecture

- **Backend**: C++ with NDI SDK for high-performance video processing
- **Frontend**: React/Next.js with TypeScript for modern web interface
- **API**: RESTful API communication between frontend and backend
- **Real-time Updates**: Automatic source discovery and route status updates

## Prerequisites

### For Building the Backend:
- Visual Studio 2019/2022 or equivalent C++ compiler
- CMake 3.20 or higher
- NDI SDK 5.0 or higher (download from NewTek/Vizrt)
- Windows SDK

### For Building the Frontend:
- Node.js 16+ and npm
- Modern web browser

## Setup Instructions

### 1. NDI SDK Installation
1. Download the NDI SDK from [Vizrt Developer](https://www.vizrt.com/developer/)
2. Extract the SDK and copy the contents to `backend/ndi_sdk/`
3. Ensure the following structure:
   ```
   backend/ndi_sdk/
   ├── include/
   │   └── Processing.NDI.Lib.h
   ├── lib/
   │   └── x64/
   │       └── Processing.NDI.Lib.x64.lib
   └── bin/
       └── x64/
           └── Processing.NDI.Lib.x64.dll
   ```

### 2. Backend Build
```bash
# Create build directory
mkdir build
cd build

# Configure with CMake
cmake ..

# Build the project
cmake --build . --config Release

# The executable will be in the Release folder
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
npm start
```

## Running the Application

### 1. Start the Backend
```bash
# From the build/Release directory
./ndi_router.exe [port]
# Default port is 8080
```

### 2. Start the Frontend
```bash
# From the frontend directory
npm run dev
# Frontend will run on http://localhost:3000
```

### 3. Access the Web Interface
Open your web browser and navigate to `http://localhost:3000`

## API Endpoints

- `GET /api/sources` - Get all discovered NDI sources
- `GET /api/routes` - Get all active routes
- `POST /api/routes` - Create a new route
- `DELETE /api/routes/{id}` - Delete a route

## Usage

1. **Discover Sources**: The application automatically discovers NDI sources on your network
2. **Select Source**: Click on a source from the list to select it
3. **Create Route**: Enter a destination name and click "Create Route"
4. **Manage Routes**: View active routes and delete them as needed
5. **Monitor Status**: Real-time updates show route status and source availability

## Configuration

### Backend Configuration
- Port: Set via command line argument (default: 8080)
- NDI settings: Modify in `ndi_manager.cpp`

### Frontend Configuration
- API URL: Set `NEXT_PUBLIC_API_URL` environment variable
- Update intervals: Modify in `useNDI.ts` hook

## Troubleshooting

### Backend Issues
- Ensure NDI SDK is properly installed and paths are correct
- Check Windows Firewall settings for NDI discovery
- Verify NDI sources are available on the network

### Frontend Issues
- Check that backend is running and accessible
- Verify API URL configuration
- Check browser console for errors

### NDI Issues
- Ensure all devices are on the same network
- Check NDI Access Manager settings if using NDI 5.0+
- Verify no other applications are exclusively using NDI sources

## Development

### Adding New Features
1. Backend changes: Modify C++ files in `backend/src/`
2. API changes: Update `web_server.cpp` and corresponding frontend API calls
3. Frontend changes: Modify React components in `frontend/src/`

### Building for Production
1. Build backend in Release mode
2. Build frontend with `npm run build`
3. Deploy both components to your server

## License

This project is provided as-is for educational and development purposes. NDI is a trademark of Vizrt. Ensure compliance with NDI SDK license terms.

## Support

For issues related to:
- NDI SDK: Contact Vizrt support
- Web interface: Check browser compatibility and network settings
- Performance: Ensure adequate system resources for video processing