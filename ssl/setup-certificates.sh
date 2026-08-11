#!/bin/bash

################################################################################
# SSL/TLS Certificate Setup Script for FleetPro
#
# Purpose: Generate and manage SSL/TLS certificates for production
# Supports both self-signed (development) and Let's Encrypt (production)
#
# Usage:
#   ./setup-certificates.sh --self-signed   # For development
#   ./setup-certificates.sh --letsencrypt   # For production with Let's Encrypt
#
################################################################################

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/certs"
KEY_DIR="${SCRIPT_DIR}/keys"
LOG_FILE="${SCRIPT_DIR}/setup.log"

# Certificate Configuration
DOMAIN_NAME="${DOMAIN_NAME:-fleetpro.local}"
COUNTRY_CODE="${COUNTRY_CODE:-IN}"
STATE="${STATE:-Maharashtra}"
CITY="${CITY:-Mumbai}"
ORGANIZATION="${ORGANIZATION:-FleetPro}"
COMMON_NAME="${COMMON_NAME:-fleetpro.local}"
VALIDITY_DAYS="${VALIDITY_DAYS:-365}"

# Let's Encrypt Configuration
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@fleetpro.local}"
CERTBOT_AGREE_TOS="${CERTBOT_AGREE_TOS:-false}"

# Logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

# ============================================================================
# FUNCTIONS
# ============================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error_exit() {
    log "ERROR: $*"
    exit 1
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --self-signed       Generate self-signed certificate (development)
    --letsencrypt       Setup Let's Encrypt certificate (production)
    --renew            Renew existing Let's Encrypt certificate
    --check            Check certificate validity
    --help             Display this help message

Environment Variables:
    DOMAIN_NAME         Domain name for certificate (default: fleetpro.local)
    COUNTRY_CODE        Country code (default: IN)
    STATE              State/Province (default: Maharashtra)
    CITY               City (default: Mumbai)
    ORGANIZATION       Organization name (default: FleetPro)
    VALIDITY_DAYS      Certificate validity in days (default: 365)

Examples:
    # Generate self-signed certificate
    $0 --self-signed

    # Setup Let's Encrypt for example.com
    DOMAIN_NAME=example.com LETSENCRYPT_EMAIL=admin@example.com $0 --letsencrypt

    # Renew Let's Encrypt certificate
    $0 --renew

EOF
    exit 1
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."

    command -v openssl >/dev/null 2>&1 || error_exit "openssl not found. Install it first."

    if [ "${USE_LETSENCRYPT:-false}" = "true" ]; then
        command -v certbot >/dev/null 2>&1 || error_exit "certbot not found. Install it: apt-get install certbot"
    fi

    log "Dependencies OK"
}

# Create directories
create_directories() {
    log "Creating certificate directories..."

    mkdir -p "$CERT_DIR" "$KEY_DIR"
    chmod 755 "$CERT_DIR"
    chmod 700 "$KEY_DIR"

    log "Directories created: $CERT_DIR, $KEY_DIR"
}

# Generate self-signed certificate
generate_self_signed() {
    log "Generating self-signed certificate for $DOMAIN_NAME..."

    local cert_file="${CERT_DIR}/fleetpro.crt"
    local key_file="${KEY_DIR}/fleetpro.key"

    # Create certificate signing request (CSR)
    local csr_file="${CERT_DIR}/fleetpro.csr"

    local subject="/C=${COUNTRY_CODE}/ST=${STATE}/L=${CITY}/O=${ORGANIZATION}/CN=${COMMON_NAME}"

    # Generate private key
    openssl genrsa -out "$key_file" 2048 2>/dev/null
    chmod 600 "$key_file"
    log "Private key generated: $key_file"

    # Generate CSR
    openssl req -new \
        -key "$key_file" \
        -out "$csr_file" \
        -subj "$subject" \
        2>/dev/null

    # Generate self-signed certificate
    openssl x509 -req \
        -days "$VALIDITY_DAYS" \
        -in "$csr_file" \
        -signkey "$key_file" \
        -out "$cert_file" \
        -extfile <(printf "subjectAltName=DNS:${DOMAIN_NAME},DNS:*.${DOMAIN_NAME}") \
        2>/dev/null

    chmod 644 "$cert_file"
    log "Self-signed certificate generated: $cert_file"

    # Create CA bundle (for compatibility)
    cp "$cert_file" "${CERT_DIR}/ca-bundle.crt"
    log "CA bundle created: ${CERT_DIR}/ca-bundle.crt"

    # Display certificate info
    log ""
    log "Certificate Information:"
    openssl x509 -in "$cert_file" -text -noout 2>/dev/null | grep -E "Subject:|Issuer:|Not Before|Not After|Public-Key" || true

    # Cleanup CSR
    rm -f "$csr_file"

    log "Self-signed certificate setup completed successfully!"
}

# Setup Let's Encrypt certificate
setup_letsencrypt() {
    log "Setting up Let's Encrypt certificate for $DOMAIN_NAME..."

    if [ -z "$DOMAIN_NAME" ] || [ "$DOMAIN_NAME" = "fleetpro.local" ]; then
        error_exit "Cannot use Let's Encrypt with local domain. Set DOMAIN_NAME environment variable."
    fi

    # Check if certbot is installed
    if ! command -v certbot >/dev/null 2>&1; then
        error_exit "certbot is required for Let's Encrypt. Install it: apt-get install certbot certbot-nginx"
    fi

    log "Running certbot for $DOMAIN_NAME..."

    local certbot_opts=(
        "certonly"
        "--standalone"
        "--non-interactive"
        "--agree-tos"
        "--email $LETSENCRYPT_EMAIL"
        "-d $DOMAIN_NAME"
        "-d *.$DOMAIN_NAME"
    )

    if ! certbot "${certbot_opts[@]}"; then
        error_exit "Let's Encrypt certificate generation failed"
    fi

    # Copy certificates to our directory
    local letsencrypt_cert="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
    local letsencrypt_key="/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem"

    if [ -f "$letsencrypt_cert" ] && [ -f "$letsencrypt_key" ]; then
        cp "$letsencrypt_cert" "${CERT_DIR}/fleetpro.crt"
        cp "$letsencrypt_key" "${KEY_DIR}/fleetpro.key"
        chmod 644 "${CERT_DIR}/fleetpro.crt"
        chmod 600 "${KEY_DIR}/fleetpro.key"

        log "Let's Encrypt certificates installed successfully"
    else
        error_exit "Failed to find Let's Encrypt certificates"
    fi

    # Create CA bundle
    if [ -f "/etc/letsencrypt/live/${DOMAIN_NAME}/chain.pem" ]; then
        cp "/etc/letsencrypt/live/${DOMAIN_NAME}/chain.pem" "${CERT_DIR}/ca-bundle.crt"
        log "CA bundle created"
    fi

    log "Let's Encrypt setup completed successfully!"
}

# Renew Let's Encrypt certificate
renew_letsencrypt() {
    log "Renewing Let's Encrypt certificate..."

    if ! command -v certbot >/dev/null 2>&1; then
        error_exit "certbot not found"
    fi

    if certbot renew --quiet; then
        log "Certificate renewed successfully"

        # Copy renewed certificates
        local letsencrypt_cert="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
        local letsencrypt_key="/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem"

        if [ -f "$letsencrypt_cert" ] && [ -f "$letsencrypt_key" ]; then
            cp "$letsencrypt_cert" "${CERT_DIR}/fleetpro.crt"
            cp "$letsencrypt_key" "${KEY_DIR}/fleetpro.key"
            log "Renewed certificates copied to application directory"
        fi
    else
        error_exit "Certificate renewal failed"
    fi
}

# Check certificate validity
check_certificate() {
    log "Checking certificate validity..."

    local cert_file="${CERT_DIR}/fleetpro.crt"

    if [ ! -f "$cert_file" ]; then
        log "No certificate found at $cert_file"
        return 1
    fi

    log ""
    log "Certificate Information:"
    openssl x509 -in "$cert_file" -noout -text 2>/dev/null | grep -E "Subject:|Issuer:|Not Before|Not After|Public-Key:" || true

    log ""
    log "Certificate Status:"

    # Get expiration date
    local expiration=$(openssl x509 -in "$cert_file" -noout -dates 2>/dev/null | grep "notAfter" | cut -d= -f2)
    log "Expires: $expiration"

    # Check days until expiration
    local expiration_epoch=$(date -d "$expiration" +%s)
    local current_epoch=$(date +%s)
    local days_until_expiration=$(( ($expiration_epoch - $current_epoch) / 86400 ))

    if [ $days_until_expiration -lt 0 ]; then
        log "WARNING: Certificate has EXPIRED!"
        return 1
    elif [ $days_until_expiration -lt 30 ]; then
        log "WARNING: Certificate expires in $days_until_expiration days"
        return 1
    else
        log "Certificate is valid for $days_until_expiration more days"
    fi

    return 0
}

# Setup certificate auto-renewal with cron
setup_auto_renewal() {
    if [ ! -f "/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem" ]; then
        log "Let's Encrypt certificates not found. Skipping auto-renewal setup."
        return 0
    fi

    log "Setting up automatic certificate renewal..."

    local cron_file="/etc/cron.d/fleetpro-cert-renewal"
    local renewal_script="/usr/local/bin/fleetpro-renew-cert.sh"

    # Create renewal script
    cat > "$renewal_script" << 'RENEWAL_SCRIPT'
#!/bin/bash
certbot renew --quiet --post-hook "systemctl reload nginx"
RENEWAL_SCRIPT

    chmod +x "$renewal_script"

    # Add to crontab (run daily at 3 AM)
    if [ -w "$(dirname "$cron_file")" ]; then
        cat > "$cron_file" << EOF
# FleetPro SSL Certificate Auto-Renewal
# Renew Let's Encrypt certificates daily
0 3 * * * root $renewal_script >> /var/log/fleetpro-cert-renewal.log 2>&1
EOF
        log "Cron job created for automatic renewal"
    else
        log "Cannot create cron file. Add this line to your crontab:"
        echo "0 3 * * * $renewal_script"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    if [ $# -eq 0 ]; then
        usage
    fi

    log "========================================"
    log "FleetPro SSL/TLS Certificate Setup"
    log "========================================"

    check_dependencies
    create_directories

    case "$1" in
        --self-signed)
            log "Mode: Self-signed certificate generation"
            generate_self_signed
            ;;
        --letsencrypt)
            log "Mode: Let's Encrypt certificate"
            setup_letsencrypt
            setup_auto_renewal
            ;;
        --renew)
            log "Mode: Certificate renewal"
            renew_letsencrypt
            ;;
        --check)
            log "Mode: Certificate check"
            check_certificate
            ;;
        --help|-h)
            usage
            ;;
        *)
            log "ERROR: Unknown option: $1"
            usage
            ;;
    esac

    log ""
    log "========================================"
    log "Setup completed at $(date)"
    log "========================================"
}

main "$@"
