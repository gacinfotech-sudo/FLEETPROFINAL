#!/bin/bash

###############################################################################
# FleetPro Health Monitor Script
# Purpose: Continuous monitoring of production health
# Usage: ./scripts/health-monitor.sh [interval]
# Example: ./scripts/health-monitor.sh 30 (check every 30 seconds)
###############################################################################

set -e

# Configuration
INTERVAL="${1:-30}"
API_URL="${API_URL:-http://localhost:3000}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
LOG_FILE="./logs/health-monitor.log"
METRICS_FILE="./logs/metrics.json"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Thresholds
ERROR_RATE_THRESHOLD=0.1  # 10%
RESPONSE_TIME_THRESHOLD=1000  # 1 second
MEMORY_THRESHOLD=512  # MB
CPU_THRESHOLD=80  # percentage

# State tracking
LAST_ALERT_TIME=0
CONSECUTIVE_FAILURES=0
ALERT_COOLDOWN=300  # 5 minutes

###############################################################################
# Helper Functions
###############################################################################

log_message() {
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

print_status() {
    local status="$1"
    local message="$2"

    case "$status" in
        "ok")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "warning")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "error")
            echo -e "${RED}✗${NC} $message"
            ;;
        "info")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
    esac
}

send_alert() {
    local message="$1"
    local severity="$2"

    log_message "ALERT [$severity]: $message"

    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$message\",\"severity\":\"$severity\"}" \
            2>/dev/null || true
    fi
}

###############################################################################
# Health Check Functions
###############################################################################

check_liveness() {
    local start_time=$(date +%s%N)

    if response=$(curl -s -m 5 "$API_URL/health" 2>/dev/null); then
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to ms

        if echo "$response" | grep -q "ok"; then
            print_status "ok" "Liveness check passed (${response_time}ms)"
            CONSECUTIVE_FAILURES=0
            return 0
        fi
    fi

    ((CONSECUTIVE_FAILURES++))
    print_status "error" "Liveness check failed (attempt $CONSECUTIVE_FAILURES)"

    if [ $CONSECUTIVE_FAILURES -ge 3 ]; then
        send_alert "Application liveness check failed 3 times consecutively" "critical"
    fi

    return 1
}

check_readiness() {
    if response=$(curl -s -m 5 "$API_URL/ready" 2>/dev/null); then
        if echo "$response" | grep -q "ready\|connected"; then
            print_status "ok" "Readiness check passed"
            return 0
        fi
    fi

    print_status "error" "Readiness check failed"
    send_alert "Application is not ready" "warning"
    return 1
}

check_response_time() {
    local response_time=$(curl -s -m 10 \
        -w "%{time_total}" \
        -o /dev/null \
        "$API_URL/health" 2>/dev/null)

    if [ -n "$response_time" ]; then
        local response_time_ms=$(echo "scale=0; $response_time * 1000" | bc 2>/dev/null || echo "0")

        if [ "$response_time_ms" -lt "$RESPONSE_TIME_THRESHOLD" ]; then
            print_status "ok" "Response time: ${response_time_ms}ms"
            return 0
        else
            print_status "warning" "Response time is slow: ${response_time_ms}ms"
            send_alert "Response time exceeded threshold: ${response_time_ms}ms" "warning"
            return 1
        fi
    else
        print_status "error" "Could not measure response time"
        return 1
    fi
}

check_metrics() {
    if metrics=$(curl -s -m 5 "$API_URL/metrics" 2>/dev/null); then
        # Save metrics to file
        echo "$metrics" > "$METRICS_FILE"

        # Extract memory usage (if available)
        if echo "$metrics" | grep -q "heapUsed"; then
            memory_heap=$(echo "$metrics" | grep -oP '"heapUsed":\s*\K[0-9]+' | head -1)

            if [ -n "$memory_heap" ]; then
                memory_mb=$(echo "scale=0; $memory_heap / 1048576" | bc)

                if [ "$memory_mb" -lt "$MEMORY_THRESHOLD" ]; then
                    print_status "ok" "Memory usage: ${memory_mb}MB"
                else
                    print_status "warning" "High memory usage: ${memory_mb}MB"
                    send_alert "Memory usage exceeded threshold: ${memory_mb}MB" "warning"
                fi
            fi
        fi

        print_status "ok" "Metrics available"
        return 0
    else
        print_status "error" "Could not fetch metrics"
        return 1
    fi
}

check_database() {
    if [ -z "$DB_HOST" ]; then
        return 0
    fi

    if timeout 5 psql -h "$DB_HOST" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT 1;" &>/dev/null; then
        print_status "ok" "Database is accessible"
        return 0
    else
        print_status "error" "Database is not accessible"
        send_alert "Database connection failed" "critical"
        return 1
    fi
}

check_api_endpoints() {
    local endpoints=(
        "/health"
        "/ready"
        "/metrics"
    )

    for endpoint in "${endpoints[@]}"; do
        if response=$(curl -s -m 5 "$API_URL$endpoint" 2>/dev/null); then
            print_status "ok" "Endpoint $endpoint is accessible"
        else
            print_status "warning" "Endpoint $endpoint is not accessible"
        fi
    done
}

###############################################################################
# Monitoring Loop
###############################################################################

start_monitoring() {
    log_message "Health monitoring started (interval: ${INTERVAL}s)"
    print_status "info" "Monitoring $API_URL every ${INTERVAL} seconds"
    print_status "info" "Press Ctrl+C to stop"

    while true; do
        clear
        echo -e "${BLUE}FleetPro Health Monitor${NC}"
        echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "API URL: $API_URL"
        echo "Interval: ${INTERVAL}s"
        echo ""

        # Run all checks
        check_liveness
        check_readiness
        check_response_time
        check_metrics
        check_database
        check_api_endpoints

        echo ""
        echo -e "${GRAY}Next check in $INTERVAL seconds (press Ctrl+C to stop)${NC}"

        # Wait for next interval
        sleep "$INTERVAL"
    done
}

###############################################################################
# Report Functions
###############################################################################

print_report() {
    print_status "info" "Generating health report"

    if [ ! -f "$LOG_FILE" ]; then
        echo "No health data available yet"
        return
    fi

    echo ""
    echo -e "${BLUE}=== Health Report ===${NC}"
    echo ""

    # Count errors and warnings
    total_errors=$(grep -c "ALERT" "$LOG_FILE" 2>/dev/null || echo "0")
    critical_alerts=$(grep -c "critical" "$LOG_FILE" 2>/dev/null || echo "0")
    warning_alerts=$(grep -c "warning" "$LOG_FILE" 2>/dev/null || echo "0")

    echo "Total Alerts: $total_errors"
    echo "  Critical: $critical_alerts"
    echo "  Warning: $warning_alerts"
    echo ""

    echo "Recent Events:"
    tail -10 "$LOG_FILE" 2>/dev/null || echo "No events logged"
}

###############################################################################
# Cleanup
###############################################################################

cleanup() {
    log_message "Health monitoring stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

###############################################################################
# Main Execution
###############################################################################

main() {
    # Create log directory if needed
    mkdir -p "$(dirname "$LOG_FILE")"

    # Handle command line arguments
    case "${1:-}" in
        "report")
            print_report
            ;;
        "start")
            start_monitoring
            ;;
        *)
            start_monitoring
            ;;
    esac
}

# Run main function
main "$@"
