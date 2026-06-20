import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Single-file SQLite store (WAL) for the whole hospital. One process owns it.
const DATA_DIR = join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, "lumora.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, encrypted INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now'))
);

-- Organizational units (clinical + support + back-office). category groups them.
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,                 -- emergency|critical|surgical|inpatient|outpatient|diagnostic|support|backoffice
  kind TEXT,                              -- ed|icu|ot|cardiology|lab|radiology|pharmacy|... (specialty key)
  location TEXT,
  phone TEXT,
  head_staff_id TEXT,
  color TEXT DEFAULT '#6366f1',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- All users are staff with a clinical/administrative role. Rich profile fields included.
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  staff_no TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,                     -- super_admin|doctor|nurse|lab|radiology|pharmacy|reception|billing|department_head
  title TEXT,                             -- Prof. / Dr. / RN ...
  department_id TEXT,
  specialty TEXT,
  subspecialty TEXT,
  phone TEXT,
  gender TEXT,
  photo_color TEXT DEFAULT '#6366f1',
  photo_url TEXT,
  rating REAL DEFAULT 4.7,
  -- professional dossier
  license_no TEXT,
  license_expiry TEXT,
  qualifications TEXT,                    -- JSON array of {degree, institution, year}
  experience TEXT,                        -- JSON array of {role, place, from, to}
  languages TEXT,                         -- JSON array of strings
  bio TEXT,
  consult_fee REAL DEFAULT 0,
  room TEXT,
  status TEXT DEFAULT 'active',
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, weekday INTEGER NOT NULL,  -- 0=Sun..6
  start_min INTEGER NOT NULL, end_min INTEGER NOT NULL, room TEXT,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  mrn TEXT UNIQUE NOT NULL,              -- medical record number
  full_name TEXT NOT NULL,
  gender TEXT,
  birth_date TEXT,
  blood_group TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  national_id TEXT,
  emergency_contact TEXT,
  allergies TEXT,                        -- JSON array
  chronic_conditions TEXT,              -- JSON array
  payer_type TEXT DEFAULT 'self',       -- self|insurance|corporate|government
  payer_name TEXT,
  policy_no TEXT,
  is_anonymous INTEGER DEFAULT 0,
  photo_color TEXT DEFAULT '#0ea5e9',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY, department_id TEXT NOT NULL, ward TEXT, room TEXT, label TEXT NOT NULL,
  type TEXT DEFAULT 'general',           -- general|icu|isolation|hdu
  status TEXT DEFAULT 'available',       -- available|occupied|cleaning|blocked
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- A single visit/episode. Outpatient, inpatient, emergency or day-case.
CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  visit_no TEXT UNIQUE NOT NULL,
  patient_id TEXT NOT NULL,
  type TEXT NOT NULL,                    -- outpatient|inpatient|emergency|daycase
  department_id TEXT,
  attending_id TEXT,
  bed_id TEXT,
  status TEXT DEFAULT 'open',            -- open|in_progress|admitted|discharged|closed|cancelled
  chief_complaint TEXT,
  diagnosis TEXT,
  acuity TEXT,                           -- triage: red|yellow|green (ED)
  admitted_at TEXT,
  discharged_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (attending_id) REFERENCES staff(id),
  FOREIGN KEY (bed_id) REFERENCES beds(id)
);

-- Time-series vitals; powers the live ICU board and trend charts.
CREATE TABLE IF NOT EXISTS vitals (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL,
  hr INTEGER, bp_sys INTEGER, bp_dia INTEGER, spo2 INTEGER, resp INTEGER, temp REAL,
  pain INTEGER, gcs INTEGER, news2 INTEGER,
  source TEXT DEFAULT 'manual',          -- manual|monitor
  captured_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY, encounter_id TEXT NOT NULL, author_id TEXT,
  kind TEXT DEFAULT 'progress',          -- progress|admission|consult|nursing|discharge|operative
  template TEXT, body TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
);

-- Clinical orders flowing to other departments (lab/radiology/procedure).
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL,
  kind TEXT NOT NULL,                    -- lab|radiology|procedure
  catalog_id TEXT,
  name TEXT NOT NULL,
  priority TEXT DEFAULT 'routine',       -- routine|urgent|stat
  status TEXT DEFAULT 'ordered',         -- ordered|collected|in_progress|resulted|validated|cancelled
  ordered_by TEXT,
  target_department_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  resulted_at TEXT,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_catalog (
  id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, category TEXT,
  unit TEXT, ref_low REAL, ref_high REAL, price REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lab_results (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, analyte TEXT NOT NULL, value TEXT,
  unit TEXT, ref_range TEXT, flag TEXT,  -- low|normal|high|critical
  stage TEXT DEFAULT 'pending',          -- pending|tech_validated|validated
  validated_by TEXT, created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rad_studies (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, modality TEXT, body_part TEXT,
  status TEXT DEFAULT 'scheduled',       -- scheduled|acquired|reported
  image_seed TEXT,                       -- deterministic key for the PACS-lite viewer
  findings TEXT, impression TEXT, radiologist_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS med_catalog (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, form TEXT, strength TEXT, atc TEXT,
  stock INTEGER DEFAULT 0, reorder_level INTEGER DEFAULT 20, price REAL DEFAULT 0,
  interactions TEXT                      -- JSON array of med names
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY, encounter_id TEXT NOT NULL, med_id TEXT, name TEXT NOT NULL,
  dose TEXT, route TEXT, frequency TEXT, duration TEXT, qty INTEGER DEFAULT 1,
  status TEXT DEFAULT 'prescribed',      -- prescribed|verified|dispensed|cancelled
  prescribed_by TEXT, dispensed_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
);

-- Inter-department referrals (consults) — the cross-department workflow.
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL, encounter_id TEXT,
  from_department_id TEXT, to_department_id TEXT NOT NULL,
  from_staff_id TEXT, to_staff_id TEXT,
  reason TEXT, priority TEXT DEFAULT 'routine',
  status TEXT DEFAULT 'pending',         -- pending|accepted|completed|declined
  response TEXT,
  created_at TEXT DEFAULT (datetime('now')), responded_at TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Staff↔staff / department messaging threads ("data sending").
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY, subject TEXT, patient_id TEXT, kind TEXT DEFAULT 'direct',
  created_by TEXT, created_at TEXT DEFAULT (datetime('now')), last_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS thread_members (
  thread_id TEXT NOT NULL, staff_id TEXT NOT NULL, read_at TEXT,
  PRIMARY KEY (thread_id, staff_id),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, author_id TEXT, body TEXT NOT NULL,
  attachment TEXT, created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS surgeries (
  id TEXT PRIMARY KEY, encounter_id TEXT, patient_id TEXT NOT NULL,
  theatre TEXT, procedure TEXT, surgeon_id TEXT, anesthesiologist_id TEXT,
  scheduled_at TEXT, duration_min INTEGER DEFAULT 60,
  status TEXT DEFAULT 'scheduled',       -- scheduled|in_progress|completed|cancelled
  checklist TEXT,                        -- JSON {signIn, timeOut, signOut, counts}
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, staff_id TEXT, department_id TEXT,
  starts_at TEXT NOT NULL, duration_min INTEGER DEFAULT 20,
  status TEXT DEFAULT 'booked',          -- booked|arrived|done|cancelled|no_show
  reason TEXT, created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, patient_id TEXT NOT NULL, encounter_id TEXT,
  total REAL DEFAULT 0, paid REAL DEFAULT 0, payer_type TEXT DEFAULT 'self',
  status TEXT DEFAULT 'open',            -- open|partial|paid|void
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, description TEXT, qty INTEGER DEFAULT 1,
  unit_price REAL DEFAULT 0, amount REAL DEFAULT 0, source TEXT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, amount REAL, method TEXT, created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, scope TEXT, target_role TEXT, target_staff_id TEXT,
  severity TEXT DEFAULT 'info',          -- info|warn|critical
  title TEXT NOT NULL, body TEXT, link TEXT, entity TEXT, entity_id TEXT,
  read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, actor_id TEXT, actor_name TEXT, actor_role TEXT,
  action TEXT, entity TEXT, entity_id TEXT, detail TEXT, ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Billable services for the cashier (consultations, procedures, packages, panels).
CREATE TABLE IF NOT EXISTS service_catalog (
  id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, category TEXT, price REAL DEFAULT 0, department_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_enc_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_enc_status ON encounters(status);
CREATE INDEX IF NOT EXISTS idx_vitals_enc ON vitals(encounter_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_orders_enc ON orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_rx_enc ON prescriptions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ref_to ON referrals(to_department_id, status);
CREATE INDEX IF NOT EXISTS idx_msg_thread ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_appt_staff ON appointments(staff_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_notif ON notifications(target_role, read, created_at);
`);

// Backwards-compatible migrations for databases created before a column existed.
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn("staff", "photo_url", "photo_url TEXT");
ensureColumn("staff", "rating", "rating REAL DEFAULT 4.7");

export default db;
