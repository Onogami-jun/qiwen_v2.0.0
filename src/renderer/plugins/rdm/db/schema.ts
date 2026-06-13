/**
 * 科研数据管理平台 — 数据库层
 * 插件版用 Electron IPC 调用启文的 getDb()
 * 独立版用相同接口但自己管理数据库
 */

export const SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS rdm_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  budget REAL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_project_members (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'read',
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS rdm_experiments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  project_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  tags TEXT NOT NULL DEFAULT '[]',
  is_signed INTEGER NOT NULL DEFAULT 0,
  signer TEXT,
  signed_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_experiment_versions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now')),
  saved_by TEXT,
  FOREIGN KEY (experiment_id) REFERENCES rdm_experiments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rdm_attachments (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES rdm_experiments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rdm_samples (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  batch_no TEXT NOT NULL DEFAULT '',
  cas_no TEXT,
  supplier TEXT,
  storage_condition TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'g',
  expiry_date TEXT,
  location TEXT,
  barcode TEXT UNIQUE,
  is_hazardous INTEGER NOT NULL DEFAULT 0,
  certificate_path TEXT,
  low_stock_threshold REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_sample_logs (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  quantity_change REAL NOT NULL,
  quantity_after REAL NOT NULL,
  operator TEXT NOT NULL,
  operated_at TEXT NOT NULL DEFAULT (datetime('now')),
  remark TEXT,
  experiment_id TEXT,
  FOREIGN KEY (sample_id) REFERENCES rdm_samples(id)
);

CREATE TABLE IF NOT EXISTS rdm_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_task_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assignee_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  estimated_hours REAL,
  actual_hours REAL,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES rdm_projects(id)
);

CREATE TABLE IF NOT EXISTS rdm_instruments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'normal',
  last_maintenance TEXT,
  next_maintenance TEXT,
  manual_path TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_instrument_reservations (
  id TEXT PRIMARY KEY,
  instrument_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (instrument_id) REFERENCES rdm_instruments(id)
);

CREATE TABLE IF NOT EXISTS rdm_approvals (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  approver_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  remark TEXT
);

CREATE TABLE IF NOT EXISTS rdm_purchase_requests (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sample_id) REFERENCES rdm_samples(id)
);

CREATE TABLE IF NOT EXISTS rdm_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_data TEXT,
  new_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rdm_report_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',
  fields TEXT NOT NULL DEFAULT '[]',
  chart_type TEXT DEFAULT 'none',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rdm_exp_project ON rdm_experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_rdm_exp_status ON rdm_experiments(status);
CREATE INDEX IF NOT EXISTS idx_rdm_exp_updated ON rdm_experiments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rdm_sample_logs ON rdm_sample_logs(sample_id, operated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rdm_tasks_project ON rdm_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_rdm_reservations ON rdm_instrument_reservations(instrument_id, start_time);
CREATE INDEX IF NOT EXISTS idx_rdm_approvals_status ON rdm_approvals(status, target_type);
CREATE INDEX IF NOT EXISTS idx_rdm_audit ON rdm_audit_logs(table_name, record_id, created_at DESC);
`;

export const DEFAULT_SETTINGS = {
  lowStockAlertDays: '7',
  expiryAlertDays: '30',
  autoBackupEnabled: 'false',
  autoBackupInterval: '24',
  autoBackupPath: '',
  language: 'zh',
  theme: 'dark',
  webApiEnabled: 'false',
  webApiPort: '7788',
  teamMode: 'false',
};

/** 在指定 db 上执行 schema 初始化 */
export function initRdmSchema(db: any) {
  db.run(SCHEMA);
  // 写入默认设置
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO rdm_settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    insertSetting.run([k, v]);
  }
  insertSetting.free?.();
}
