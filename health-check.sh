#!/bin/bash

echo "🏥 FLEETPRO HEALTH CHECK"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Check 1: Process
echo "1️⃣  Process Status..."
if ps aux | grep "node.*index" | grep -v grep > /dev/null; then
  PID=$(pgrep -f 'node.*index')
  echo "   ✅ Running (PID: $PID)"
else
  echo "   ❌ NOT RUNNING"
  exit 1
fi

# Check 2: Port
echo ""
echo "2️⃣  Port Status..."
if lsof -i :5050 > /dev/null 2>&1; then
  echo "   ✅ Port 5050 listening"
else
  echo "   ❌ Port 5050 not listening"
  exit 1
fi

# Check 3: API
echo ""
echo "3️⃣  API Connectivity..."
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:5050/api/csrf-token 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ API responding (HTTP 200)"
else
  echo "   ❌ API error (HTTP $HTTP_CODE)"
fi

# Check 4: Database
echo ""
echo "4️⃣  Database Connectivity..."
if mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
  echo "   ✅ MongoDB connected"
else
  echo "   ⚠️  MongoDB check inconclusive"
fi

# Check 5: Memory
echo ""
echo "5️⃣  Memory Usage..."
MEM=$(ps aux | grep "node.*index" | grep -v grep | awk '{print $6}')
if [ ! -z "$MEM" ]; then
  echo "   ✅ Memory: ${MEM} KB"
else
  echo "   ⚠️  Could not determine memory"
fi

# Check 6: CPU
echo ""
echo "6️⃣  CPU Usage..."
CPU=$(ps aux | grep "node.*index" | grep -v grep | awk '{print $3}')
if [ ! -z "$CPU" ]; then
  echo "   ✅ CPU: ${CPU}%"
else
  echo "   ⚠️  Could not determine CPU"
fi

# Check 7: Git
echo ""
echo "7️⃣  Git Status..."
COMMITS=$(cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main && git log --oneline 2>/dev/null | wc -l)
echo "   ✅ Commits: $COMMITS"

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "✅ HEALTH CHECK COMPLETE"
echo ""

