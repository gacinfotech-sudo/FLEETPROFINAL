#!/bin/bash

################################################################################
# MongoDB Backup Script for Production
#
# Purpose: Create automated backups of MongoDB database
# Usage: ./backup-mongodb.sh [--full|--incremental] [--upload-s3]
# Cron: 0 2 * * * /app/database/backup-mongodb.sh --full --upload-s3
#
################################################################################

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT_DIR="${BACKUP_PATH:-/var/backups/fleetpro}"
BACKUP_DIR="${BACKUP_ROOT_DIR}/mongodb"
LOG_DIR="${BACKUP_ROOT_DIR}/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="fleetpro_backup_${TIMESTAMP}"
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# MongoDB Configuration
MONGODB_HOST="${MONGODB_HOST:-mongodb}"
MONGODB_PORT="${MONGODB_PORT:-27017}"
MONGODB_USER="${MONGODB_ROOT_USER:-admin}"
MONGODB_PASSWORD="${MONGODB_ROOT_PASSWORD:-}"
MONGODB_AUTHSOURCE="${MONGODB_AUTHSOURCE:-admin}"
MONGODB_DB="fleetpro"

# S3 Configuration (optional)
UPLOAD_TO_S3="${UPLOAD_TO_S3:-false}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-}"
AWS_S3_REGION="${AWS_S3_REGION:-us-east-1}"
AWS_S3_PREFIX="mongodb-backups"

# Email Configuration
SEND_EMAIL="${SEND_EMAIL:-true}"
EMAIL_TO="${EMAIL_TO:-admin@fleetpro.com}"
EMAIL_FROM="${EMAIL_FROM:-backup@fleetpro.local}"

# ============================================================================
# FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR" "$BACKUP_DIR"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2>&1
    echo "Backup started at $(date)"
    echo "Backup directory: $BACKUP_DIR"
    echo "Retention days: $RETENTION_DAYS"
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

# Check dependencies
check_dependencies() {
    log "INFO" "Checking dependencies..."

    command -v mongodump >/dev/null 2>&1 || error_exit "mongodump not found. Install MongoDB tools."
    command -v tar >/dev/null 2>&1 || error_exit "tar not found."
    command -v gzip >/dev/null 2>&1 || error_exit "gzip not found."

    if [ "$UPLOAD_TO_S3" = "true" ]; then
        command -v aws >/dev/null 2>&1 || error_exit "AWS CLI not found. Install awscli."
    fi

    log "INFO" "Dependencies check passed."
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

# Create database dump
create_dump() {
    local dump_dir="${BACKUP_DIR}/${BACKUP_NAME}_dump"

    log "INFO" "Creating MongoDB dump at $dump_dir..."

    local mongodump_opts=(
        "--host=${MONGODB_HOST}:${MONGODB_PORT}"
        "--db=${MONGODB_DB}"
        "--out=${dump_dir}"
        "--gzip"
    )

    if [ -n "$MONGODB_USER" ] && [ -n "$MONGODB_PASSWORD" ]; then
        mongodump_opts+=(
            "--username=${MONGODB_USER}"
            "--password=${MONGODB_PASSWORD}"
            "--authenticationDatabase=${MONGODB_AUTHSOURCE}"
        )
    fi

    if ! mongodump "${mongodump_opts[@]}"; then
        error_exit "mongodump failed"
    fi

    log "INFO" "Database dump created successfully."
    echo "$dump_dir"
}

# Create compressed archive
create_archive() {
    local dump_dir=$1
    local archive="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

    log "INFO" "Creating compressed archive: $archive..."

    if ! tar -czf "$archive" -C "$BACKUP_DIR" "$(basename "$dump_dir")"; then
        error_exit "Failed to create tar archive"
    fi

    # Remove uncompressed dump
    rm -rf "$dump_dir"

    local size=$(du -h "$archive" | cut -f1)
    log "INFO" "Archive created successfully. Size: $size"
    echo "$archive"
}

# Generate backup metadata
generate_metadata() {
    local archive=$1
    local metadata_file="${archive%.tar.gz}.metadata.json"

    log "INFO" "Generating backup metadata..."

    cat > "$metadata_file" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
    "database": "$MONGODB_DB",
    "host": "$MONGODB_HOST",
    "archive_file": "$(basename "$archive")",
    "archive_size": "$(du -b "$archive" | cut -f1)",
    "archive_checksum_md5": "$(md5sum "$archive" | cut -d' ' -f1)",
    "archive_checksum_sha256": "$(sha256sum "$archive" | cut -d' ' -f1)",
    "retention_days": $RETENTION_DAYS,
    "expiration_date": "$(date -u -d "+${RETENTION_DAYS} days" +'%Y-%m-%dT%H:%M:%SZ')",
    "backup_type": "full",
    "status": "completed"
}
EOF

    log "INFO" "Metadata generated: $metadata_file"
}

# Upload to S3
upload_to_s3() {
    local archive=$1

    if [ "$UPLOAD_TO_S3" != "true" ] || [ -z "$AWS_S3_BUCKET" ]; then
        log "INFO" "S3 upload disabled or not configured."
        return 0
    fi

    log "INFO" "Uploading backup to S3..."

    local s3_path="s3://${AWS_S3_BUCKET}/${AWS_S3_PREFIX}/${BACKUP_NAME}/"

    if ! aws s3 cp "$archive" "${s3_path}$(basename "$archive")" \
        --region "$AWS_S3_REGION" \
        --storage-class STANDARD_IA \
        --metadata "backup-date=$(date -u +'%Y-%m-%d'),database=fleetpro,retention=${RETENTION_DAYS}d"; then
        log "ERROR" "S3 upload failed. Backup retained locally."
        return 1
    fi

    # Also upload metadata
    local metadata_file="${archive%.tar.gz}.metadata.json"
    if aws s3 cp "$metadata_file" "${s3_path}$(basename "$metadata_file")" \
        --region "$AWS_S3_REGION"; then
        log "INFO" "Metadata uploaded to S3."
    fi

    log "INFO" "Backup uploaded to S3: $s3_path"
}

# Clean old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up backups older than $RETENTION_DAYS days..."

    local count=0
    while IFS= read -r -d '' file; do
        log "INFO" "Deleting: $(basename "$file")"
        rm -f "$file"
        rm -f "${file%.tar.gz}.metadata.json"
        ((count++))
    done < <(find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +${RETENTION_DAYS} -print0)

    log "INFO" "Deleted $count old backup(s)."
}

# Calculate and report statistics
report_statistics() {
    local archive=$1

    log "INFO" "Backup Statistics:"
    log "INFO" "  Backup Name: $BACKUP_NAME"
    log "INFO" "  Archive Size: $(du -h "$archive" | cut -f1)"
    log "INFO" "  Archive Path: $archive"
    log "INFO" "  Created: $(date)"
    log "INFO" "  Retention: $RETENTION_DAYS days"

    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "INFO" "  Total Backups Size: $total_size"

    local backup_count=$(find "$BACKUP_DIR" -name "*.tar.gz" -type f | wc -l)
    log "INFO" "  Total Backups: $backup_count"
}

# Send email notification
send_email() {
    if [ "$SEND_EMAIL" != "true" ] || [ -z "$EMAIL_TO" ]; then
        return 0
    fi

    local status=$1
    local message="${2:-Backup completed successfully}"
    local subject="[FleetPro Backup] Status: $status - $(date +'%Y-%m-%d')"

    # Read log file
    local log_content=$(tail -30 "$LOG_FILE")

    local email_body="Backup Notification

Status: $status
Message: $message

Backup Details:
- Name: $BACKUP_NAME
- Database: $MONGODB_DB
- Timestamp: $(date)
- Log File: $LOG_FILE

Recent Log Entries:
$log_content
"

    # Try to send via mail command if available
    if command -v mail >/dev/null 2>&1; then
        echo "$email_body" | mail -s "$subject" "$EMAIL_TO"
    elif command -v sendmail >/dev/null 2>&1; then
        {
            echo "To: $EMAIL_TO"
            echo "Subject: $subject"
            echo ""
            echo "$email_body"
        } | sendmail "$EMAIL_TO"
    else
        log "WARN" "Mail command not available. Email notification skipped."
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log "INFO" "========================================"
    log "INFO" "MongoDB Backup Script"
    log "INFO" "========================================"

    # Initialize
    init_logging
    check_dependencies
    check_mongodb_connection

    # Create backup
    local dump_dir=$(create_dump)
    local archive=$(create_archive "$dump_dir")

    # Generate metadata
    generate_metadata "$archive"

    # Upload to S3 if configured
    upload_to_s3 "$archive"

    # Cleanup old backups
    cleanup_old_backups

    # Report statistics
    report_statistics "$archive"

    # Send success notification
    log "INFO" "Backup completed successfully!"
    send_email "SUCCESS" "Backup $BACKUP_NAME completed successfully"

    log "INFO" "========================================"
    log "INFO" "Backup script finished at $(date)"
    log "INFO" "========================================"
}

# Run main function
main "$@"
