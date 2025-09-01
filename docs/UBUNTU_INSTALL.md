# NDI Web Router - Ubuntu Server Installation Guide

This guide will help you install and configure the NDI Web Router on Ubuntu Server as a lightweight, dedicated NDI routing appliance.

## Prerequisites

### System Requirements
- Ubuntu Server 20.04 LTS or newer
- Minimum 2GB RAM (4GB recommended)
- 10GB available disk space
- Network connectivity
- x64 or ARM64 architecture

### NDI SDK Installation
Before installing NDI Web Router, you need to install the NDI SDK:

```bash
# Download NDI SDK (replace with current version URL)
wget https://downloads.ndi.tv/SDK/NDI_SDK_Linux/Install_NDI_SDK_v6_Linux.tar.gz

# Extract and install
tar -xzf Install_NDI_SDK_v6_Linux.tar.gz
sudo ./Install_NDI_SDK_v6_Linux.sh

# Verify installation
ls /usr/local/include/Processing.NDI*
ls /usr/local/lib/libndi*
```

## Installation Methods

### Method 1: Automated Installation (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/janyinsah/NDI-Web-Router.git
   cd NDI-Web-Router
   ```

2. **Make scripts executable:**
   ```bash
   chmod +x scripts/*.sh
   ```

3. **Build the application:**
   ```bash
   ./scripts/build-linux.sh
   ```

4. **Install system-wide:**
   ```bash
   sudo ./scripts/install-linux.sh
   ```

5. **Setup NDI Discovery (optional but recommended):**
   ```bash
   sudo ./scripts/setup-ndi-discovery.sh
   ```

### Method 2: Manual Installation

1. **Install dependencies:**
   ```bash
   sudo apt update
   sudo apt install -y cmake build-essential curl nodejs npm nginx systemd avahi-daemon
   ```

2. **Clone and build:**
   ```bash
   git clone https://github.com/janyinsah/NDI-Web-Router.git
   cd NDI-Web-Router
   
   # Build backend
   mkdir -p build && cd build
   cmake .. -DCMAKE_BUILD_TYPE=Release
   cmake --build . --config Release
   cd ..
   
   # Build frontend
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **Install manually:**
   ```bash
   # Create directories
   sudo mkdir -p /opt/ndi-web-router/{bin,frontend}
   sudo mkdir -p /var/log/ndi-web-router
   sudo mkdir -p /etc/ndi-web-router
   
   # Copy files
   sudo cp build/ndi_router_v2 /opt/ndi-web-router/bin/
   sudo cp -r frontend/dist/* /opt/ndi-web-router/frontend/
   
   # Set permissions
   sudo chmod +x /opt/ndi-web-router/bin/ndi_router_v2
   ```

4. **Create systemd service (see Configuration section)**

## Configuration

### Service Configuration
The systemd service is located at `/etc/systemd/system/ndi-web-router.service`:

```ini
[Unit]
Description=NDI Web Router Service
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=ndi-router
Group=ndi-router
ExecStart=/opt/ndi-web-router/bin/ndi_router_v2
WorkingDirectory=/opt/ndi-web-router
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/log/ndi-web-router

# Environment
Environment=NDI_RUNTIME_DIR_V6=/usr/local/lib

[Install]
WantedBy=multi-user.target
```

### Application Configuration
Configuration file: `/etc/ndi-web-router/config.json`

```json
{
    "backend": {
        "port": 8080,
        "host": "0.0.0.0"
    },
    "frontend": {
        "port": 3000,
        "path": "/opt/ndi-web-router/frontend"
    },
    "ndi": {
        "discovery_server": true,
        "groups": []
    }
}
```

### Nginx Configuration
Web server configuration at `/etc/nginx/sites-available/ndi-web-router`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Serve frontend static files
    location / {
        root /opt/ndi-web-router/frontend;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

## Network Configuration

### Firewall Setup
```bash
# Allow HTTP traffic
sudo ufw allow 80/tcp comment "NDI Web Router HTTP"

# Allow NDI discovery and streams
sudo ufw allow 5353/udp comment "NDI Discovery (mDNS)"
sudo ufw allow 5959/tcp comment "NDI Discovery Server"
sudo ufw allow 5960:5989/tcp comment "NDI Data"
sudo ufw allow 5960:5989/udp comment "NDI Data"

# Enable firewall
sudo ufw enable
```

### Network Discovery
The installation sets up Avahi for automatic network discovery. The service will be discoverable as "NDI Web Router on [hostname]" in network browsers.

## Service Management

### Basic Commands
```bash
# Start service
sudo systemctl start ndi-web-router

# Stop service
sudo systemctl stop ndi-web-router

# Restart service
sudo systemctl restart ndi-web-router

# Enable auto-start on boot
sudo systemctl enable ndi-web-router

# Check service status
sudo systemctl status ndi-web-router

# View logs
sudo journalctl -u ndi-web-router -f
```

### Health Checks
```bash
# Check if backend is responding
curl http://localhost:8080/api/health

# Check nginx status
sudo systemctl status nginx

# Test NDI discovery
avahi-browse -t _ndi._tcp
```

## Usage

### Accessing the Web Interface
- **Local access:** http://localhost
- **Network access:** http://[server-ip-address]
- **Discovery:** Look for "NDI Web Router on [hostname]" in network browsers

### Multi-Destination Routing
1. Assign NDI sources to source slots
2. Click a source slot to select it
3. Click "Multi-Route" button
4. Select multiple destinations by clicking them
5. Click "Apply" to route the source to all selected destinations

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check logs
sudo journalctl -u ndi-web-router -n 50

# Check NDI SDK installation
ls -la /usr/local/lib/libndi*
ldd /opt/ndi-web-router/bin/ndi_router_v2
```

**NDI sources not discovered:**
```bash
# Check Avahi status
sudo systemctl status avahi-daemon

# Scan for NDI sources
avahi-browse -t _ndi._tcp

# Check firewall
sudo ufw status
```

**Web interface not accessible:**
```bash
# Check nginx status
sudo systemctl status nginx

# Test nginx configuration
sudo nginx -t

# Check if backend is running
curl http://localhost:8080/api/health
```

**Permission issues:**
```bash
# Fix permissions
sudo chown -R ndi-router:ndi-router /opt/ndi-web-router
sudo chown -R ndi-router:ndi-router /var/log/ndi-web-router
```

### Log Locations
- Application logs: `sudo journalctl -u ndi-web-router`
- Nginx logs: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`
- System logs: `/var/log/syslog`

## Performance Optimization

### For High-Performance Routing
```bash
# Increase system limits
echo "ndi-router soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "ndi-router hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize network buffers
echo "net.core.rmem_max = 134217728" | sudo tee -a /etc/sysctl.conf
echo "net.core.wmem_max = 134217728" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Resource Monitoring
```bash
# Monitor CPU and memory usage
htop

# Monitor network traffic
sudo iftop

# Monitor NDI streams
# (Use NDI Studio Monitor or other NDI tools)
```

## Updating

### Update Application
```bash
cd NDI-Web-Router
git pull
./scripts/build-linux.sh
sudo systemctl stop ndi-web-router
sudo cp build/ndi_router_v2 /opt/ndi-web-router/bin/
sudo cp -r frontend/dist/* /opt/ndi-web-router/frontend/
sudo systemctl start ndi-web-router
```

### Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot  # If kernel was updated
```

## Security

### Basic Hardening
```bash
# Change default SSH port
sudo nano /etc/ssh/sshd_config
sudo systemctl restart ssh

# Keep system updated
sudo apt update && sudo apt upgrade -y

# Configure automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### Network Security
- Run behind a firewall if possible
- Use VPN for remote access
- Consider HTTPS with SSL certificates for production use
- Regularly update all components

## Support

For issues and support:
1. Check this documentation first
2. Review logs for error messages  
3. Check GitHub issues: https://github.com/janyinsah/NDI-Web-Router/issues
4. Create a new issue with detailed information about your setup and problem