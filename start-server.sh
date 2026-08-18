#!/bin/bash

# FleetPro Server Startup Script - Permanent Solution
# This script keeps the server running permanently

set -e

cd /Users/pradeep/fleetpro-final-recovery

echo "🚀 FleetPro Server - Permanent Startup"
echo "======================================"
echo ""

# Kill any existing processes
echo "Cleaning up old processes..."
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

# Build
echo "Building application..."
npm run build > /dev/null 2>&1

# Start server with restart on crash
echo "Starting server..."
echo ""

while true; do
  echo "[$(date '+%H:%M:%S')] Starting server..."
  npm run dev 2>&1 &
  SERVER_PID=$!

  echo "[$(date '+%H:%M:%S')] Server PID: $SERVER_PID"

  # Wait for server to start
  sleep 5

  # Check if server is responding
  if curl -sk https://localhost:5050/health > /dev/null 2>&1; then
    echo "[$(date '+%H:%M:%S')] ✅ Server is running on https://localhost:5050"
    echo ""
    echo "LOGIN CREDENTIALS:"
    echo "  Email:    root@fleetpro.local"
    echo "  Password: password"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""
  else
    echo "[$(date '+%H:%M:%S')] ⚠️  Server not responding, will retry..."
  fi

  # Wait for process
  wait $SERVER_PID 2>/dev/null || true

  echo "[$(date '+%H:%M:%S')] Server stopped, restarting in 3 seconds..."
  sleep 3
done
