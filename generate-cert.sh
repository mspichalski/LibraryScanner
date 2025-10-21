#!/bin/bash

# Generate self-signed SSL certificate for HTTPS support
# This enables camera access from mobile devices

echo "🔐 Generating Self-Signed SSL Certificate..."
echo ""

# Get local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux/Raspberry Pi
    LOCAL_IP=$(hostname -I | awk '{print $1}')
else
    LOCAL_IP="localhost"
fi

echo "Your local IP appears to be: $LOCAL_IP"
echo ""

# Generate certificate
openssl req -nodes -new -x509 \
    -keyout server.key \
    -out server.cert \
    -days 365 \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$LOCAL_IP"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Certificate generated successfully!"
    echo ""
    echo "Files created:"
    echo "  - server.key (private key)"
    echo "  - server.cert (certificate)"
    echo ""
    echo "Next steps:"
    echo "1. Start the server: npm start"
    echo "2. Access via HTTPS: https://$LOCAL_IP:3443"
    echo "3. Accept the security warning in your browser"
    echo ""
    echo "📱 On your phone, you'll need to accept the certificate warning once."
    echo ""
else
    echo "❌ Error generating certificate"
    exit 1
fi

