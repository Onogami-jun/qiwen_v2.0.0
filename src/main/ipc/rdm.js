/**
 * 科研数据管理平台 — IPC Handlers (Main Process)
 * 自包含版本，直接在 main.js setupIPC 中 require 并调用
 */
const { ipcMain } = require('electron');
const { v4: uuid } = require('uuid');
const log = require('electron-log');

const SCHEMA = `
PRAGMA foreign_keys=ON;

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
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_experiment_versions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now')),
  saved_by TEXT,
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
  experiment_id TEXT
);

CREATE TABLE IF NOT EXISTS rdm_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id TEXT NOT NULL DEFAULT 'user',
  start_date TEXT,
  end_date TEXT,
  budget REAL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  user_id TEXT NOT NULL DEFAULT 'user',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rdm_approvals (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  requester_id TEXT NOT NULL DEFAULT 'user',
  approver_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  remark TEXT
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

CREATE INDEX IF NOT EXISTS idx_rdm_exp_status  ON rdm_experiments(status);
CREATE INDEX IF NOT EXISTS idx_rdm_exp_updated ON rdm_experiments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rdm_sample_name ON rdm_samples(name);
`;

function now() { return new Date().toISOString(); }

function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = stmt.all ? stmt.all(params) : (() => {
    if (params.length) stmt.bind(params);
    const r = [];
    while (stmt.step()) r.push(stmt.getAsObject());
    return r;
  })();
  stmt.free?.();
  return rows;
}

function dbGet(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const row = stmt.get ? stmt.get(params) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return row || null;
}

function dbRun(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (stmt.run) { stmt.run(params); } else { if (params.length) stmt.bind(params); stmt.step(); }
  stmt.free?.();
}

// ─── Row mappers ───────────────────────────────────────────
function row2exp(r) {
  if (!r) return null;
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch { tags = r.tags ? r.tags.split(',') : []; }
  return {
    id: r.id, title: r.title, content: r.content || '',
    projectId: r.project_id || null, status: r.status,
    tags, isSigned: Boolean(r.is_signed),
    signer: r.signer || null, signedAt: r.signed_at || null,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function row2sample(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, type: r.type, batchNo: r.batch_no,
    casNo: r.cas_no, supplier: r.supplier, storageCondition: r.storage_condition,
    quantity: r.quantity, unit: r.unit, expiryDate: r.expiry_date,
    location: r.location, barcode: r.barcode, isHazardous: Boolean(r.is_hazardous),
    certificatePath: r.certificate_path, lowStockThreshold: r.low_stock_threshold,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ─── Register all handlers ─────────────────────────────────
function registerRdmHandlers(getDb, saveDatabase) {
  let schemaReady = false;

  function ensureSchema() {
    if (schemaReady) return;
    try {
      const db = getDb();
      // Run each CREATE TABLE separately for sql.js compatibility
      const stmts = SCHEMA.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
      for (const stmt of stmts) {
        try { db.run(stmt + ';'); } catch (e) { /* ignore if already exists */ }
      }
      schemaReady = true;
      if (saveDatabase) saveDatabase();
      log.info('[RDM] Schema initialized');
    } catch (e) {
      log.error('[RDM] Schema init failed:', e);
    }
  }

  function handle(channel, fn) {
    ipcMain.handle(channel, async (_, ...args) => {
      ensureSchema();
      const db = getDb();
      try {
        const result = fn(db, ...args);
        if (saveDatabase) saveDatabase();
        return result;
      } catch (e) {
        log.error(`[RDM] ${channel} failed:`, e);
        throw e;
      }
    });
  }

  // ── ELN: Experiments ──────────────────────────────────────
  handle('rdm:experiments:list', (db, opts = {}) => {
    let sql = 'SELECT * FROM rdm_experiments WHERE 1=1';
    const params = [];
    if (opts.search) { sql += ' AND (title LIKE ? OR content LIKE ?)'; params.push(`%${opts.search}%`, `%${opts.search}%`); }
    if (opts.status)  { sql += ' AND status=?'; params.push(opts.status); }
    if (opts.projectId) { sql += ' AND project_id=?'; params.push(opts.projectId); }
    sql += ' ORDER BY updated_at DESC';
    return dbAll(db, sql, params).map(row2exp);
  });

  handle('rdm:experiments:create', (db, data) => {
    const id = uuid();
    const n = now();
    const tags = JSON.stringify(Array.isArray(data.tags) ? data.tags : []);
    dbRun(db, `INSERT INTO rdm_experiments (id,title,content,project_id,status,tags,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, data.title, data.content||'', data.projectId||null, data.status||'draft', tags, data.createdBy||'user', n, n]);
    return row2exp(dbGet(db, 'SELECT * FROM rdm_experiments WHERE id=?', [id]));
  });

  handle('rdm:experiments:update', (db, { id, data }) => {
    const fields = ['updated_at=?'];
    const vals = [now()];
    if (data.title     !== undefined) { fields.push('title=?');     vals.push(data.title); }
    if (data.content   !== undefined) { fields.push('content=?');   vals.push(data.content); }
    if (data.status    !== undefined) { fields.push('status=?');    vals.push(data.status); }
    if (data.tags      !== undefined) { fields.push('tags=?');      vals.push(JSON.stringify(data.tags)); }
    if (data.isSigned  !== undefined) { fields.push('is_signed=?'); vals.push(data.isSigned ? 1 : 0); }
    if (data.signer    !== undefined) { fields.push('signer=?');    vals.push(data.signer); }
    if (data.signedAt  !== undefined) { fields.push('signed_at=?'); vals.push(data.signedAt); }
    vals.push(id);
    dbRun(db, `UPDATE rdm_experiments SET ${fields.join(',')} WHERE id=?`, vals);
    return row2exp(dbGet(db, 'SELECT * FROM rdm_experiments WHERE id=?', [id]));
  });

  handle('rdm:experiments:delete', (db, { id }) => {
    dbRun(db, 'DELETE FROM rdm_experiments WHERE id=?', [id]);
    return { ok: true };
  });

  handle('rdm:experiments:versions', (db, { id }) => {
    return dbAll(db, 'SELECT * FROM rdm_experiment_versions WHERE experiment_id=? ORDER BY version DESC', [id]);
  });

  // ── Samples ───────────────────────────────────────────────
  handle('rdm:samples:list', (db, opts = {}) => {
    let sql = 'SELECT * FROM rdm_samples WHERE 1=1';
    const params = [];
    if (opts.search) { sql += ' AND (name LIKE ? OR cas_no LIKE ? OR barcode LIKE ?)'; params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`); }
    if (opts.type)   { sql += ' AND type=?'; params.push(opts.type); }
    sql += ' ORDER BY name ASC';
    return dbAll(db, sql, params).map(row2sample);
  });

  handle('rdm:samples:create', (db, data) => {
    const id = uuid();
    const n = now();
    const barcode = data.barcode || `RDM-${Date.now()}`;
    dbRun(db, `INSERT INTO rdm_samples (id,name,type,batch_no,cas_no,supplier,storage_condition,quantity,unit,expiry_date,location,barcode,is_hazardous,certificate_path,low_stock_threshold,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, data.name, data.type||'', data.batchNo||'', data.casNo||null, data.supplier||null,
       data.storageCondition||null, data.quantity||0, data.unit||'g', data.expiryDate||null,
       data.location||null, barcode, data.isHazardous?1:0, data.certificatePath||null, data.lowStockThreshold||null, n, n]);
    return row2sample(dbGet(db, 'SELECT * FROM rdm_samples WHERE id=?', [id]));
  });

  handle('rdm:samples:updateQty', (db, { sampleId, delta, operation, operator, remark }) => {
    const sample = dbGet(db, 'SELECT * FROM rdm_samples WHERE id=?', [sampleId]);
    if (!sample) throw new Error('样品不存在');
    const after = sample.quantity + delta;
    if (after < 0) throw new Error('库存不足');
    dbRun(db, 'UPDATE rdm_samples SET quantity=?, updated_at=? WHERE id=?', [after, now(), sampleId]);
    const logId = uuid();
    dbRun(db, 'INSERT INTO rdm_sample_logs (id,sample_id,operation,quantity_change,quantity_after,operator,operated_at,remark) VALUES (?,?,?,?,?,?,?,?)',
      [logId, sampleId, operation, delta, after, operator, now(), remark||null]);
    return { ok: true, quantityAfter: after };
  });

  handle('rdm:samples:lowStock', (db) => {
    return dbAll(db, 'SELECT * FROM rdm_samples WHERE low_stock_threshold IS NOT NULL AND quantity <= low_stock_threshold ORDER BY quantity ASC').map(row2sample);
  });

  handle('rdm:samples:expiring', (db, { days = 30 } = {}) => {
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    return dbAll(db, 'SELECT * FROM rdm_samples WHERE expiry_date IS NOT NULL AND expiry_date <= ? ORDER BY expiry_date ASC', [cutoff]).map(row2sample);
  });

  handle('rdm:samples:logs', (db, { id }) => {
    return dbAll(db, 'SELECT * FROM rdm_sample_logs WHERE sample_id=? ORDER BY operated_at DESC', [id]);
  });

  // ── Projects ──────────────────────────────────────────────
  handle('rdm:projects:list', (db) => {
    return dbAll(db, 'SELECT * FROM rdm_projects WHERE status != ? ORDER BY updated_at DESC', ['archived']);
  });

  handle('rdm:projects:create', (db, data) => {
    const id = uuid();
    const n = now();
    dbRun(db, 'INSERT INTO rdm_projects (id,name,description,owner_id,start_date,end_date,budget,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, data.name, data.description||'', data.ownerId||'user', data.startDate||null, data.endDate||null, data.budget||null, 'active', n, n]);
    return dbGet(db, 'SELECT * FROM rdm_projects WHERE id=?', [id]);
  });

  // ── Tasks ─────────────────────────────────────────────────
  handle('rdm:tasks:list', (db, { projectId }) => {
    return dbAll(db, 'SELECT * FROM rdm_tasks WHERE project_id=? ORDER BY created_at DESC', [projectId]);
  });

  handle('rdm:tasks:create', (db, data) => {
    const id = uuid();
    const n = now();
    dbRun(db, 'INSERT INTO rdm_tasks (id,project_id,title,description,assignee_id,status,priority,estimated_hours,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, data.projectId, data.title, data.description||'', data.assigneeId||null, 'pending', data.priority||'medium', data.estimatedHours||null, data.dueDate||null, n, n]);
    return dbGet(db, 'SELECT * FROM rdm_tasks WHERE id=?', [id]);
  });

  handle('rdm:tasks:updateStatus', (db, { id, status }) => {
    dbRun(db, 'UPDATE rdm_tasks SET status=?, updated_at=? WHERE id=?', [status, now(), id]);
    return dbGet(db, 'SELECT * FROM rdm_tasks WHERE id=?', [id]);
  });

  // ── Instruments ───────────────────────────────────────────
  handle('rdm:instruments:list', (db) => {
    return dbAll(db, 'SELECT * FROM rdm_instruments ORDER BY name ASC');
  });

  handle('rdm:instruments:create', (db, data) => {
    const id = uuid();
    dbRun(db, 'INSERT INTO rdm_instruments (id,name,model,location,status,description,created_at) VALUES (?,?,?,?,?,?,?)',
      [id, data.name, data.model||null, data.location||null, 'normal', data.description||null, now()]);
    return dbGet(db, 'SELECT * FROM rdm_instruments WHERE id=?', [id]);
  });

  handle('rdm:instruments:reservations', (db, { instrumentId, date }) => {
    let sql = 'SELECT * FROM rdm_instrument_reservations WHERE instrument_id=?';
    const params = [instrumentId];
    if (date) { sql += ' AND (start_time LIKE ? OR end_time LIKE ?)'; params.push(`${date}%`, `${date}%`); }
    return dbAll(db, sql, params);
  });

  handle('rdm:instruments:createReservation', (db, data) => {
    const id = uuid();
    dbRun(db, 'INSERT INTO rdm_instrument_reservations (id,instrument_id,user_id,start_time,end_time,purpose,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, data.instrumentId, data.userId||'user', data.startTime, data.endTime, data.purpose||null, 'reserved', now()]);
    return dbGet(db, 'SELECT * FROM rdm_instrument_reservations WHERE id=?', [id]);
  });

  // ── Approvals ─────────────────────────────────────────────
  handle('rdm:approvals:list', (db, opts = {}) => {
    let sql = 'SELECT * FROM rdm_approvals WHERE 1=1';
    const params = [];
    if (opts.status) { sql += ' AND status=?'; params.push(opts.status); }
    sql += ' ORDER BY applied_at DESC';
    return dbAll(db, sql, params);
  });

  handle('rdm:approvals:create', (db, data) => {
    const id = uuid();
    dbRun(db, 'INSERT INTO rdm_approvals (id,target_type,target_id,requester_id,status,applied_at) VALUES (?,?,?,?,?,?)',
      [id, data.targetType, data.targetId, data.requesterId||'user', 'pending', now()]);
    return dbGet(db, 'SELECT * FROM rdm_approvals WHERE id=?', [id]);
  });

  handle('rdm:approvals:resolve', (db, { id, status, approverId, remark }) => {
    dbRun(db, 'UPDATE rdm_approvals SET status=?, approver_id=?, resolved_at=?, remark=? WHERE id=?',
      [status, approverId||'user', now(), remark||null, id]);
    return dbGet(db, 'SELECT * FROM rdm_approvals WHERE id=?', [id]);
  });

  // ── Audit logs ────────────────────────────────────────────
  handle('rdm:audit:list', (db, opts = {}) => {
    let sql = 'SELECT * FROM rdm_audit_logs WHERE 1=1';
    const params = [];
    if (opts.userId) { sql += ' AND user_id=?'; params.push(opts.userId); }
    if (opts.table)  { sql += ' AND table_name=?'; params.push(opts.table); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    return dbAll(db, sql, params);
  });

  // ── Dashboard stats ───────────────────────────────────────
  handle('rdm:dashboard:stats', (db) => {
    const expTotal       = (dbGet(db, 'SELECT COUNT(*) as c FROM rdm_experiments') || {}).c || 0;
    const expInProg      = (dbGet(db, "SELECT COUNT(*) as c FROM rdm_experiments WHERE status='in_progress'") || {}).c || 0;
    const sampleCount    = (dbGet(db, 'SELECT COUNT(*) as c FROM rdm_samples') || {}).c || 0;
    const lowStock       = (dbGet(db, 'SELECT COUNT(*) as c FROM rdm_samples WHERE low_stock_threshold IS NOT NULL AND quantity <= low_stock_threshold') || {}).c || 0;
    const expiringSoon   = (dbGet(db, `SELECT COUNT(*) as c FROM rdm_samples WHERE expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days')`) || {}).c || 0;
    const projCount      = (dbGet(db, "SELECT COUNT(*) as c FROM rdm_projects WHERE status='active'") || {}).c || 0;
    const pendingAppr    = (dbGet(db, "SELECT COUNT(*) as c FROM rdm_approvals WHERE status='pending'") || {}).c || 0;
    const pendingTasks   = (dbGet(db, "SELECT COUNT(*) as c FROM rdm_tasks WHERE status='pending'") || {}).c || 0;
    const todayRes       = (dbGet(db, `SELECT COUNT(*) as c FROM rdm_instrument_reservations WHERE date(start_time) = date('now')`) || {}).c || 0;
    const recentExps     = dbAll(db, 'SELECT * FROM rdm_experiments ORDER BY updated_at DESC LIMIT 5').map(row2exp);
    const recentLogs     = dbAll(db, 'SELECT * FROM rdm_sample_logs ORDER BY operated_at DESC LIMIT 5');

    return {
      // Fields expected by Dashboard component
      totalExperiments:  expTotal,
      activeExperiments: expInProg,
      totalSamples:      sampleCount,
      lowStockCount:     lowStock,
      expiringSoonCount: expiringSoon,
      activeProjects:    projCount,
      pendingApprovals:  pendingAppr,
      pendingTasks:      pendingTasks,
      todayReservations: todayRes,
      recentExperiments: recentExps,
      recentLogs:        recentLogs,
      // Aliases for compatibility
      inProgressExperiments: expInProg,
      lowStockAlerts:    lowStock,
    };
  });

  // ── Reports ───────────────────────────────────────────────
  handle('rdm:reports:generate', (db, { type, filters = {} }) => {
    if (type === 'experiments') {
      let sql = 'SELECT * FROM rdm_experiments WHERE 1=1';
      const params = [];
      if (filters.status) { sql += ' AND status=?'; params.push(filters.status); }
      if (filters.startDate) { sql += ' AND created_at >= ?'; params.push(filters.startDate); }
      if (filters.endDate)   { sql += ' AND created_at <= ?'; params.push(filters.endDate); }
      sql += ' ORDER BY updated_at DESC';
      return dbAll(db, sql, params).map(row2exp);
    }
    if (type === 'samples') {
      return dbAll(db, 'SELECT * FROM rdm_samples ORDER BY name ASC').map(row2sample);
    }
    return [];
  });

  log.info('[RDM] All IPC handlers registered');
}

module.exports = { registerRdmHandlers };
