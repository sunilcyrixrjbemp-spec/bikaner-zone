-- Cyrix OMS v3.5 — Enterprise Database Schema
-- Created by Lead CTO & Principal Database Performance Architect
-- Target Platform: Cloudflare D1 (SQLite Engine) / Enterprise PostgreSQL Compatible

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Districts (Rajasthan regions)
CREATE TABLE IF NOT EXISTS districts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    zone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Hospitals & Health Facilities
CREATE TABLE IF NOT EXISTS hospitals (
    id TEXT PRIMARY KEY,
    district_id TEXT NOT NULL REFERENCES districts(id),
    name TEXT NOT NULL,
    hospital_type TEXT CHECK(hospital_type IN ('Medical College', 'District Hospital', 'CHC', 'PHC', 'SDH')),
    address TEXT,
    contact_email TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4. Roles Registry (Granular inheritance structure)
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_role_id TEXT REFERENCES roles(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 5. Permissions Catalog
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- e.g. 'complaints', 'assets', 'procurement'
    description TEXT
);

-- 6. Role Permissions Link table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 7. Enterprise Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role_id TEXT NOT NULL REFERENCES roles(id),
    department_id TEXT REFERENCES departments(id),
    district_id TEXT REFERENCES districts(id), -- For localized views
    is_active INTEGER DEFAULT 1,
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret TEXT,
    failed_attempts INTEGER DEFAULT 0,
    lockout_until TEXT,
    fingerprint TEXT, -- Device fingerprint verification
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 8. User Sessions (Session rotation & IP monitoring)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    fingerprint TEXT,
    is_revoked INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 9. OTP Authentication Requests (Resend SMTP OTP integration)
CREATE TABLE IF NOT EXISTS otp_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_code TEXT NOT NULL,
    purpose TEXT CHECK(purpose IN ('Login', 'PasswordReset', 'MFASetup')),
    is_used INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 10. Assets & Facilities Registry
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    asset_category TEXT,
    book_value INTEGER DEFAULT 0,
    depreciation_rate REAL DEFAULT 0.0,
    purchase_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 11. Equipment Registry (Physical Items)
CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id),
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    model TEXT,
    make TEXT,
    serial_no TEXT,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id),
    asset_value INTEGER DEFAULT 0,
    warranty_expiry TEXT,
    installation_date TEXT,
    life_expectancy_years INTEGER,
    status TEXT CHECK(status IN ('Operational', 'Faulty', 'Scrapped', 'Under Maintenance')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 12. Barcode Registries (Historical barcode logs)
CREATE TABLE IF NOT EXISTS barcode_registry (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE NOT NULL,
    equipment_id TEXT REFERENCES equipment(id),
    tag_type TEXT DEFAULT 'RFID/QR',
    last_scanned TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 13. SLA Tracking Definitions
CREATE TABLE IF NOT EXISTS sla_tracking (
    id TEXT PRIMARY KEY,
    hospital_type TEXT UNIQUE NOT NULL,
    response_hours INTEGER DEFAULT 24,
    resolution_hours INTEGER DEFAULT 72,
    penalty_period_hours INTEGER DEFAULT 24,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 14. Complaints Command Center
CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    complaint_no TEXT UNIQUE NOT NULL,
    equipment_id TEXT NOT NULL REFERENCES equipment(id),
    hospital_id TEXT NOT NULL REFERENCES hospitals(id),
    district_id TEXT NOT NULL REFERENCES districts(id),
    raise_date TEXT NOT NULL,
    attend_date TEXT,
    close_date TEXT,
    status TEXT NOT NULL CHECK(status IN ('Open', 'Attended', 'Resolved', 'Closed', 'Escalated')),
    warranty_flag TEXT NOT NULL CHECK(warranty_flag IN ('Warranty', 'Out of Warranty')),
    di_name TEXT NOT NULL, -- DI Officer reporting name
    remarks TEXT,
    downtime_days REAL DEFAULT 0.0,
    penalty_total INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
    assigned_tech_id TEXT REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 15. Task Assignments (Workflow allocations)
CREATE TABLE IF NOT EXISTS task_assignments (
    id TEXT PRIMARY KEY,
    complaint_id TEXT REFERENCES complaints(id) ON DELETE CASCADE,
    assigned_to_id TEXT REFERENCES users(id),
    status TEXT CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Reassigned')),
    due_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 16. Complaint History (Soft deletes and historic audit tracking)
CREATE TABLE IF NOT EXISTS complaint_history (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- e.g. 'Raise', 'Attend', 'Escalate', 'Resolve'
    changed_by TEXT NOT NULL REFERENCES users(id),
    payload TEXT, -- JSON snapshot of old state
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 17. Penalty Logs & Slabs
CREATE TABLE IF NOT EXISTS penalties (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    downtime_hours REAL NOT NULL,
    slab_applied TEXT,
    penalty_amount INTEGER DEFAULT 0,
    waiver_applied INTEGER DEFAULT 0,
    waiver_reason TEXT,
    computed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 18. Penalty Slabs Catalog
CREATE TABLE IF NOT EXISTS penalty_slabs (
    id TEXT PRIMARY KEY,
    max_value INTEGER NOT NULL,
    per_period INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 19. Vendors Registry
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    rating REAL DEFAULT 5.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 20. Procurement PI (Purchase Indents)
CREATE TABLE IF NOT EXISTS pi_requests (
    id TEXT PRIMARY KEY,
    indent_no TEXT UNIQUE NOT NULL,
    device_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    facility_id TEXT NOT NULL REFERENCES hospitals(id),
    district_id TEXT NOT NULL REFERENCES districts(id),
    ticket_no TEXT,
    status TEXT NOT NULL DEFAULT 'Pending Approval',
    requested_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 21. Procurement PR (Purchase Requisitions)
CREATE TABLE IF NOT EXISTS pr_requests (
    id TEXT PRIMARY KEY,
    pr_no TEXT UNIQUE NOT NULL,
    pi_id TEXT REFERENCES pi_requests(id),
    device_name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    facility_id TEXT NOT NULL REFERENCES hospitals(id),
    district_id TEXT NOT NULL REFERENCES districts(id),
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'In Process',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 22. Procurement PO (Purchase Orders)
CREATE TABLE IF NOT EXISTS po_requests (
    id TEXT PRIMARY KEY,
    po_no TEXT UNIQUE NOT NULL,
    pr_id TEXT REFERENCES pr_requests(id),
    pi_id TEXT REFERENCES pi_requests(id),
    device_name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    final_amount INTEGER NOT NULL,
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    status TEXT NOT NULL DEFAULT 'Created',
    approver_id TEXT REFERENCES users(id),
    approved_at TEXT,
    advance_paid INTEGER DEFAULT 0,
    balance INTEGER DEFAULT 0,
    payment_terms TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 23. Inventory Store
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    item_code TEXT UNIQUE NOT NULL,
    item_name TEXT NOT NULL,
    qty_in_stock INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 5,
    unit_measure TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 24. Stock Movements Log
CREATE TABLE IF NOT EXISTS stock_movement (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL REFERENCES inventory(id),
    qty INTEGER NOT NULL,
    movement_type TEXT CHECK(movement_type IN ('Inward', 'Outward', 'Adjustment')),
    reference_no TEXT, -- e.g. PO No, ITR ID
    moved_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 25. SAP Stock Sync Index
CREATE TABLE IF NOT EXISTS sap_sync (
    id TEXT PRIMARY KEY,
    item_code TEXT NOT NULL UNIQUE,
    item_name TEXT NOT NULL,
    sap_stock_po INTEGER DEFAULT 0,
    last_synced TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 26. In-App Followups Tracker
CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    next_date TEXT,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Completed', 'Overdue')),
    added_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 27. Incident Remarks Logs
CREATE TABLE IF NOT EXISTS remarks (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    remark TEXT NOT NULL,
    added_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 28. Realtime Subscriptions & Events
CREATE TABLE IF NOT EXISTS realtime_events (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    event_name TEXT NOT NULL,
    payload TEXT, -- JSON details
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 29. CSV Upload Logs & History
CREATE TABLE IF NOT EXISTS csv_uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    uploader_id TEXT NOT NULL REFERENCES users(id),
    target_module TEXT NOT NULL,
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Completed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 30. Universal Import History
CREATE TABLE IF NOT EXISTS import_history (
    id TEXT PRIMARY KEY,
    upload_id TEXT REFERENCES csv_uploads(id),
    row_index INTEGER NOT NULL,
    payload TEXT NOT NULL,
    error_log TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 31. Workflow Engine Triggers
CREATE TABLE IF NOT EXISTS workflow_engine (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- e.g. 'OnComplaintRaised'
    action_type TEXT NOT NULL,  -- e.g. 'EmailAlert'
    config TEXT, -- JSON configurations
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 32. Incident Escalation Paths
CREATE TABLE IF NOT EXISTS escalations (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    level INTEGER NOT NULL, -- Escalation Level 1, 2, 3
    escalated_to_id TEXT NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Resolved')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 33. Global In-App Notifications Queue
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 34. Activity Logs (Operational timeline logs)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    reference_id TEXT,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 35. Immutable Audit Logs (SecDevOps isolation logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    event_type TEXT NOT NULL,
    event_timestamp TEXT NOT NULL,
    payload TEXT, -- JSON audit footprint
    hash TEXT UNIQUE NOT NULL -- Verification hash to ensure immutability
);

-- ==================== INDEXES & PERFORMANCE OPTIMIZATION ====================

CREATE INDEX IF NOT EXISTS idx_equipment_barcode ON equipment(barcode);
CREATE INDEX IF NOT EXISTS idx_complaints_no ON complaints(complaint_no);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_hospital ON complaints(hospital_id);
CREATE INDEX IF NOT EXISTS idx_complaints_district ON complaints(district_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_stock_inventory ON stock_movement(inventory_id);

-- ==================== INITIAL DATA SEEDING ====================

INSERT OR IGNORE INTO roles (id, name, description, parent_role_id) VALUES
('super_admin', 'Super Admin', 'Full system access', NULL),
('district_admin', 'District Admin', 'Manages complaints in district', 'super_admin'),
('viewer', 'Viewer', 'Read-only operational analytics', NULL);

INSERT OR IGNORE INTO districts (id, name, zone) VALUES
('bikaner', 'Bikaner', 'North'),
('churu', 'Churu', 'North-East'),
('ganganagar', 'Ganganagar', 'North-West'),
('hanumangarh', 'Hanumangarh', 'North');

INSERT OR IGNORE INTO hospitals (id, district_id, name, hospital_type) VALUES
('h1', 'bikaner', 'PBM Government Hospital Bikaner', 'Medical College'),
('h2', 'bikaner', 'District Hospital Nokha', 'District Hospital'),
('h3', 'churu', 'DB General Hospital Churu', 'District Hospital'),
('h4', 'churu', 'CHC Sujangarh', 'CHC'),
('h5', 'ganganagar', 'Government Hospital Sri Ganganagar', 'District Hospital'),
('h6', 'ganganagar', 'CHC Suratgarh', 'CHC'),
('h7', 'hanumangarh', 'MGM District Hospital Hanumangarh', 'District Hospital'),
('h8', 'hanumangarh', 'CHC Nohar', 'CHC');

INSERT OR IGNORE INTO departments (id, name, code) VALUES
('dept_bme', 'Biomedical Engineering', 'BME'),
('dept_admin', 'Administration', 'ADMIN');

INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, role_id, department_id, district_id) VALUES
('u101', 'Sunil', 'rjbemp-bikaner@cyrix.in', 'e6900a0b67484dfc2826cf6f2e24cf81c3d180862024db49830fd17282b0e6bf', 'Sunil Kumar', 'super_admin', 'dept_bme', 'bikaner');

INSERT OR IGNORE INTO penalty_slabs (id, max_value, per_period) VALUES
('slab1', 500000, 500),
('slab2', 2000000, 1500),
('slab3', 99999999, 3000);

INSERT OR IGNORE INTO sla_tracking (id, hospital_type, response_hours, resolution_hours, penalty_period_hours) VALUES
('sla1', 'Medical College', 24, 72, 24),
('sla2', 'District Hospital', 24, 72, 24),
('sla3', 'CHC', 24, 72, 24),
('sla4', 'PHC', 24, 72, 24);

INSERT OR IGNORE INTO vendors (id, name, contact_person, email, phone) VALUES
('v101', 'BPL Medical Technologies', 'Ramesh Sen', 'ramesh@bpl.in', '9876543210'),
('v102', 'GE Healthcare India', 'Vikram Kalla', 'vikram@ge.com', '9876543211');
