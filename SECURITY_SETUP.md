# NDI Web Router - Security Setup Guide

## Overview

The NDI Web Router now includes a comprehensive authentication and authorization system to secure your NDI routing operations. This guide will help you set up and configure the security features.

## Security Features

### ✅ What's Implemented

1. **Session-Based Authentication**
   - Secure login/logout system
   - Session tokens with 24-hour expiration
   - Automatic session cleanup

2. **Role-Based Access Control**
   - **Admin**: Full access including user management
   - **Operator**: Can manage routes and sources (no user management)
   - **Viewer**: Read-only access to sources and routes

3. **Secure Password Storage**
   - SHA-256 hashing with random salt
   - No plaintext passwords stored

4. **Protected API Endpoints**
   - Authentication required for all operations
   - Permission checks based on user roles

## Installation Requirements

### Additional Dependencies

The authentication system requires these additional libraries:

**Windows:**
```bash
# You'll need to install these libraries:
# - SQLite3 (for user database)
# - OpenSSL (for password hashing)

# Using vcpkg (recommended):
vcpkg install sqlite3:x64-windows
vcpkg install openssl:x64-windows
```

**Ubuntu/Linux:**
```bash
# Install required packages
sudo apt-get update
sudo apt-get install libsqlite3-dev libssl-dev

# If using the provided scripts:
./scripts/install-linux.sh
```

## Building with Authentication

### 1. Update CMakeLists.txt
The CMakeLists.txt has been updated to include:
- SQLite3 library linking
- OpenSSL library linking  
- Authentication source files

### 2. Build the Project
```bash
# Windows
build.bat

# Linux/Ubuntu
mkdir build && cd build
cmake ..
make
```

### 3. Build Frontend
```bash
cd frontend
npm install
npm run build  # For production
# or
npm run dev    # For development
```

## Default Credentials

**⚠️ IMPORTANT:** Change these default credentials after first login!

```
Username: admin
Password: admin123
```

## First-Time Setup

### 1. Start the Application
```bash
# Start the backend (from build directory)
./ndi_router_v2.exe

# Start the frontend (development)
cd frontend && npm run dev
```

### 2. Access the Login Page
Navigate to `http://localhost:3000` - you'll see the login form instead of direct access to the router.

### 3. Login and Create Users
1. Login with default admin credentials
2. Click the Settings (⚙️) button in the top-right
3. Go to "User Management" tab
4. Create additional users with appropriate roles
5. **Change the admin password** (delete and recreate the admin user)

## User Management

### Creating Users
1. Access Admin Panel (Settings button)
2. Click "Add User"
3. Enter username, password, and select role
4. Click "Create User"

### User Roles Explained

| Role | Permissions |
|------|-------------|
| **Admin** | • Full system access<br>• Create/delete users<br>• Manage all routes<br>• View all sources |
| **Operator** | • Manage NDI routes<br>• Create/modify destinations<br>• View sources<br>• Cannot manage users |
| **Viewer** | • View sources and routes<br>• Read-only access<br>• Cannot modify anything |

## API Authentication

### For Automated Systems
If you need to integrate with automated systems, you can:

1. Create a dedicated user account
2. Use the login endpoint to get a session token
3. Include the token in API requests

```bash
# Login to get session token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_user","password":"your_password"}'

# Use the returned sessionId in subsequent requests
curl -X GET http://localhost:8080/api/sources \
  -H "Authorization: Bearer YOUR_SESSION_ID"
```

## Security Best Practices

### 1. Change Default Credentials
- Delete the default admin user after creating a new admin account
- Use strong passwords (minimum 8 characters)

### 2. Regular Maintenance
- Review user accounts periodically
- Remove unused accounts
- Monitor login activity (check console logs)

### 3. Network Security
- Use HTTPS in production (configure reverse proxy)
- Restrict network access to authorized devices
- Consider VPN for remote access

### 4. Database Security
- The SQLite database (`ndi_users.db`) contains hashed passwords
- Backup this file securely
- Protect file system access to the application directory

## Troubleshooting

### Build Issues
```bash
# If SQLite3 not found on Windows
# Install via vcpkg or specify paths manually in CMakeLists.txt

# If OpenSSL not found
# Ensure OpenSSL development packages are installed
```

### Login Issues
```bash
# Check console logs for detailed error messages
# Verify database was created (ndi_users.db should exist)
# Ensure default admin user was created on first startup
```

### Permission Issues
- Verify user roles are set correctly
- Check that the user has permission for the specific action
- Admin users have all permissions

## Database Schema

The authentication system creates these tables:

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

## Production Deployment

### 1. Secure Configuration
- Change default passwords immediately
- Use environment variables for sensitive configuration
- Set up HTTPS with proper SSL certificates

### 2. Monitoring
- Monitor failed login attempts
- Set up log rotation
- Regular security updates

### 3. Backup Strategy
- Regular backups of user database
- Document recovery procedures
- Test backup restoration

## Support

For security-related issues:
1. Check the console output for detailed error messages
2. Verify all dependencies are properly installed
3. Ensure proper file permissions for database files
4. Review this guide for configuration steps

The authentication system provides enterprise-grade security for your NDI routing operations while maintaining the ease of use you expect from the NDI Web Router.