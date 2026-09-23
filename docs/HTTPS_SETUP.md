# HTTPS Configuration Guide

## Overview
This document provides instructions for configuring HTTPS with TLS certificates, reverse proxy setup, and security headers for the CEO Dashboard ERP system.

## Prerequisites

### Domain Requirements
- Registered domain name (e.g., api.ceodashboard.com)
- DNS A record pointing to server IP
- DNS CAA record (optional, for certificate authority specification)

### Server Requirements
- Ubuntu 20.04+ or equivalent
- Root or sudo access
- Open ports: 80 (HTTP), 443 (HTTPS)
- Firewall configured to allow traffic

## Option 1: Let's Encrypt (Free SSL Certificate)

### Step 1: Install Certbot
```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx -y
```

### Step 2: Obtain SSL Certificate
```bash
# Obtain certificate (interactive mode)
sudo certbot --nginx -d api.ceodashboard.com -d www.api.ceodashboard.com

# Or with specific email
sudo certbot --nginx -d api.ceodashboard.com --email admin@ceodashboard.com --agree-tos --no-eff-email
```

### Step 3: Configure Nginx Reverse Proxy

Create Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/ceodashboard
```

Add the following configuration:
```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.ceodashboard.com www.api.ceodashboard.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    server_name api.ceodashboard.com www.api.ceodashboard.com;

    # SSL Certificate (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.ceodashboard.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ceodashboard.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Remove server version
    server_tokens off;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Body size limit
    client_max_body_size 10M;

    # Location block for API
    location / {
        proxy_pass http://localhost:3001;
        proxy_redirect off;
    }

    # Health check endpoint (no auth required)
    location /api/health {
        proxy_pass http://localhost:3001/api/health;
        access_log off;
    }

    # Readiness check endpoint
    location /ready {
        proxy_pass http://localhost:3001/ready;
        access_log off;
    }
}
```

### Step 4: Enable Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/ceodashboard /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5: Set Up Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up cron job for renewal
# Verify cron job exists
sudo systemctl status certbot.timer
```

## Option 2: Commercial SSL Certificate

### Step 1: Generate CSR
```bash
# Create directory for SSL certificates
sudo mkdir -p /etc/nginx/ssl

# Generate private key and CSR
sudo openssl req -new -newkey rsa:2048 -nodes -keyout /etc/nginx/ssl/ceodashboard.key -out /etc/nginx/ssl/ceodashboard.csr
```

### Step 2: Submit CSR to Certificate Authority
- Submit `ceodashboard.csr` to your CA
- Provide required verification information
- Receive signed certificate (.crt or .pem file)

### Step 3: Install Certificate
```bash
# Save certificate files
sudo cp your-certificate.crt /etc/nginx/ssl/ceodashboard.crt
sudo cp ca-bundle.crt /etc/nginx/ssl/ceodashboard-ca-bundle.crt

# Update Nginx configuration to use commercial certificate
# Update ssl_certificate and ssl_certificate_key paths
```

### Step 4: Update Nginx Configuration
```nginx
ssl_certificate /etc/nginx/ssl/ceodashboard.crt;
ssl_certificate_key /etc/nginx/ssl/ceodashboard.key;
ssl_trusted_certificate /etc/nginx/ssl/ceodashboard-ca-bundle.crt;
```

## Security Headers Explained

### Strict-Transport-Security (HSTS)
- **Purpose**: Enforces HTTPS connections
- **Value**: `max-age=31536000; includeSubDomains; preload`
- **Effect**: Browser will only use HTTPS for 1 year

### X-Frame-Options
- **Purpose**: Prevents clickjacking attacks
- **Value**: `SAMEORIGIN`
- **Effect**: Only allows framing from same origin

### X-Content-Type-Options
- **Purpose**: Prevents MIME sniffing
- **Value**: `nosniff`
- **Effect**: Browser respects declared content type

### X-XSS-Protection
- **Purpose**: Enables XSS filtering
- **Value**: `1; mode=block`
- **Effect**: Blocks detected XSS attacks

### Referrer-Policy
- **Purpose**: Controls referrer information
- **Value**: `strict-origin-when-cross-origin`
- **Effect**: Only sends origin as referrer to same-origin requests

### Content-Security-Policy (CSP)
- **Purpose**: Restricts resource loading
- **Value**: Customized based on application needs
- **Effect**: Prevents various injection attacks

### Permissions-Policy
- **Purpose**: Controls browser features
- **Value**: `geolocation=(), microphone=(), camera=()`
- **Effect**: Disables sensitive browser features

## Testing HTTPS Configuration

### SSL/TLS Test
```bash
# Test SSL configuration
openssl s_client -connect api.ceodashboard.com:443 -tls1_2
openssl s_client -connect api.ceodashboard.com:443 -tls1_3
```

### Security Headers Test
```bash
# Check security headers
curl -I https://api.ceodashboard.com

# Or use online tools
# https://securityheaders.com/
# https://www.ssllabs.com/ssltest/
```

### Certificate Information
```bash
# View certificate details
openssl x509 -in /etc/letsencrypt/live/api.ceodashboard.com/cert.pem -text -noout

# Check certificate expiration
echo | openssl s_client -servername api.ceodashboard.com -connect api.ceodashboard.com:443 2>/dev/null | openssl x509 -noout -dates
```

## Firewall Configuration

### UFW (Uncomplicated Firewall)
```bash
# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### AWS Security Groups
```bash
# Add inbound rules for HTTP and HTTPS
# Port 80 (HTTP) - Source: 0.0.0.0/0
# Port 443 (HTTPS) - Source: 0.0.0.0/0
```

## Monitoring and Maintenance

### Certificate Expiry Monitoring
```bash
# Add to cron job for monitoring
0 0 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

### SSL Certificate Rotation
- Let's Encrypt: Auto-renews 30 days before expiry
- Commercial: Manual renewal before expiry
- Monitor expiry dates regularly

### Nginx Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Certificate Issues
```bash
# Check certificate validity
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal
```

### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx
```

### Mixed Content Warnings
- Ensure all resources use HTTPS
- Update API endpoints to use HTTPS
- Update CDN URLs to use HTTPS

## Performance Optimization

### HTTP/2
```nginx
# Already enabled in configuration
listen 443 ssl http2;
```

### SSL Session Cache
```nginx
# Already configured
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### OCSP Stapling
```nginx
# Add to server block
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/api.ceodashboard.com/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

## Application Configuration Updates

### Update Environment Variables
```bash
# Update backend configuration
NODE_ENV=production
API_URL=https://api.ceodashboard.com
FRONTEND_URL=https://ceodashboard.com
```

### Update CORS Configuration
```bash
# Update allowed origins in config
CORS_ALLOWED_ORIGINS=https://ceodashboard.com,https://www.ceodashboard.com
```

## Compliance Notes

### PCI DSS Requirements
- Use TLS 1.2 or higher
- Strong cipher suites
- Valid SSL certificates
- Regular certificate renewal

### GDPR Requirements
- Encrypt data in transit
- Secure communication channels
- Proper certificate management

## Contact Information

- **SSL Certificate Provider**: Let's Encrypt / [Commercial CA]
- **Domain Registrar**: [Registrar]
- **DNS Provider**: [Provider]
- **Server Administrator**: [Contact]
