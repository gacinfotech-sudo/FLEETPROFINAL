#!/bin/bash

# Setup local HTTPS certificates for development
# Creates self-signed certificates for localhost and 127.0.0.1

set -e

echo "🔒 FleetPro Local HTTPS Setup"
echo "========================================"

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL is not installed"
    echo "On macOS: brew install openssl"
    echo "On Ubuntu/Debian: sudo apt-get install openssl"
    exit 1
fi

# Check if certificates already exist
if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
    echo "✅ Certificates already exist at ssl/cert.pem and ssl/key.pem"
    exit 0
fi

echo "📝 Generating self-signed certificate for localhost development..."

# Generate self-signed certificate valid for 365 days
# This certificate is for local development only
openssl req -x509 \
    -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -days 365 \
    -nodes \
    -subj "/C=US/ST=Development/L=Local/O=FleetPro/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,DNS:*.localhost"

echo "✅ Certificates generated successfully!"
echo ""
echo "📁 Certificates location:"
echo "   - Private key: ssl/key.pem"
echo "   - Certificate: ssl/cert.pem"
echo ""
echo "🌐 Your local server will use HTTPS:"
echo "   - https://localhost:5050"
echo "   - https://127.0.0.1:5050"
echo ""
echo "⚠️  Browser Certificate Warning (Expected):"
echo "   - You may see a certificate warning when accessing the URL"
echo "   - This is normal for self-signed certificates"
echo "   - Click 'Advanced' → 'Proceed to localhost' in your browser"
echo ""
echo "✨ To trust this certificate locally on macOS:"
echo "   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl/cert.pem"
echo ""
echo "🔐 For production, use a real certificate from a Certificate Authority (Let's Encrypt, etc.)"
echo ""

# Set proper permissions
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem

echo "✅ Setup complete! Start the server with: npm start"
