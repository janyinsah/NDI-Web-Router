# NDI Web Router v2

A web-based NDI source routing application that allows any device on the network to route NDI sources without requiring NDI tools to be installed locally. Built with C++ backend for high-performance video processing and React/Vite frontend for an intuitive web interface.

## Features

- **Multi-Destination Routing**: Route one NDI source to multiple destinations simultaneously
- **NDI Source Discovery**: Automatically discovers all NDI sources on the network
- **Web-based Interface**: Access from any device with a web browser
- **Real-time Routing**: Create and manage NDI routes with minimal latency
- **No Local Installation**: No need to install NDI tools on client devices
- **High Performance**: C++ backend ensures efficient video processing without freezing
- **Cross-platform**: Works on Windows and Linux (Ubuntu Server ready)
- **Service Discovery**: Integrates with NDI Discovery Server and Avahi/mDNS
- **Production Ready**: Systemd service, Nginx reverse proxy, and auto-start capability

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

## Installation

### Ubuntu Server (Recommended for Production)

For a lightweight, dedicated NDI routing appliance on Ubuntu Server:

```bash
# Clone the repository
git clone https://github.com/janyinsah/NDI-Web-Router.git
cd NDI-Web-Router

# Make scripts executable
chmod +x scripts/*.sh

# Install NDI SDK (download from https://ndi.video/sdk/)
# Follow NDI SDK installation instructions for Linux

# Build and install
./scripts/build-linux.sh
sudo ./scripts/install-linux.sh

# Optional: Setup NDI Discovery Server
sudo ./scripts/setup-ndi-discovery.sh
```

**See [Ubuntu Installation Guide](docs/UBUNTU_INSTALL.md) for detailed instructions.**

### Windows Development Setup

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

### 2. Build on Windows
```bash
# Use the provided build script
build.bat

# Or manually:
mkdir build && cd build
cmake .. 
cmake --build . --config Release

# Frontend
cd frontend
npm install
npm run build
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

### Basic Routing
1. **Discover Sources**: The application automatically discovers NDI sources on your network
2. **Assign Sources**: Assign NDI sources to numbered source slots 
3. **Create Destinations**: Add output destinations using the "Add Output" button
4. **Single Route**: Click a source slot, then click a destination to create a route

### Multi-Destination Routing (New Feature)
1. **Select Source**: Click a source slot that has an assigned NDI source
2. **Enable Multi-Route**: Click the "Multi-Route" button that appears
3. **Select Destinations**: Click multiple destination slots to select them (they'll highlight in blue)
4. **Apply Routes**: Click "Apply" to route the source to all selected destinations simultaneously
5. **Monitor**: The same NDI stream will now be sent to all selected destinations

### Web Interface Access
- **Ubuntu Server**: http://[server-ip-address] (automatically discoverable on network)
- **Windows Dev**: http://localhost:3000 (frontend) + backend on port 8080
- **Service Management**: `sudo systemctl status ndi-web-router` (Ubuntu)

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