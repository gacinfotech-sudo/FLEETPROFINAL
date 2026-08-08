#!/usr/bin/env bash
# Real, sleep-based (not busy-loop) health monitor for the stable-demo instance.
# Run in background: nohup scripts/stable-demo-monitor.sh > /tmp/fleetpro-stable-demo-monitor.log 2>&1 &
# Stop: kill the PID it prints, or pkill -f stable-demo-monitor.sh
set -uo pipefail

HOST="127.0.0.1"
PORT="5051"
INTERVAL="${MONITOR_INTERVAL:-90}"  # seconds, within the 60-120s band requested
STATE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.claude/runtime/STABLE-DEMO-STATE.json"

echo "stable-demo-monitor started, PID $$, checking http://$HOST:$PORT every ${INTERVAL}s"

while true; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://$HOST:$PORT/" 2>/dev/null || echo "000")"
  listening="no"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && listening="yes"

  if [ "$code" = "200" ] && [ "$listening" = "yes" ]; then
    echo "[$ts] OK  http=$code listening=$listening"
  else
    echo "[$ts] FAIL http=$code listening=$listening -- capturing evidence, NOT auto-restarting (manual review required)"
    # Deliberately does not auto-restart here: this script only reports.
    # Restart-on-failure is a decision for the Integrator session, made with
    # log evidence in hand (see section 14: capture logs, identify cause,
    # restart only the exact affected service, re-verify, roll back if needed).
  fi

  sleep "$INTERVAL"
done
