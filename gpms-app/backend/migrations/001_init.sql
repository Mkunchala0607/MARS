-- GPMS core schema. Mirrors GPMS_ER_Diagrams.docx:
--   1. Users, roles & master data
--   2. Gate pass transactions (single GATE_PASSES table + type discriminator)
--   3. Visitor & weighbridge
--   4. Approvals & audit

-- ───────────────────────── 1. Users, roles & master data ─────────────────────────

CREATE TABLE roles (
  id          smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code        text NOT NULL UNIQUE,            -- requester | vendor | approver | security | store | admin
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE screens (
  code       text PRIMARY KEY,                 -- dashboard, NRGP, approvals, ...
  name       text NOT NULL,
  group_name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE role_permissions (
  role_id     smallint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  screen_code text NOT NULL REFERENCES screens(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, screen_code)
);

CREATE TABLE uom (
  code text PRIMARY KEY,                       -- Nos, Kg, Ltr ...
  name text NOT NULL
);

CREATE TABLE vendors (
  id             bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  gstin          text,
  address        text,
  contact_person text,
  phone          text,
  email          text,
  vendor_type    text NOT NULL DEFAULT 'Supplier' CHECK (vendor_type IN ('Supplier', 'Transporter', 'Logistics')),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name          text NOT NULL,
  email         text NOT NULL,
  password_hash text,                          -- null for SSO-only accounts
  role_id       smallint NOT NULL REFERENCES roles(id),
  department    text,
  phone         text,
  vendor_id     bigint REFERENCES vendors(id), -- set for Registered Person accounts
  is_active     boolean NOT NULL DEFAULT true,
  self_registered boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uk ON users (lower(email));

CREATE TABLE password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE TABLE materials (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code         text NOT NULL UNIQUE,
  description  text NOT NULL,
  hsn_code     text,
  uom_code     text NOT NULL REFERENCES uom(code),
  category     text NOT NULL CHECK (category IN ('Raw Material', 'Packaging', 'Finished Goods', 'Scrap', 'Spares')),
  default_rate numeric(14, 2),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contractors (
  id             bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  firm_name      text,
  contact_person text,
  phone          text,
  id_proof       text,
  valid_from     date,
  valid_to       date,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sub_contractors (
  id                   bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code                 text NOT NULL UNIQUE,
  name                 text NOT NULL,
  parent_contractor_id bigint NOT NULL REFERENCES contractors(id),
  phone                text,
  valid_from           date,
  valid_to             date,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_vendors (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  service_type text,
  phone        text,
  valid_from   date,
  valid_to     date,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── 2. Gate pass transactions ─────────────────────────

CREATE TABLE document_sequences (
  prefix   text NOT NULL,                      -- NRGP, RGP, SCR, INW, STM, VIS
  year     smallint NOT NULL,
  last_no  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

CREATE TABLE gate_passes (
  id                  bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pass_no             text NOT NULL UNIQUE,
  gate_pass_type      text NOT NULL CHECK (gate_pass_type IN ('NRGP', 'RGP', 'SCRAP', 'INWARD', 'STORE')),
  status              text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  gate_status         text NOT NULL DEFAULT 'NotReady' CHECK (gate_status IN ('NotReady', 'AwaitingGate', 'Exited', 'Entered', 'Returned')),
  is_direct_entry     boolean NOT NULL DEFAULT false,
  requester_id        bigint NOT NULL REFERENCES users(id),
  department          text,
  vendor_id           bigint REFERENCES vendors(id),
  purpose             text,
  despatched_through  text,
  lr_rr_no            text,
  freight_terms       text CHECK (freight_terms IN ('Paid', 'To Pay')),
  freight_amount      numeric(14, 2),
  insurance           text CHECK (insurance IN ('Arranged', 'To be arranged')),
  no_of_packages      integer CHECK (no_of_packages >= 0),
  po_number           text,
  inward_date         date,
  vehicle_no          text,
  driver_name         text,
  invoice_no          text,
  seal_no             text,
  total_value         numeric(14, 2) NOT NULL DEFAULT 0,
  approved_by         bigint REFERENCES users(id),
  decided_at          timestamptz,
  decision_remarks    text,
  deleted_at          timestamptz,
  deleted_by          bigint REFERENCES users(id),
  delete_reason       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (gate_pass_type = 'STORE' OR vendor_id IS NOT NULL),
  CHECK (deleted_at IS NULL OR delete_reason IS NOT NULL)
);
CREATE INDEX gate_passes_status_idx ON gate_passes (status) WHERE deleted_at IS NULL;
CREATE INDEX gate_passes_requester_idx ON gate_passes (requester_id, created_at DESC);
CREATE INDEX gate_passes_type_created_idx ON gate_passes (gate_pass_type, created_at DESC);
CREATE INDEX gate_passes_vehicle_idx ON gate_passes (upper(replace(vehicle_no, '-', '')));

CREATE TABLE gate_pass_items (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  gate_pass_id bigint NOT NULL REFERENCES gate_passes(id) ON DELETE CASCADE,
  line_no      smallint NOT NULL,
  material_id  bigint REFERENCES materials(id),
  description  text NOT NULL,
  uom_code     text NOT NULL REFERENCES uom(code),
  quantity     numeric(14, 3) NOT NULL CHECK (quantity > 0),
  approx_value numeric(14, 2) NOT NULL CHECK (approx_value >= 0),
  remarks      text,
  UNIQUE (gate_pass_id, line_no)
);

-- Optional 1-to-1 extensions: a row exists only for that pass type.
CREATE TABLE rgp_details (
  gate_pass_id         bigint PRIMARY KEY REFERENCES gate_passes(id) ON DELETE CASCADE,
  expected_return_date date NOT NULL,
  returned_at          timestamptz,
  returned_remarks     text
);

CREATE TABLE store_movement_details (
  gate_pass_id  bigint PRIMARY KEY REFERENCES gate_passes(id) ON DELETE CASCADE,
  from_location text NOT NULL,
  to_location   text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('Issue', 'Transfer', 'Return to Store'))
);

CREATE TABLE attachments (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  gate_pass_id  bigint NOT NULL REFERENCES gate_passes(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  stored_name   text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    integer NOT NULL,
  uploaded_by   bigint NOT NULL REFERENCES users(id),
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── 3. Visitor & weighbridge ─────────────────────────

CREATE TABLE visitor_gate_passes (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pass_no       text NOT NULL UNIQUE,
  access_token  text NOT NULL UNIQUE,          -- lets the visitor poll their own status without logging in
  visitor_name  text NOT NULL,
  contact_no    text NOT NULL,
  coming_from   text NOT NULL,
  host_user_id  bigint REFERENCES users(id),
  host_name     text NOT NULL,
  purpose       text,
  laptop_details text,
  status        text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  decided_by    bigint REFERENCES users(id),
  decided_at    timestamptz,
  decision_remarks text,
  in_time       timestamptz,
  out_time      timestamptz,
  checked_in_by bigint REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (out_time IS NULL OR in_time IS NOT NULL)
);
CREATE INDEX visitor_gate_passes_created_idx ON visitor_gate_passes (created_at DESC);

-- FORM-1839. Always exactly one per visitor gate pass.
CREATE TABLE visitor_health_declarations (
  visitor_gate_pass_id bigint PRIMARY KEY REFERENCES visitor_gate_passes(id) ON DELETE CASCADE,
  skin_disease         boolean NOT NULL,
  eye_disease          boolean NOT NULL,
  respiratory_disease  boolean NOT NULL,
  allergies            boolean NOT NULL,
  typhoid_history      boolean NOT NULL,
  details              text,
  gmp_acknowledged     boolean NOT NULL CHECK (gmp_acknowledged),
  signature_name       text NOT NULL,
  has_health_flag      boolean GENERATED ALWAYS AS (skin_disease OR eye_disease OR respiratory_disease OR allergies OR typhoid_history) STORED,
  CHECK (NOT (skin_disease OR eye_disease OR respiratory_disease OR allergies OR typhoid_history) OR coalesce(details, '') <> '')
);

CREATE TABLE weighbridges (
  id        smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name      text NOT NULL UNIQUE,
  location  text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE weighbridge_entries (
  id             bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slip_no        text NOT NULL UNIQUE,
  weighbridge_id smallint NOT NULL REFERENCES weighbridges(id),
  gate_pass_id   bigint REFERENCES gate_passes(id),
  vehicle_no     text NOT NULL,
  invoice_no     text,
  in_time        timestamptz NOT NULL,
  out_time       timestamptz,
  gross_weight   numeric(12, 2) NOT NULL CHECK (gross_weight > 0),
  tare_weight    numeric(12, 2) NOT NULL CHECK (tare_weight > 0),
  net_weight     numeric(12, 2) GENERATED ALWAYS AS (gross_weight - tare_weight) STORED,
  status         text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  recorded_by    bigint NOT NULL REFERENCES users(id),
  decided_by     bigint REFERENCES users(id),
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_weight > tare_weight),
  CHECK (out_time IS NULL OR out_time >= in_time)
);

-- ───────────────────────── 4. Approvals, audit & notifications ─────────────────────────

CREATE TABLE approval_timeline (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_type   text NOT NULL CHECK (entity_type IN ('gate_pass', 'visitor', 'weighment')),
  entity_id     bigint NOT NULL,
  event         text NOT NULL,                 -- Submitted, Resubmitted, Approved, Rejected, DirectEntry, GateExited, ...
  actor_id      bigint REFERENCES users(id),
  actor_name    text NOT NULL,
  remarks       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approval_timeline_entity_idx ON approval_timeline (entity_type, entity_id, created_at);

-- Elevated actions only (direct create, delete, role/permission changes). Append-only.
CREATE TABLE audit_log (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  actor_id    bigint REFERENCES users(id),
  actor_name  text NOT NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_ref  text NOT NULL,
  reason      text,
  details     jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

CREATE TABLE notifications (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    text NOT NULL,
  link       text,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
