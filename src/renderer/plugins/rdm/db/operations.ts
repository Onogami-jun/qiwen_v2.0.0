/**
 * 数据库操作层 — 所有模块的 CRUD
 * 插件版通过 window.electronAPI.invoke 调用 IPC
 * 独立版直接传入 db 实例调用
 */
import { v4 as uuid } from 'uuid';
import type {
  Experiment, ExperimentVersion, Sample, SampleLog,
  Project, Task, Instrument, InstrumentReservation,
  Approval, PurchaseRequest, AuditLog, DashboardStats,
} from '../types';

// ── 通用工具 ─────────────────────────────────────────────────
function now() { return new Date().toISOString(); }
function parseJSON(s: string | null, fallback: any = []) {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
function row2exp(r: any): Experiment {
  return { ...r, tags: parseJSON(r.tags, []), isSigned: !!r.is_signed, projectId: r.project_id, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at, signedAt: r.signed_at };
}
function row2sample(r: any): Sample {
  return { ...r, isHazardous: !!r.is_hazardous, batchNo: r.batch_no, casNo: r.cas_no, storageCondition: r.storage_condition, expiryDate: r.expiry_date, certificatePath: r.certificate_path, lowStockThreshold: r.low_stock_threshold, createdAt: r.created_at, updatedAt: r.updated_at };
}

// ════════════════════════════════════════════════════════════
// ELN — 实验记录
// ════════════════════════════════════════════════════════════
export function listExperiments(db: any, opts: { projectId?: string; status?: string; search?: string } = {}): Experiment[] {
  let sql = 'SELECT * FROM rdm_experiments WHERE 1=1';
  const params: any[] = [];
  if (opts.projectId) { sql += ' AND project_id=?'; params.push(opts.projectId); }
  if (opts.status) { sql += ' AND status=?'; params.push(opts.status); }
  if (opts.search) { sql += ' AND (title LIKE ? OR content LIKE ?)'; params.push(`%${opts.search}%`, `%${opts.search}%`); }
  sql += ' ORDER BY updated_at DESC';
  const stmt = db.prepare(sql);
  const rows = stmt.all ? stmt.all(params) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map(row2exp);
}

export function getExperiment(db: any, id: string): Experiment | null {
  const stmt = db.prepare('SELECT * FROM rdm_experiments WHERE id=?');
  const row = stmt.get ? stmt.get([id]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return row ? row2exp(row) : null;
}

export function createExperiment(db: any, data: Partial<Experiment> & { createdBy: string; title: string }): Experiment {
  const id = uuid();
  const n = now();
  db.prepare(`INSERT INTO rdm_experiments (id,title,content,project_id,status,tags,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run([id, data.title, data.content||'', data.projectId||null, data.status||'draft', JSON.stringify(data.tags||[]), data.createdBy, n, n]);
  return getExperiment(db, id)!;
}

export function updateExperiment(db: any, id: string, data: Partial<Experiment>): Experiment {
  // 先保存版本
  const old = getExperiment(db, id);
  if (old) {
    const vStmt = db.prepare('SELECT COUNT(*) as c FROM rdm_experiment_versions WHERE experiment_id=?');
    const r = vStmt.get ? vStmt.get([id]) : (vStmt.step() ? vStmt.getAsObject() : {c:0});
    vStmt.free?.();
    db.prepare('INSERT INTO rdm_experiment_versions (id,experiment_id,version,content,saved_at) VALUES (?,?,?,?,?)')
      .run([uuid(), id, (r.c||0)+1, old.content, now()]);
  }
  const fields: string[] = ['updated_at=?'];
  const vals: any[] = [now()];
  if (data.title !== undefined) { fields.push('title=?'); vals.push(data.title); }
  if (data.content !== undefined) { fields.push('content=?'); vals.push(data.content); }
  if (data.status !== undefined) { fields.push('status=?'); vals.push(data.status); }
  if (data.tags !== undefined) { fields.push('tags=?'); vals.push(JSON.stringify(data.tags)); }
  if (data.isSigned !== undefined) { fields.push('is_signed=?'); vals.push(data.isSigned ? 1 : 0); }
  if (data.signer !== undefined) { fields.push('signer=?'); vals.push(data.signer); }
  if (data.signedAt !== undefined) { fields.push('signed_at=?'); vals.push(data.signedAt); }
  vals.push(id);
  db.prepare(`UPDATE rdm_experiments SET ${fields.join(',')} WHERE id=?`).run(vals);
  return getExperiment(db, id)!;
}

export function deleteExperiment(db: any, id: string) {
  db.prepare('DELETE FROM rdm_experiments WHERE id=?').run([id]);
}

export function getExperimentVersions(db: any, experimentId: string): ExperimentVersion[] {
  const stmt = db.prepare('SELECT * FROM rdm_experiment_versions WHERE experiment_id=? ORDER BY version DESC');
  const rows = stmt.all ? stmt.all([experimentId]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, experimentId: r.experiment_id, savedAt: r.saved_at, savedBy: r.saved_by }));
}

// ════════════════════════════════════════════════════════════
// 样品库存
// ════════════════════════════════════════════════════════════
export function listSamples(db: any, opts: { search?: string; type?: string; location?: string } = {}): Sample[] {
  let sql = 'SELECT * FROM rdm_samples WHERE 1=1';
  const params: any[] = [];
  if (opts.search) { sql += ' AND (name LIKE ? OR cas_no LIKE ? OR barcode LIKE ?)'; params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`); }
  if (opts.type) { sql += ' AND type=?'; params.push(opts.type); }
  if (opts.location) { sql += ' AND location=?'; params.push(opts.location); }
  sql += ' ORDER BY name ASC';
  const stmt = db.prepare(sql);
  const rows = stmt.all ? stmt.all(params) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map(row2sample);
}

export function getSample(db: any, id: string): Sample | null {
  const stmt = db.prepare('SELECT * FROM rdm_samples WHERE id=?');
  const row = stmt.get ? stmt.get([id]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return row ? row2sample(row) : null;
}

export function createSample(db: any, data: Partial<Sample> & { name: string }): Sample {
  const id = uuid();
  const n = now();
  const barcode = data.barcode || `RDM-${Date.now()}`;
  db.prepare(`INSERT INTO rdm_samples (id,name,type,batch_no,cas_no,supplier,storage_condition,quantity,unit,expiry_date,location,barcode,is_hazardous,certificate_path,low_stock_threshold,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run([id, data.name, data.type||'', data.batchNo||'', data.casNo||null, data.supplier||null, data.storageCondition||null, data.quantity||0, data.unit||'g', data.expiryDate||null, data.location||null, barcode, data.isHazardous?1:0, data.certificatePath||null, data.lowStockThreshold||null, n, n]);
  return getSample(db, id)!;
}

export function updateSampleQuantity(db: any, sampleId: string, delta: number, operation: SampleLog['operation'], operator: string, remark?: string, experimentId?: string): SampleLog {
  const sample = getSample(db, sampleId);
  if (!sample) throw new Error('样品不存在');
  const after = sample.quantity + delta;
  if (after < 0) throw new Error('库存不足');
  db.prepare('UPDATE rdm_samples SET quantity=?, updated_at=? WHERE id=?').run([after, now(), sampleId]);
  const logId = uuid();
  db.prepare(`INSERT INTO rdm_sample_logs (id,sample_id,operation,quantity_change,quantity_after,operator,operated_at,remark,experiment_id)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run([logId, sampleId, operation, delta, after, operator, now(), remark||null, experimentId||null]);
  const stmt = db.prepare('SELECT * FROM rdm_sample_logs WHERE id=?');
  const row = stmt.get ? stmt.get([logId]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return { ...row, sampleId: row.sample_id, quantityChange: row.quantity_change, quantityAfter: row.quantity_after, operatedAt: row.operated_at, experimentId: row.experiment_id };
}

export function getLowStockSamples(db: any): Sample[] {
  const stmt = db.prepare('SELECT * FROM rdm_samples WHERE low_stock_threshold IS NOT NULL AND quantity <= low_stock_threshold ORDER BY quantity ASC');
  const rows = stmt.all ? stmt.all([]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map(row2sample);
}

export function getExpiringSamples(db: any, days: number = 30): Sample[] {
  const cutoff = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  const stmt = db.prepare('SELECT * FROM rdm_samples WHERE expiry_date IS NOT NULL AND expiry_date <= ? ORDER BY expiry_date ASC');
  const rows = stmt.all ? stmt.all([cutoff]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map(row2sample);
}

export function getSampleLogs(db: any, sampleId: string): SampleLog[] {
  const stmt = db.prepare('SELECT * FROM rdm_sample_logs WHERE sample_id=? ORDER BY operated_at DESC');
  const rows = stmt.all ? stmt.all([sampleId]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, sampleId: r.sample_id, quantityChange: r.quantity_change, quantityAfter: r.quantity_after, operatedAt: r.operated_at }));
}

// ════════════════════════════════════════════════════════════
// 项目 & 任务
// ════════════════════════════════════════════════════════════
export function listProjects(db: any): Project[] {
  const stmt = db.prepare('SELECT * FROM rdm_projects ORDER BY created_at DESC');
  const rows = stmt.all ? stmt.all([]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, ownerId: r.owner_id, startDate: r.start_date, endDate: r.end_date, createdAt: r.created_at }));
}

export function createProject(db: any, data: Partial<Project> & { name: string; ownerId: string }): Project {
  const id = uuid();
  const n = now();
  db.prepare(`INSERT INTO rdm_projects (id,name,description,owner_id,start_date,end_date,budget,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run([id, data.name, data.description||'', data.ownerId, data.startDate||null, data.endDate||null, data.budget||null, data.status||'active', n, n]);
  const stmt = db.prepare('SELECT * FROM rdm_projects WHERE id=?');
  const row = stmt.get ? stmt.get([id]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return { ...row, ownerId: row.owner_id, startDate: row.start_date, endDate: row.end_date, createdAt: row.created_at };
}

export function listTasks(db: any, projectId: string): Task[] {
  const stmt = db.prepare('SELECT * FROM rdm_tasks WHERE project_id=? ORDER BY priority DESC, due_date ASC');
  const rows = stmt.all ? stmt.all([projectId]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, projectId: r.project_id, parentTaskId: r.parent_task_id, assigneeId: r.assignee_id, estimatedHours: r.estimated_hours, actualHours: r.actual_hours, dueDate: r.due_date, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function createTask(db: any, data: Partial<Task> & { projectId: string; title: string }): Task {
  const id = uuid();
  const n = now();
  db.prepare(`INSERT INTO rdm_tasks (id,project_id,parent_task_id,title,description,assignee_id,status,priority,estimated_hours,actual_hours,due_date,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run([id, data.projectId, data.parentTaskId||null, data.title, data.description||'', data.assigneeId||null, data.status||'pending', data.priority||'medium', data.estimatedHours||null, data.actualHours||null, data.dueDate||null, n, n]);
  const stmt = db.prepare('SELECT * FROM rdm_tasks WHERE id=?');
  const row = stmt.get ? stmt.get([id]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return { ...row, projectId: row.project_id, parentTaskId: row.parent_task_id, assigneeId: row.assignee_id, estimatedHours: row.estimated_hours, actualHours: row.actual_hours, dueDate: row.due_date, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function updateTaskStatus(db: any, id: string, status: Task['status']) {
  db.prepare('UPDATE rdm_tasks SET status=?, updated_at=? WHERE id=?').run([status, now(), id]);
}

// ════════════════════════════════════════════════════════════
// 仪器
// ════════════════════════════════════════════════════════════
export function listInstruments(db: any): Instrument[] {
  const stmt = db.prepare('SELECT * FROM rdm_instruments ORDER BY name ASC');
  const rows = stmt.all ? stmt.all([]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, lastMaintenance: r.last_maintenance, nextMaintenance: r.next_maintenance, manualPath: r.manual_path, createdAt: r.created_at }));
}

export function createInstrument(db: any, data: Partial<Instrument> & { name: string }): Instrument {
  const id = uuid();
  db.prepare(`INSERT INTO rdm_instruments (id,name,model,location,status,last_maintenance,next_maintenance,manual_path,description,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run([id, data.name, data.model||null, data.location||null, data.status||'normal', data.lastMaintenance||null, data.nextMaintenance||null, data.manualPath||null, data.description||null, now()]);
  const stmt = db.prepare('SELECT * FROM rdm_instruments WHERE id=?');
  const row = stmt.get ? stmt.get([id]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return { ...row, lastMaintenance: row.last_maintenance, nextMaintenance: row.next_maintenance, manualPath: row.manual_path, createdAt: row.created_at };
}

export function getInstrumentReservations(db: any, instrumentId: string, date?: string): InstrumentReservation[] {
  let sql = 'SELECT * FROM rdm_instrument_reservations WHERE instrument_id=? AND status != ?';
  const params: any[] = [instrumentId, 'cancelled'];
  if (date) { sql += ' AND date(start_time)=?'; params.push(date); }
  sql += ' ORDER BY start_time ASC';
  const stmt = db.prepare(sql);
  const rows = stmt.all ? stmt.all(params) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, instrumentId: r.instrument_id, userId: r.user_id, startTime: r.start_time, endTime: r.end_time, createdAt: r.created_at }));
}

export function createReservation(db: any, data: Partial<InstrumentReservation> & { instrumentId: string; userId: string; startTime: string; endTime: string }): InstrumentReservation {
  // 冲突检测
  const stmt = db.prepare(`SELECT id FROM rdm_instrument_reservations WHERE instrument_id=? AND status NOT IN ('cancelled') AND NOT (end_time <= ? OR start_time >= ?)`);
  const conflicts = stmt.all ? stmt.all([data.instrumentId, data.startTime, data.endTime]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  if (conflicts.length > 0) throw new Error('该时段已有预约，请选择其他时间');
  const id = uuid();
  db.prepare(`INSERT INTO rdm_instrument_reservations (id,instrument_id,user_id,start_time,end_time,purpose,status,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run([id, data.instrumentId, data.userId, data.startTime, data.endTime, data.purpose||null, 'reserved', now()]);
  const s2 = db.prepare('SELECT * FROM rdm_instrument_reservations WHERE id=?');
  const row = s2.get ? s2.get([id]) : (s2.step() ? s2.getAsObject() : null);
  s2.free?.();
  return { ...row, instrumentId: row.instrument_id, userId: row.user_id, startTime: row.start_time, endTime: row.end_time, createdAt: row.created_at };
}

// ════════════════════════════════════════════════════════════
// 审批
// ════════════════════════════════════════════════════════════
export function listApprovals(db: any, status?: string): Approval[] {
  let sql = 'SELECT * FROM rdm_approvals WHERE 1=1';
  const params: any[] = [];
  if (status) { sql += ' AND status=?'; params.push(status); }
  sql += ' ORDER BY applied_at DESC';
  const stmt = db.prepare(sql);
  const rows = stmt.all ? stmt.all(params) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, targetType: r.target_type, targetId: r.target_id, requesterId: r.requester_id, approverId: r.approver_id, appliedAt: r.applied_at, resolvedAt: r.resolved_at }));
}

export function createApproval(db: any, data: Partial<Approval> & { targetType: Approval['targetType']; targetId: string; requesterId: string }): Approval {
  const id = uuid();
  db.prepare(`INSERT INTO rdm_approvals (id,target_type,target_id,requester_id,status,applied_at) VALUES (?,?,?,?,?,?)`)
    .run([id, data.targetType, data.targetId, data.requesterId, 'pending', now()]);
  const stmt = db.prepare('SELECT * FROM rdm_approvals WHERE id=?');
  const row = stmt.get ? stmt.get([id]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return { ...row, targetType: row.target_type, targetId: row.target_id, requesterId: row.requester_id, approverId: row.approver_id, appliedAt: row.applied_at, resolvedAt: row.resolved_at };
}

export function resolveApproval(db: any, id: string, approverId: string, approved: boolean, remark?: string) {
  db.prepare('UPDATE rdm_approvals SET status=?, approver_id=?, resolved_at=?, remark=? WHERE id=?')
    .run([approved ? 'approved' : 'rejected', approverId, now(), remark||null, id]);
}

// ════════════════════════════════════════════════════════════
// 审计日志
// ════════════════════════════════════════════════════════════
export function logAudit(db: any, data: { userId?: string; action: string; tableName: string; recordId: string; oldData?: any; newData?: any }) {
  db.prepare(`INSERT INTO rdm_audit_logs (id,user_id,action,table_name,record_id,old_data,new_data,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run([uuid(), data.userId||null, data.action, data.tableName, data.recordId, data.oldData ? JSON.stringify(data.oldData) : null, data.newData ? JSON.stringify(data.newData) : null, now()]);
}

export function listAuditLogs(db: any, opts: { tableName?: string; userId?: string; limit?: number } = {}): AuditLog[] {
  let sql = 'SELECT * FROM rdm_audit_logs WHERE 1=1';
  const params: any[] = [];
  if (opts.tableName) { sql += ' AND table_name=?'; params.push(opts.tableName); }
  if (opts.userId) { sql += ' AND user_id=?'; params.push(opts.userId); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(opts.limit || 200);
  const stmt = db.prepare(sql);
  const rows = stmt.all ? stmt.all(params) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return rows.map((r: any) => ({ ...r, userId: r.user_id, tableName: r.table_name, recordId: r.record_id, oldData: r.old_data ? JSON.parse(r.old_data) : null, newData: r.new_data ? JSON.parse(r.new_data) : null, createdAt: r.created_at }));
}

// ════════════════════════════════════════════════════════════
// 仪表盘统计
// ════════════════════════════════════════════════════════════
export function getDashboardStats(db: any): DashboardStats {
  const q = (sql: string, params: any[] = []) => {
    const stmt = db.prepare(sql);
    const row = stmt.get ? stmt.get(params) : (stmt.step() ? stmt.getAsObject() : {});
    stmt.free?.();
    return row;
  };
  const today = new Date().toISOString().split('T')[0];
  const cutoff30 = new Date(Date.now() - 30*86400000).toISOString();
  return {
    totalExperiments: q('SELECT COUNT(*) as c FROM rdm_experiments').c || 0,
    activeExperiments: q("SELECT COUNT(*) as c FROM rdm_experiments WHERE status='in_progress'").c || 0,
    totalSamples: q('SELECT COUNT(*) as c FROM rdm_samples').c || 0,
    lowStockCount: q('SELECT COUNT(*) as c FROM rdm_samples WHERE low_stock_threshold IS NOT NULL AND quantity <= low_stock_threshold').c || 0,
    expiringSoonCount: q(`SELECT COUNT(*) as c FROM rdm_samples WHERE expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days')`).c || 0,
    pendingTasks: q("SELECT COUNT(*) as c FROM rdm_tasks WHERE status='pending'").c || 0,
    pendingApprovals: q("SELECT COUNT(*) as c FROM rdm_approvals WHERE status='pending'").c || 0,
    todayReservations: q(`SELECT COUNT(*) as c FROM rdm_instrument_reservations WHERE date(start_time)=? AND status!='cancelled'`, [today]).c || 0,
    recentExperiments: listExperiments(db, {}).slice(0, 5),
    recentLogs: (() => {
      const stmt = db.prepare('SELECT * FROM rdm_sample_logs ORDER BY operated_at DESC LIMIT 5');
      const rows = stmt.all ? stmt.all([]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
      stmt.free?.();
      return rows.map((r: any) => ({ ...r, sampleId: r.sample_id, quantityChange: r.quantity_change, quantityAfter: r.quantity_after, operatedAt: r.operated_at }));
    })(),
  };
}

// ════════════════════════════════════════════════════════════
// 系统设置
// ════════════════════════════════════════════════════════════
export function getSetting(db: any, key: string): string | null {
  const stmt = db.prepare('SELECT value FROM rdm_settings WHERE key=?');
  const row = stmt.get ? stmt.get([key]) : (stmt.step() ? stmt.getAsObject() : null);
  stmt.free?.();
  return row?.value ?? null;
}

export function setSetting(db: any, key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO rdm_settings (key,value) VALUES (?,?)').run([key, value]);
}

export function getAllSettings(db: any): Record<string, string> {
  const stmt = db.prepare('SELECT key, value FROM rdm_settings');
  const rows = stmt.all ? stmt.all([]) : (() => { const r=[]; while(stmt.step()) r.push(stmt.getAsObject()); return r; })();
  stmt.free?.();
  return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
}
