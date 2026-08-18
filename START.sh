#!/bin/bash

# FleetPro SaaS Platform - Startup Script
# Usage: ./START.sh

set -e

cd "$(dirname "$0")"

echo "🚀 FleetPro SaaS Platform v1.0"
echo "================================"
echo ""

# Kill existing processes
echo "🔄 Cleaning up old processes..."
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

# Build
echo "🔨 Building application..."
npm run build > /dev/null 2>&1

# Start server
echo "⏳ Starting server on port 5051..."
PORT=5051 npm run dev &
SERVER_PID=$!

sleep 8

# Verify server is running
echo ""
if curl -sk https://localhost:5051/health > /dev/null 2>&1; then
  echo "✅ Server is running on https://localhost:5051"
  echo ""
  echo "📖 QUICKSTART:"
  echo "  1. Open browser: https://localhost:5051/api/simple-login-page"
  echo "  2. Login with:"
  echo "     Email: root@fleetpro.local"
  echo "     Password: password"
  echo ""
  echo "📚 Documentation:"
  echo "  • QUICKSTART.md - Full setup guide"
  echo "  • README.md - Project overview"
  echo ""
  echo "🔗 Useful URLs:"
  echo "  • Login: https://localhost:5051/api/simple-login-page"
  echo "  • Dashboard: https://localhost:5051/simple-dashboard"
  echo "  • Health: https://localhost:5051/health"
  echo ""
  echo "💡 Tip: Keep this terminal open. Server will auto-restart on crash."
  echo ""
  wait $SERVER_PID
else
  echo "❌ Server failed to start. Check logs:"
  echo "   tail -50 /tmp/server-5051.log"
  exit 1
fi
