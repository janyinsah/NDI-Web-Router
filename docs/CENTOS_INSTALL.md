# NDI Web Router - CentOS Installation Guide

## Overview

This guide covers installing NDI Web Router with authentication on CentOS 7/8/9 (Rocky Linux/AlmaLinux compatible).

## Prerequisites

### System Requirements
- CentOS 7/8/9 (or Rocky Linux 8/9, AlmaLinux 8/9)
- Root or sudo access
- Internet connection for package downloads

### Minimum Hardware
- 2 CPU cores
- 4GB RAM
- 10GB free disk space
- Network interface for NDI discovery

## Step 1: Update System and Install Base Dependencies

### CentOS 7
```bash
# Update system
sudo yum update -y

# Install EPEL repository
sudo yum install -y epel-release

# Install development tools
sudo yum groupinstall -y "Development Tools"
sudo yum install -y cmake3 git wget curl

# Install required libraries
sudo yum install -y sqlite-devel openssl-devel pkgconfig

# Create cmake symlink for CentOS 7
sudo ln -sf /usr/bin/cmake3 /usr/local/bin/cmake
```

### CentOS 8/9, Rocky Linux, AlmaLinux
```bash
# Update system
sudo dnf update -y

# Install development tools
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y cmake git wget curl

# Install required libraries
sudo dnf install -y sqlite-devel openssl-devel pkgconfig

# Install Node.js (for frontend)
sudo dnf install -y nodejs npm
```

### For CentOS 7 - Install Modern Node.js
```bash
# CentOS 7 has old Node.js, install newer version
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

## Step 2: Install NDI SDK

### Download NDI SDK
```bash
# Create NDI directory
sudo mkdir -p /opt/ndi

# Download NDI SDK (you need to download from https://ndi.video/sdk/)
# Place the downloaded file in /tmp/
cd /tmp

# Extract NDI SDK (adjust filename as needed)
# Example for NDI SDK 5.x:
tar -xzf NDI_SDK_Linux_v5.x.x.tar.gz

# Copy NDI files to system locations
sudo cp -r "NDI SDK for Linux"/include/* /usr/local/include/
sudo cp -r "NDI SDK for Linux"/lib/x86_64-linux-gnu/* /usr/local/lib/

# Update library cache
sudo ldconfig

# Set NDI environment variables
echo 'export NDI_RUNTIME_DIR_V2="/usr/local/lib"' | sudo tee -a /etc/environment
echo 'export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"' | sudo tee -a /etc/environment

# Source environment
source /etc/environment
```

## Step 3: Clone and Build the Project

```bash
# Clone the repository
cd /opt
sudo git clone https://github.com/your-repo/ndi-web-routerv2.git
sudo chown -R $USER:$USER ndi-web-routerv2
cd ndi-web-routerv2

# Create build directory
mkdir build
cd build

# Configure with CMake
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build the project
make -j$(nproc)

# Verify the executable was created
ls -la ndi_router_v2
```

## Step 4: Build Frontend

```bash
# Navigate to frontend directory
cd /opt/ndi-web-routerv2/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Verify build was successful
ls -la dist/
```

## Step 5: Create System Service

### Create service user
```bash
# Create dedicated user for the service
sudo useradd -r -s /bin/false ndi-router
sudo mkdir -p /var/lib/ndi-router
sudo chown ndi-router:ndi-router /var/lib/ndi-router
```

### Create systemd service file
```bash
sudo tee /etc/systemd/system/ndi-web-router.service << 'EOF'
[Unit]
Description=NDI Web Router v2
After=network.target
Wants=network.target

[Service]
Type=simple
User=ndi-router
Group=ndi-router
WorkingDirectory=/var/lib/ndi-router
ExecStart=/opt/ndi-web-routerv2/build/ndi_router_v2 8080
Restart=always
RestartSec=10

# Environment variables
Environment="NDI_RUNTIME_DIR_V2=/usr/local/lib"
Environment="LD_LIBRARY_PATH=/usr/local/lib"

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/ndi-router

[Install]
WantedBy=multi-user.target
EOF
```

### Copy executable and set permissions
```bash
# Copy the executable to a system location
sudo cp /opt/ndi-web-routerv2/build/ndi_router_v2 /usr/local/bin/
sudo chmod +x /usr/local/bin/ndi_router_v2

# Update service file to use system location
sudo sed -i 's|/opt/ndi-web-routerv2/build/ndi_router_v2|/usr/local/bin/ndi_router_v2|' /etc/systemd/system/ndi-web-router.service
```

## Step 6: Install and Configure Nginx (Optional but Recommended)

```bash
# Install Nginx
sudo yum install -y nginx  # CentOS 7
# or
sudo dnf install -y nginx  # CentOS 8/9

# Create Nginx configuration
sudo tee /etc/nginx/conf.d/ndi-router.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Serve frontend files
    location / {
        root /opt/ndi-web-routerv2/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
    
    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Test Nginx configuration
sudo nginx -t

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Step 7: Configure Firewall

```bash
# For firewalld (CentOS 7/8/9 default)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-port=8080/tcp  # If accessing backend directly
sudo firewall-cmd --reload

# For iptables (if using instead of firewalld)
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo service iptables save  # CentOS 7
```

## Step 8: Start and Enable Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start NDI Web Router
sudo systemctl enable ndi-web-router
sudo systemctl start ndi-web-router

# Check service status
sudo systemctl status ndi-web-router

# Check logs if there are issues
sudo journalctl -u ndi-web-router -f
```

## Step 9: Configure NDI Discovery (Optional)

```bash
# Install Avahi for mDNS discovery
sudo yum install -y avahi avahi-tools  # CentOS 7
# or
sudo dnf install -y avahi avahi-tools  # CentOS 8/9

# Enable and start Avahi
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Create NDI service advertisement
sudo tee /etc/avahi/services/ndi-router.service << 'EOF'
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>NDI Web Router</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

# Restart Avahi
sudo systemctl restart avahi-daemon
```

## Step 10: First-Time Setup

### Access the application
1. **Direct Backend Access**: `http://your-server-ip:8080`
2. **Via Nginx (recommended)**: `http://your-server-ip`

### Login and Configure
1. Navigate to the web interface
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. **IMMEDIATELY** create a new admin user and delete the default one
4. Create additional users as needed

## Verification and Testing

### Check all services are running
```bash
# Check NDI Web Router
sudo systemctl status ndi-web-router

# Check Nginx (if installed)
sudo systemctl status nginx

# Check if ports are listening
sudo netstat -tlnp | grep -E ':(80|8080)'

# Test database creation
ls -la /var/lib/ndi-router/ndi_users.db
```

### Test NDI functionality
```bash
# Check if NDI libraries are loaded
ldd /usr/local/bin/ndi_router_v2 | grep ndi

# Test NDI source discovery (if you have NDI sources on network)
# This should show in the web interface once logged in
```

## Troubleshooting

### Build Issues
```bash
# If CMake version is too old (CentOS 7)
sudo yum remove cmake
sudo yum install cmake3
export PATH=/usr/bin:$PATH

# If NDI libraries not found
sudo ldconfig -v | grep ndi
export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# If SQLite not found
sudo yum install sqlite-devel  # CentOS 7
sudo dnf install sqlite-devel  # CentOS 8/9
```

### Runtime Issues
```bash
# Check service logs
sudo journalctl -u ndi-web-router -n 50

# Check file permissions
ls -la /var/lib/ndi-router/
sudo chown -R ndi-router:ndi-router /var/lib/ndi-router/

# Check if database was created
sudo -u ndi-router ls -la /var/lib/ndi-router/
```

### Network Issues
```bash
# Check firewall
sudo firewall-cmd --list-all

# Check SELinux (if enabled)
sudo setsebool -P httpd_can_network_connect 1
sudo setsebool -P httpd_can_network_relay 1

# Check NDI network discovery
sudo tcpdump -i any port 5353  # mDNS traffic
```

## Security Hardening

### SSL/HTTPS Setup (Recommended for Production)
```bash
# Install Certbot for Let's Encrypt
sudo dnf install -y certbot python3-certbot-nginx

# Get SSL certificate (replace your-domain.com)
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot-renew.timer
```

### Additional Security
```bash
# Update firewall to only allow necessary ports
sudo firewall-cmd --remove-service=http  # If using HTTPS only
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Set up log rotation
sudo tee /etc/logrotate.d/ndi-router << 'EOF'
/var/log/ndi-router/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
}
EOF
```

## Maintenance

### Updates
```bash
# Update system packages
sudo dnf update -y

# Update NDI Web Router (when new version available)
cd /opt/ndi-web-routerv2
sudo git pull
cd build
make clean && make -j$(nproc)
sudo cp ndi_router_v2 /usr/local/bin/
sudo systemctl restart ndi-web-router
```

### Backup
```bash
# Backup user database
sudo cp /var/lib/ndi-router/ndi_users.db /backup/ndi_users_$(date +%Y%m%d).db

# Backup configuration
sudo tar czf /backup/ndi-router-config_$(date +%Y%m%d).tar.gz \
    /etc/systemd/system/ndi-web-router.service \
    /etc/nginx/conf.d/ndi-router.conf \
    /var/lib/ndi-router/
```

Your NDI Web Router is now securely installed and running on CentOS with authentication, user management, and proper systemd integration!