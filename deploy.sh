#!/bin/bash

set -e

echo "🚀 Mojo Chatbot Polished - Deployment Script"
echo "=============================================="
echo ""

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  Warning: ANTHROPIC_API_KEY not set"
  echo "   Set it with: export ANTHROPIC_API_KEY='sk-ant-...'"
  echo "   Or create a .env file in the root directory"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Generate random URL path
RANDOM_PATH=$(openssl rand -hex 12)
echo "📍 Generated random URL: /mojo-demo-$RANDOM_PATH"
echo ""

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --production
cd ..

echo ""
echo "✅ Installation complete!"
echo ""

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
  echo "🔄 PM2 detected - Setting up with PM2..."
  
  # Stop existing instance if running
  pm2 delete mojo-chatbot-pro 2>/dev/null || true
  
  # Create ecosystem config
  cat > ecosystem.config.js << EOFPM2
module.exports = {
  apps: [{
    name: 'mojo-chatbot-pro',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3456,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
    }
  }]
};
EOFPM2
  
  # Start with PM2
  pm2 start ecosystem.config.js
  pm2 save
  
  echo ""
  echo "✅ Started with PM2!"
  echo ""
  echo "PM2 Commands:"
  echo "  pm2 logs mojo-chatbot-pro    # View logs"
  echo "  pm2 restart mojo-chatbot-pro # Restart"
  echo "  pm2 stop mojo-chatbot-pro    # Stop"
  echo "  pm2 delete mojo-chatbot-pro  # Remove"
  echo ""
else
  echo "ℹ️  PM2 not installed. Running directly..."
  echo "   Install PM2: npm install -g pm2"
  echo ""
fi

echo "🌐 Access Options:"
echo ""
echo "1. Direct Access:"
echo "   http://localhost:3456"
echo ""
echo "2. Nginx Reverse Proxy (recommended for production):"
echo "   Add to your Nginx config:"
echo ""
echo "   location /mojo-demo-$RANDOM_PATH {"
echo "     proxy_pass http://localhost:3456;"
echo "     proxy_http_version 1.1;"
echo "     proxy_set_header Upgrade \$http_upgrade;"
echo "     proxy_set_header Connection 'upgrade';"
echo "     proxy_set_header Host \$host;"
echo "     proxy_cache_bypass \$http_upgrade;"
echo "   }"
echo ""
echo "   Then: sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "3. Access via: http://YOUR_AWS_IP/mojo-demo-$RANDOM_PATH"
echo ""

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  Remember to set ANTHROPIC_API_KEY before using!"
fi

echo "📚 Documentation: See README.md and DEPLOYMENT.md"
echo ""
echo "🎉 Deployment complete!"
