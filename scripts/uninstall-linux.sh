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

echo "Uninstalling NDI Web Router..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Stop and disable services
print_status "Stopping and disabling services..."
systemctl stop ndi-web-router 2>/dev/null || true
systemctl disable ndi-web-router 2>/dev/null || true

# Remove systemd service files
print_status "Removing systemd service files..."
rm -f /etc/systemd/system/ndi-web-router.service
systemctl daemon-reload

# Remove nginx configuration
print_status "Removing nginx configuration..."
rm -f /etc/nginx/sites-enabled/ndi-web-router
rm -f /etc/nginx/sites-available/ndi-web-router
systemctl reload nginx 2>/dev/null || true

# Remove application files
print_status "Removing application files..."
rm -rf /opt/ndi-web-router

# Remove configuration files
print_status "Removing configuration files..."
rm -rf /etc/ndi-web-router

# Remove log files
print_status "Removing log files..."
rm -rf /var/log/ndi-web-router

# Remove Avahi service
print_status "Removing network discovery configuration..."
rm -f /etc/avahi/services/ndi-web-router.service
systemctl restart avahi-daemon 2>/dev/null || true

# Remove user account
print_status "Removing service user..."
if id "ndi-router" &>/dev/null; then
    userdel ndi-router 2>/dev/null || true
fi

# Remove firewall rules (optional)
if command -v ufw &> /dev/null; then
    print_warning "Firewall rules for NDI Web Router are still active."
    print_warning "To remove them manually, run:"
    print_warning "  sudo ufw delete allow 80/tcp"
    print_warning "  sudo ufw delete allow 5353/udp"
    print_warning "  sudo ufw delete allow 5960:5989/tcp"
    print_warning "  sudo ufw delete allow 5960:5989/udp"
fi

print_status "Uninstallation completed successfully!"
echo
print_warning "The following items were NOT removed:"
print_warning "- NDI SDK (system-wide installation)"
print_warning "- System packages (nginx, avahi-daemon, etc.)"
print_warning "- Firewall rules (manual removal required)"
echo
print_status "To completely clean up the system:"
print_status "1. Remove NDI SDK if no longer needed"
print_status "2. Remove system packages: sudo apt remove nginx avahi-daemon (if not used by other services)"
print_status "3. Remove firewall rules using the commands shown above"
echo