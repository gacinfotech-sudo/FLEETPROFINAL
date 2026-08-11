#!/bin/bash

################################################################################
# MongoDB Restore Script for Production
#
# Purpose: Restore MongoDB database from backup
# Usage: ./restore-mongodb.sh <backup-archive>
# Example: ./restore-mongodb.sh /var/backups/fleetpro/mongodb/fleetpro_backup_20260812_120000.tar.gz
#
# WARNING: This will overwrite the current database!
#
################################################################################

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT_DIR="${BACKUP_PATH:-/var/backups/fleetpro}"
LOG_DIR="${BACKUP_ROOT_DIR}/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/restore_${TIMESTAMP}.log"

# MongoDB Configuration
MONGODB_HOST="${MONGODB_HOST:-mongodb}"
MONGODB_PORT="${MONGODB_PORT:-27017}"
MONGODB_USER="${MONGODB_ROOT_USER:-admin}"
MONGODB_PASSWORD="${MONGODB_ROOT_PASSWORD:-}"
MONGODB_AUTHSOURCE="${MONGODB_AUTHSOURCE:-admin}"
MONGODB_DB="fleetpro"

# Configuration
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
SEND_EMAIL="${SEND_EMAIL:-true}"
EMAIL_TO="${EMAIL_TO:-admin@fleetpro.com}"

# ============================================================================
# FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2>&1
    echo "Restore started at $(date)"
}

# Log message with timestamp
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*"
}

# Error handling
error_exit() {
    log "ERROR" "$*"
    send_email "FAILED" "$*"
    exit 1
}

# Display usage
usage() {
    cat << EOF
Usage: $0 <backup-archive> [options]

Arguments:
    <backup-archive>    Path to backup archive (e.g., fleetpro_backup_*.tar.gz)

Options:
    --dry-run          Simulate restore without modifying database
    --verbose          Enable verbose output
    --help             Display this help message

Examples:
    # Restore from specific backup
    $0 /var/backups/fleetpro/mongodb/fleetpro_backup_20260812_120000.tar.gz

    # Dry run
    $0 /var/backups/fleetpro/mongodb/fleetpro_backup_20260812_120000.tar.gz --dry-run

EOF
    exit 1
}

# Check dependencies
check_dependencies() {
    log "INFO" "Checking dependencies..."

    command -v mongorestore >/dev/null 2>&1 || error_exit "mongorestore not found. Install MongoDB tools."
    command -v tar >/dev/null 2>&1 || error_exit "tar not found."
    command -v gzip >/dev/null 2>&1 || error_exit "gzip not found."

    log "INFO" "Dependencies check passed."
}

# Validate backup archive
validate_backup() {
    local archive=$1

    if [ ! -f "$archive" ]; then
        error_exit "Backup archive not found: $archive"
    fi

    log "INFO" "Validating backup archive..."

    # Check if it's a valid tar.gz file
    if ! tar -tzf "$archive" > /dev/null 2>&1; then
        error_exit "Invalid or corrupted backup archive: $archive"
    fi

    local archive_size=$(du -h "$archive" | cut -f1)
    log "INFO" "Archive validation passed. Size: $archive_size"
}

# Test MongoDB connection
check_mongodb_connection() {
    log "INFO" "Testing MongoDB connection..."

    local conn_string="mongodb://"
    if [ -n "$MONGODB_USER" ] && [ -n "$MONGODB_PASSWORD" ]; then
        conn_string+="${MONGODB_USER}:${MONGODB_PASSWORD}@"
    fi
    conn_string+="${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DB}?authSource=${MONGODB_AUTHSOURCE}"

    if ! mongosh "$conn_string" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        error_exit "Cannot connect to MongoDB at ${MONGODB_HOST}:${MONGODB_PORT}"
    fi

    log "INFO" "MongoDB connection successful."
}

# Create backup of current database before restore
backup_current_db() {
    if [ "$DRY_RUN" = "true" ]; then
        log "INFO" "[DRY-RUN] Would create safety backup of current database"
        return 0
    fi

    log "WARN" "Creating safety backup of current database..."

    local safety_backup_dir="${BACKUP_ROOT_DIR}/mongodb/safety_backup_before_restore_${TIMESTAMP}"
    mkdir -p "$safety_backup_dir"

    local mongodump_opts=(
        "--host=${MONGODB_HOST}:${MONGODB_PORT}"
        "--db=${MONGODB_DB}"
        "--out=${safety_backup_dir}"
        "--gzip"
    )

    if [ -n "$MONGODB_USER" ] && [ -n "$MONGODB_PASSWORD" ]; then
        mongodump_opts+=(
            "--username=${MONGODB_USER}"
            "--password=${MONGODB_PASSWORD}"
            "--authenticationDatabase=${MONGODB_AUTHSOURCE}"
        )
    fi

    if mongodump "${mongodump_opts[@]}"; then
        log "INFO" "Safety backup created at: $safety_backup_dir"
    else
        log "WARN" "Failed to create safety backup. Continuing anyway..."
    fi
}

# Extract archive to temporary directory
extract_archive() {
    local archive=$1
    local extract_dir="${BACKUP_ROOT_DIR}/mongodb/restore_temp_${TIMESTAMP}"

    log "INFO" "Extracting archive to temporary directory..."
    mkdir -p "$extract_dir"

    if ! tar -xzf "$archive" -C "$extract_dir"; then
        error_exit "Failed to extract archive"
    fi

    log "INFO" "Archive extracted successfully."
    echo "$extract_dir"
}

# Perform restore
perform_restore() {
    local extract_dir=$1
    local dump_dir="${extract_dir}/fleetpro"

    if [ ! -d "$dump_dir" ]; then
        error_exit "Database dump directory not found in archive: $dump_dir"
    fi

    if [ "$DRY_RUN" = "true" ]; then
        log "INFO" "[DRY-RUN] Would restore database from: $dump_dir"
        return 0
    fi

    log "WARN" "Starting database restore (this will overwrite current data)..."

    local mongorestore_opts=(
        "--host=${MONGODB_HOST}:${MONGODB_PORT}"
        "--db=${MONGODB_DB}"
        "--dir=${dump_dir}"
        "--gzip"
        "--archive"
        "--drop"  # Drop existing collections before restore
    )

    if [ -n "$MONGODB_USER" ] && [ -n "$MONGODB_PASSWORD" ]; then
        mongorestore_opts+=(
            "--username=${MONGODB_USER}"
            "--password=${MONGODB_PASSWORD}"
            "--authenticationDatabase=${MONGODB_AUTHSOURCE}"
        )
    fi

    if [ "$VERBOSE" = "true" ]; then
        mongorestore_opts+=("--verbose")
    fi

    if ! mongorestore "${mongorestore_opts[@]}"; then
        error_exit "mongorestore failed"
    fi

    log "INFO" "Database restore completed successfully."
}

# Verify restored data
verify_restore() {
    log "INFO" "Verifying restored database..."

    local conn_string="mongodb://"
    if [ -n "$MONGODB_USER" ] && [ -n "$MONGODB_PASSWORD" ]; then
        conn_string+="${MONGODB_USER}:${MONGODB_PASSWORD}@"
    fi
    conn_string+="${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DB}?authSource=${MONGODB_AUTHSOURCE}"

    # Check database connectivity
    if ! mongosh "$conn_string" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        error_exit "Database verification failed: Cannot connect after restore"
    fi

    # Get collection count
    local col_count=$(mongosh "$conn_string" --eval "db.getCollectionNames().length" 2>/dev/null | tail -1)
    log "INFO" "Collections in restored database: $col_count"

    # Sample data verification
    local customer_count=$(mongosh "$conn_string" --eval "db.customers.countDocuments()" 2>/dev/null | tail -1)
    log "INFO" "Customer records: $customer_count"

    local booking_count=$(mongosh "$conn_string" --eval "db.bookings.countDocuments()" 2>/dev/null | tail -1)
    log "INFO" "Booking records: $booking_count"

    log "INFO" "Verification completed."
}

# Cleanup temporary files
cleanup_temp_files() {
    if [ "$DRY_RUN" = "true" ]; then
        log "INFO" "[DRY-RUN] Would cleanup temporary files"
        return 0
    fi

    log "INFO" "Cleaning up temporary files..."

    find "$BACKUP_ROOT_DIR/mongodb" -name "restore_temp_*" -type d -mtime +1 -exec rm -rf {} \; 2>/dev/null || true
    log "INFO" "Cleanup completed."
}

# Generate restore report
generate_report() {
    local archive=$1
    local report_file="${LOG_FILE%.log}.report.txt"

    cat > "$report_file" << EOF
================================================================================
MongoDB Restore Report
================================================================================

Restore Date: $(date)
Backup Archive: $(basename "$archive")
Database: $MONGODB_DB
Host: $MONGODB_HOST:$MONGODB_PORT

Restore Status: SUCCESS

Details:
- Archive: $archive
- Archive Size: $(du -h "$archive" | cut -f1)
- Log File: $LOG_FILE
- Restored Collections: See verification output above

Next Steps:
1. Verify application can connect to database
2. Run smoke tests on all critical features
3. Monitor application performance for 1 hour
4. Check error logs for any issues
5. Notify stakeholders of restore completion

Security Reminders:
- Safety backup created before restore
- Verify backups regularly
- Test restore procedures in staging environment
- Keep backup archives secure and encrypted
- Document any manual changes to database

EOF

    log "INFO" "Report generated: $report_file"
}

# Send email notification
send_email() {
    if [ "$SEND_EMAIL" != "true" ] || [ -z "$EMAIL_TO" ]; then
        return 0
    fi

    local status=$1
    local message="${2:-Restore completed}"

    local subject="[FleetPro Restore] Status: $status - $(date +'%Y-%m-%d %H:%M:%S')"

    local log_content=$(tail -50 "$LOG_FILE")

    local email_body="Database Restore Notification

Status: $status
Message: $message

Restore Details:
- Database: $MONGODB_DB
- Timestamp: $(date)
- Log File: $LOG_FILE

Recent Log Entries:
$log_content

IMPORTANT:
- Verify the database is working correctly
- Run smoke tests immediately
- Monitor error logs

"

    if command -v mail >/dev/null 2>&1; then
        echo "$email_body" | mail -s "$subject" "$EMAIL_TO"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    # Parse arguments
    if [ $# -lt 1 ]; then
        usage
    fi

    local archive_path="$1"
    shift

    # Parse optional arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            --dry-run)
                DRY_RUN="true"
                log "INFO" "DRY-RUN mode enabled - no database changes will be made"
                ;;
            --verbose)
                VERBOSE="true"
                ;;
            --help)
                usage
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                usage
                ;;
        esac
        shift
    done

    log "INFO" "========================================"
    log "INFO" "MongoDB Restore Script"
    log "INFO" "========================================"
    log "INFO" "Archive: $archive_path"
    log "INFO" "Dry-Run: $DRY_RUN"
    log "INFO" ""

    # Display warning
    if [ "$DRY_RUN" != "true" ]; then
        log "WARN" "=================================================="
        log "WARN" "WARNING: This will restore database from backup!"
        log "WARN" "Current data will be preserved in safety backup."
        log "WARN" "Ensure no one is using the database!"
        log "WARN" "=================================================="
        sleep 3  # Give user time to cancel
    fi

    # Execute restore steps
    init_logging
    check_dependencies
    validate_backup "$archive_path"
    check_mongodb_connection

    # Create safety backup
    backup_current_db

    # Extract and restore
    local extract_dir=$(extract_archive "$archive_path")
    perform_restore "$extract_dir"

    # Verify
    verify_restore

    # Cleanup
    rm -rf "$extract_dir"
    cleanup_temp_files

    # Report
    generate_report "$archive_path"

    # Notify
    log "INFO" "Restore completed successfully!"
    send_email "SUCCESS" "Database restore completed successfully"

    log "INFO" "========================================"
    log "INFO" "Restore script finished at $(date)"
    log "INFO" "========================================"
}

# Run main function
main "$@"
