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

echo "Setting up NDI Discovery Server integration..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Install NDI Discovery Server if not present
NDI_DISCOVERY_PATHS=(
    "/usr/local/bin/ndi-discovery-server"
    "/usr/bin/ndi-discovery-server"
    "/opt/ndi/bin/ndi-discovery-server"
)

NDI_DISCOVERY_FOUND=false
for path in "${NDI_DISCOVERY_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        NDI_DISCOVERY_FOUND=true
        NDI_DISCOVERY_PATH="$path"
        print_status "Found NDI Discovery Server at: $path"
        break
    fi
done

if [[ "$NDI_DISCOVERY_FOUND" == false ]]; then
    print_warning "NDI Discovery Server not found. Checking for NDI Tools package..."
    
    # Try to install NDI Tools package if available
    if command -v apt-get &> /dev/null; then
        print_status "Attempting to install NDI Tools..."
        # Note: This may require adding NewTek repository
        apt-get update
        
        # Check if NDI repository is configured
        if ! grep -q "ndi" /etc/apt/sources.list.d/* 2>/dev/null; then
            print_warning "NDI repository not configured. Please install NDI Discovery Server manually:"
            print_warning "1. Download NDI Tools from https://ndi.video/tools/"
            print_warning "2. Install the package: sudo dpkg -i ndi-tools-*.deb"
            print_warning "3. Or compile from NDI SDK examples"
        else
            apt-get install -y ndi-discovery-server || true
        fi
    fi
fi

# Create NDI Discovery Server service if it doesn't exist
if [[ ! -f "/etc/systemd/system/ndi-discovery-server.service" ]]; then
    print_status "Creating NDI Discovery Server systemd service..."
    
    cat > /etc/systemd/system/ndi-discovery-server.service << EOF
[Unit]
Description=NDI Discovery Server
After=network.target avahi-daemon.service
Wants=network-online.target

[Service]
Type=simple
User=ndi-discovery
Group=ndi-discovery
ExecStart=/usr/local/bin/ndi-discovery-server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes

# NDI Environment
Environment=NDI_RUNTIME_DIR_V6=/usr/local/lib

[Install]
WantedBy=multi-user.target
EOF

    # Create user for NDI Discovery Server
    if ! id "ndi-discovery" &>/dev/null; then
        print_status "Creating NDI Discovery Server user..."
        useradd -r -s /bin/false -d /var/lib/ndi-discovery ndi-discovery
        mkdir -p /var/lib/ndi-discovery
        chown ndi-discovery:ndi-discovery /var/lib/ndi-discovery
    fi
fi

# Configure firewall for NDI Discovery
if command -v ufw &> /dev/null; then
    print_status "Configuring firewall for NDI Discovery..."
    ufw allow 5353/udp comment "mDNS/Bonjour for NDI Discovery"
    ufw allow 5959/tcp comment "NDI Discovery Server"
    ufw allow 5960:5989/tcp comment "NDI Streams"
    ufw allow 5960:5989/udp comment "NDI Streams"
fi

# Configure Avahi for better NDI discovery
print_status "Configuring Avahi for NDI..."
cat > /etc/avahi/avahi-daemon.conf << EOF
[server]
host-name-from-machine-id=no
domain-name=local
browse-domains=
use-ipv4=yes
use-ipv6=yes
allow-interfaces=
deny-interfaces=
check-response-ttl=no
use-iff-running=no
enable-dbus=yes
disallow-other-stacks=no
allow-point-to-point=no
cache-entries-max=4096
clients-max=4096
objects-per-client-max=1024
entries-per-entry-group-max=32
ratelimit-interval-usec=1000000
ratelimit-burst=1000

[wide-area]
enable-wide-area=yes

[publish]
disable-publishing=no
disable-user-service-publishing=no
add-service-cookie=no
publish-addresses=yes
publish-hinfo=yes
publish-workstation=yes
publish-domain=yes
publish-dns-servers=
publish-resolv-conf-dns-servers=yes
publish-aaaa-on-ipv4=yes
publish-a-on-ipv6=no

[reflector]
enable-reflector=no
reflect-ipv=no

[rlimits]
rlimit-as=
rlimit-core=0
rlimit-data=8388608
rlimit-fsize=0
rlimit-nofile=768
rlimit-stack=8388608
rlimit-nproc=3
EOF

# Create NDI environment configuration
print_status "Creating NDI environment configuration..."
cat > /etc/environment.d/ndi.conf << EOF
# NDI Runtime Environment
NDI_RUNTIME_DIR_V6=/usr/local/lib
NDI_GROUPS=
NDI_ACCESS_MANAGER_MODE=1
EOF

# Enable and start services
print_status "Enabling services..."
systemctl daemon-reload
systemctl enable avahi-daemon

if [[ -f "/etc/systemd/system/ndi-discovery-server.service" ]] && command -v ndi-discovery-server &> /dev/null; then
    systemctl enable ndi-discovery-server
    systemctl start ndi-discovery-server
    print_status "NDI Discovery Server started"
else
    print_warning "NDI Discovery Server service not started (binary not found)"
fi

systemctl restart avahi-daemon

# Test NDI discovery
print_status "Testing NDI discovery setup..."
sleep 3

if command -v ndi-discovery-server &> /dev/null; then
    if systemctl is-active --quiet ndi-discovery-server; then
        print_status "NDI Discovery Server is running"
    else
        print_warning "NDI Discovery Server failed to start"
        journalctl -u ndi-discovery-server --no-pager -n 10
    fi
else
    print_warning "NDI Discovery Server not installed"
fi

if systemctl is-active --quiet avahi-daemon; then
    print_status "Avahi daemon is running"
    
    # Test mDNS resolution
    if command -v avahi-browse &> /dev/null; then
        print_status "Available mDNS services (5 second scan):"
        timeout 5 avahi-browse -t _ndi._tcp || true
    fi
else
    print_error "Avahi daemon is not running"
fi

print_status "NDI Discovery setup completed!"
echo
print_status "Services status:"
print_status "- Avahi: $(systemctl is-active avahi-daemon)"
if command -v ndi-discovery-server &> /dev/null; then
    print_status "- NDI Discovery: $(systemctl is-active ndi-discovery-server)"
fi
echo
print_status "To troubleshoot NDI discovery:"
print_status "- Check logs: sudo journalctl -u ndi-discovery-server -f"
print_status "- Scan for NDI sources: ndi-directory-service (if available)"
print_status "- Check network: avahi-browse -a"
echo