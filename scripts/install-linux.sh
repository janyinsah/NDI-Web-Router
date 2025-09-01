#!/bin/bash
set -e

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

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

echo "Installing NDI Web Router..."

# Install system dependencies
print_status "Installing system dependencies..."
apt update
apt install -y \
    cmake \
    build-essential \
    curl \
    nginx \
    systemd \
    avahi-daemon \
    avahi-utils

# Create application directories
print_status "Creating application directories..."
mkdir -p /opt/ndi-web-router/bin
mkdir -p /opt/ndi-web-router/frontend
mkdir -p /var/log/ndi-web-router
mkdir -p /etc/ndi-web-router

# Copy application files
print_status "Installing application files..."
if [[ -f "build/ndi_router_v2" ]]; then
    cp build/ndi_router_v2 /opt/ndi-web-router/bin/
    chmod +x /opt/ndi-web-router/bin/ndi_router_v2
else
    print_error "Backend binary not found. Please run ./scripts/build-linux.sh first"
    exit 1
fi

if [[ -d "frontend/dist" ]]; then
    cp -r frontend/dist/* /opt/ndi-web-router/frontend/
else
    print_error "Frontend build not found. Please run ./scripts/build-linux.sh first"
    exit 1
fi

# Create configuration file
print_status "Creating configuration file..."
cat > /etc/ndi-web-router/config.json << EOF
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
EOF

# Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/ndi-web-router.service << EOF
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
EOF

# Create user for service
print_status "Creating service user..."
if ! id "ndi-router" &>/dev/null; then
    useradd -r -s /bin/false -d /opt/ndi-web-router ndi-router
fi

chown -R ndi-router:ndi-router /opt/ndi-web-router
chown -R ndi-router:ndi-router /var/log/ndi-web-router
chown ndi-router:ndi-router /etc/ndi-web-router/config.json

# Configure nginx reverse proxy
print_status "Configuring nginx reverse proxy..."
cat > /etc/nginx/sites-available/ndi-web-router << EOF
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Serve frontend static files
    location / {
        root /opt/ndi-web-router/frontend;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/ndi-web-router /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t
if [[ $? -ne 0 ]]; then
    print_error "Nginx configuration test failed"
    exit 1
fi

# Enable and start services
print_status "Enabling and starting services..."
systemctl daemon-reload
systemctl enable ndi-web-router
systemctl enable nginx
systemctl enable avahi-daemon

systemctl start avahi-daemon
systemctl start ndi-web-router
systemctl restart nginx

# Configure firewall if ufw is installed
if command -v ufw &> /dev/null; then
    print_status "Configuring firewall..."
    ufw allow 80/tcp comment "NDI Web Router HTTP"
    ufw allow 5353/udp comment "NDI Discovery (mDNS)"
    ufw allow 5960:5989/tcp comment "NDI Data"
    ufw allow 5960:5989/udp comment "NDI Data"
fi

# Set up Avahi service for network discovery
print_status "Setting up network discovery..."
cat > /etc/avahi/services/ndi-web-router.service << EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">NDI Web Router on %h</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
    <txt-record>path=/</txt-record>
    <txt-record>description=NDI Web Router Control Interface</txt-record>
  </service>
</service-group>
EOF

systemctl restart avahi-daemon

print_status "Installation completed successfully!"
echo
print_status "NDI Web Router is now running and available at:"
print_status "- Local: http://localhost"
print_status "- Network: http://$(hostname -I | awk '{print $1}')"
echo
print_status "Service management:"
print_status "- Status: sudo systemctl status ndi-web-router"
print_status "- Logs: sudo journalctl -u ndi-web-router -f"
print_status "- Restart: sudo systemctl restart ndi-web-router"
echo
print_status "Configuration file: /etc/ndi-web-router/config.json"
print_status "Log files: /var/log/ndi-web-router/"
echo