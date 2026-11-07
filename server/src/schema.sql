-- Avya Woodcraft LLP attendance app - SQLite schema (tier 3: data)

CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS employees (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL,
  team_id      TEXT NOT NULL REFERENCES teams(id),
  hourly_rate  REAL NOT NULL DEFAULT 0,
  is_lead      INTEGER NOT NULL DEFAULT 0,
  is_manager   INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  photo        TEXT,
  pin_hash     TEXT,
  joined_on    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  in_min       INTEGER NOT NULL,
  out_min      INTEGER,
  hours        REAL NOT NULL DEFAULT 0,
  day_type     TEXT NOT NULL DEFAULT 'full',
  units        REAL,
  approved     INTEGER NOT NULL DEFAULT 0,
  distance_m   INTEGER,
  selfie       TEXT,
  in_ts        TEXT,
  out_ts       TEXT,
  approved_at  TEXT,
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);

CREATE TABLE IF NOT EXISTS work_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  task        TEXT NOT NULL,
  item        TEXT NOT NULL DEFAULT '',
  hours       REAL NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_date ON work_entries(date);

CREATE TABLE IF NOT EXISTS leave_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  from_date   TEXT NOT NULL,
  to_date     TEXT NOT NULL,
  reason      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  decided_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL DEFAULT '',
  model       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'authorized',
  paired_on   TEXT NOT NULL DEFAULT (date('now')),
  last_seen   TEXT
);

CREATE TABLE IF NOT EXISTS pairing_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocked_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  who         TEXT NOT NULL,
  device      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sunday_overrides (
  date   TEXT PRIMARY KEY,
  is_off INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  price      REAL NOT NULL DEFAULT 0,
  image      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_lines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  name       TEXT NOT NULL,
  qty        REAL NOT NULL,
  unit       TEXT NOT NULL DEFAULT 'pcs',
  rate       REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  category TEXT NOT NULL,
  unit     TEXT NOT NULL,
  qty      REAL NOT NULL DEFAULT 0,
  min_qty  REAL NOT NULL DEFAULT 0,
  rate     REAL NOT NULL DEFAULT 0,
  image    TEXT
);

CREATE TABLE IF NOT EXISTS material_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  qty          REAL NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'pcs',
  urgency      TEXT NOT NULL DEFAULT 'Normal',
  note         TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending',
  date         TEXT NOT NULL,
  decided_at   TEXT
);

CREATE TABLE IF NOT EXISTS petty_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  direction   TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount      REAL NOT NULL,
  paid_to     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS advances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  amount      REAL NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS advance_deductions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  advance_id INTEGER NOT NULL REFERENCES advances(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,
  amount     REAL NOT NULL,
  UNIQUE (advance_id, month)
);

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  customer   TEXT NOT NULL DEFAULT '',
  qty        INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_stages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  planned_days REAL NOT NULL DEFAULT 1,
  start_date   TEXT,
  done_date    TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stage_assignees (
  stage_id    INTEGER NOT NULL REFERENCES order_stages(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (stage_id, employee_id)
);
