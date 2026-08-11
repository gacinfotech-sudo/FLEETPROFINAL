-- ============================================================================
-- FLEET COMPLIANCE & DOCUMENT EXPIRY SYSTEM - DATABASE SCHEMA
-- Phase 1: Core Data Model
-- ============================================================================

-- ============================================================================
-- 1. ENUMS & TYPES
-- ============================================================================

-- Vehicle Ownership Type
CREATE TYPE vehicle_ownership_type AS ENUM (
  'own_fleet',
  'vendor_vehicle',
  'attached_vehicle',
  'leased_vehicle'
);

-- Registration Usage Type (Commercial/Private)
CREATE TYPE registration_usage_type AS ENUM (
  'commercial_transport',
  'private_non_transport'
);

-- Vehicle Category
CREATE TYPE vehicle_category AS ENUM (
  'hatchback',
  'sedan',
  'suv',
  'muv',
  'tempo_traveller',
  'bus',
  'other'
);

-- Document Status (auto-derived, not manual)
CREATE TYPE document_status AS ENUM (
  'valid',
  'expiring_soon',
  'critical',
  'expired',
  'missing',
  'not_applicable'
);

-- Document Verification Status
CREATE TYPE verification_status AS ENUM (
  'pending',
  'verified',
  'rejected',
  'needs_renewal'
);

-- Alert Severity
CREATE TYPE alert_severity AS ENUM (
  'info',
  'warning',
  'high',
  'critical'
);

-- Compliance Mode (for booking validation)
CREATE TYPE compliance_mode AS ENUM (
  'warning_only',
  'approval_required',
  'hard_block'
);

-- Vehicle Readiness Status
CREATE TYPE vehicle_readiness AS ENUM (
  'road_ready',
  'attention_required',
  'not_road_ready'
);

-- ============================================================================
-- 2. EXTEND VEHICLES TABLE
-- ============================================================================

-- Add columns to existing vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ownership_type vehicle_ownership_type;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_usage registration_usage_type;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS category vehicle_category;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_status VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS readiness_status vehicle_readiness DEFAULT 'attention_required';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_compliance_check TIMESTAMP;

-- ============================================================================
-- 3. DOCUMENT TYPES MASTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_types_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Applicability rules
  applicable_to_commercial BOOLEAN DEFAULT false,
  applicable_to_private BOOLEAN DEFAULT false,
  applicable_to_own_fleet BOOLEAN DEFAULT false,
  applicable_to_vendor BOOLEAN DEFAULT false,
  applicable_to_leased BOOLEAN DEFAULT false,
  applicable_vehicle_categories TEXT[], -- array of vehicle_category

  -- Validation rules
  is_mandatory BOOLEAN DEFAULT false,
  requires_verification BOOLEAN DEFAULT false,

  -- Renewal settings
  renewal_frequency_days INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_tenant_doc_type UNIQUE(tenant_id, document_type),
  CONSTRAINT fk_tenant_master FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_types_tenant ON document_types_master(tenant_id);

-- ============================================================================
-- 4. VEHICLE DOCUMENTS (CORE TABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,

  -- Document identification
  document_type VARCHAR(100) NOT NULL,
  document_number VARCHAR(255) NOT NULL,

  -- Validity dates
  issue_date DATE NOT NULL,
  valid_from DATE NOT NULL,
  expiry_date DATE NOT NULL,

  -- Document details
  issuing_authority VARCHAR(255),
  file_reference VARCHAR(500), -- S3/storage path
  remarks TEXT,

  -- Status (auto-derived)
  status document_status DEFAULT 'valid',
  days_until_expiry INT, -- cached for performance

  -- Verification
  verification_status verification_status DEFAULT 'pending',
  verified_by UUID,
  verified_at TIMESTAMP,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  renewal_in_progress BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_doc FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_doc FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT unique_active_doc UNIQUE(vehicle_id, document_type) WHERE is_active
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_tenant ON vehicle_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry ON vehicle_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_status ON vehicle_documents(status);

-- ============================================================================
-- 5. DOCUMENT HISTORY (AUDIT TRAIL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  document_type VARCHAR(100) NOT NULL,

  -- Old document
  old_document_id UUID,
  old_document_number VARCHAR(255),
  old_validity_end DATE,
  old_file_reference VARCHAR(500),

  -- New document
  new_document_number VARCHAR(255) NOT NULL,
  new_validity_start DATE NOT NULL,
  new_validity_end DATE NOT NULL,
  new_file_reference VARCHAR(500),

  -- Renewal details
  renewal_date TIMESTAMP NOT NULL,
  renewed_by UUID NOT NULL,
  verified_by UUID,
  verified_at TIMESTAMP,

  -- Reason for renewal
  renewal_reason TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_history FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_history FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_history_vehicle ON document_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_document_history_type ON document_history(document_type);
CREATE INDEX IF NOT EXISTS idx_document_history_date ON document_history(renewal_date);

-- ============================================================================
-- 6. DOCUMENT ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  document_id UUID NOT NULL,

  -- Alert details
  document_type VARCHAR(100) NOT NULL,
  alert_type VARCHAR(50) NOT NULL, -- 'expiring_soon', 'expired', 'critical'
  severity alert_severity NOT NULL,

  -- Timing
  trigger_date DATE NOT NULL, -- When alert was triggered
  expiry_date DATE NOT NULL,
  days_remaining INT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID,
  resolved_at TIMESTAMP,
  resolved_by UUID,

  -- Notification tracking
  notification_sent BOOLEAN DEFAULT false,
  notification_count INT DEFAULT 0,
  last_notification_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_alert FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_alert FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_alert FOREIGN KEY (document_id) REFERENCES vehicle_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_alerts_tenant ON document_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_alerts_vehicle ON document_alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_document_alerts_active ON document_alerts(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_document_alerts_severity ON document_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_document_alerts_trigger ON document_alerts(trigger_date);

-- ============================================================================
-- 7. COMPLIANCE OVERRIDES (for hard block exceptions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  booking_id UUID,

  -- What was overridden
  document_type VARCHAR(100) NOT NULL,
  reason_code VARCHAR(50) NOT NULL, -- 'pending_renewal', 'admin_approval', etc
  reason_text TEXT NOT NULL,

  -- Who overrode
  overridden_by UUID NOT NULL,
  overridden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Duration
  valid_until TIMESTAMP,

  -- Audit
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT fk_tenant_override FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_override FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compliance_overrides_vehicle ON compliance_overrides(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_active ON compliance_overrides(is_active) WHERE is_active;

-- ============================================================================
-- 8. VEHICLE MAINTENANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,

  -- Maintenance types
  service_due_date DATE,
  service_due_km INT,

  oil_change_km INT,
  tyre_check_km INT,
  brake_check_km INT,
  battery_check_km INT,
  general_service_km INT,

  -- Current status
  last_service_date DATE,
  last_service_km INT,

  -- Alert
  is_overdue BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_maintenance FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_maintenance FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);

-- ============================================================================
-- 9. INSURANCE DETAILS
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,

  -- Policy details
  policy_number VARCHAR(255) NOT NULL,
  insurer VARCHAR(255) NOT NULL,
  policy_type VARCHAR(100), -- 'comprehensive', 'third_party', etc

  -- Validity
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,

  -- Reference
  file_reference VARCHAR(500),
  idv DECIMAL(12, 2), -- Insured Declared Value

  -- Contact
  claim_contact VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_insurance FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_insurance FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT unique_vehicle_insurance UNIQUE(vehicle_id) WHERE expiry_date > CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_insurance_vehicle ON insurance_details(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_insurance_expiry ON insurance_details(expiry_date);

-- ============================================================================
-- 10. PERMIT RECORDS (supports multiple permits per vehicle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS permit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,

  -- Permit details
  permit_number VARCHAR(255) NOT NULL,
  permit_type VARCHAR(100), -- 'national', 'state', 'local', etc
  territory VARCHAR(255), -- State/region

  -- Validity
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,

  -- Document
  file_reference VARCHAR(500),

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_permit FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_permit FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_permit_vehicle ON permit_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_permit_expiry ON permit_records(valid_until);
CREATE INDEX IF NOT EXISTS idx_permit_active ON permit_records(is_active) WHERE is_active;

-- ============================================================================
-- 11. ALERT CONFIGURATION (tenant-specific thresholds)
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,

  -- Alert thresholds (days before expiry)
  info_days INT DEFAULT 30,
  warning_days INT DEFAULT 15,
  high_days INT DEFAULT 7,
  critical_days INT DEFAULT 3,
  critical_final_day BOOLEAN DEFAULT true, -- alert 1 day before

  -- Notification settings
  enable_email BOOLEAN DEFAULT false,
  enable_whatsapp BOOLEAN DEFAULT false,
  enable_push BOOLEAN DEFAULT false,
  enable_sms BOOLEAN DEFAULT false,

  -- Behavior
  compliance_mode compliance_mode DEFAULT 'warning_only',
  allow_override BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_config FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================================================
-- 12. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Multi-column indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vehicle_compliance_check
  ON vehicle_documents(tenant_id, vehicle_id, status, expiry_date);

CREATE INDEX IF NOT EXISTS idx_alerts_pending
  ON document_alerts(tenant_id, is_active, severity)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_fleet_status
  ON vehicles(tenant_id, readiness_status);

-- ============================================================================
-- 13. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE vehicle_documents IS 'Core document tracking table - stores all vehicle documents with auto-derived status based on expiry dates';
COMMENT ON TABLE document_alerts IS 'Alert lifecycle management - tracks alerts with acknowledgment and resolution tracking';
COMMENT ON TABLE compliance_overrides IS 'Audit trail for compliance exceptions - hard block overrides with approval tracking';
COMMENT ON COLUMN vehicle_documents.status IS 'Auto-derived status: VALID/EXPIRING/CRITICAL/EXPIRED/MISSING - never set manually';
COMMENT ON COLUMN vehicle_documents.days_until_expiry IS 'Cached calculation for performance - (expiry_date - today)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
