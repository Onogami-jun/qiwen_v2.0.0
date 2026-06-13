/**
 * 科研数据管理平台 — IPC Handlers
 * 放到启文项目的 src/main/ipc/rdm.js
 * 在 main.js 的 setupIPC() 里加一行：require('./rdm').registerRdmHandlers()
 */
const { ipcMain } = require('electron');
const { v4: uuid } = require('uuid');

function registerRdmHandlers(getDb) {
  // ── schema 初始化（首次调用时建表） ──
  let initialized = false;
  function ensureSchema() {
    if (initialized) return;
    const db = getDb();
    const SCHEMA = require('../../../plugin/src/db/schemaSQL').SCHEMA;
    db.run(SCHEMA);
    initialized = true;
  }

  function handle(channel, fn) {
    ipcMain.handle(channel, async (_, ...args) => {
      ensureSchema();
      return fn(getDb(), ...args);
    });
  }

  const ops = require('../../../plugin/src/db/operationsNode');

  // ELN
  handle('rdm:experiments:list',   (db, opts) => ops.listExperiments(db, opts));
  handle('rdm:experiments:create', (db, data) => ops.createExperiment(db, data));
  handle('rdm:experiments:update', (db, { id, data }) => ops.updateExperiment(db, id, data));
  handle('rdm:experiments:delete', (db, { id }) => ops.deleteExperiment(db, id));
  handle('rdm:experiments:versions', (db, { id }) => ops.getExperimentVersions(db, id));

  // Samples
  handle('rdm:samples:list',      (db, opts) => ops.listSamples(db, opts));
  handle('rdm:samples:create',    (db, data) => ops.createSample(db, data));
  handle('rdm:samples:updateQty', (db, { sampleId, delta, operation, operator, remark }) =>
    ops.updateSampleQuantity(db, sampleId, delta, operation, operator, remark));
  handle('rdm:samples:lowStock',  (db) => ops.getLowStockSamples(db));
  handle('rdm:samples:expiring',  (db, { days }) => ops.getExpiringSamples(db, days));
  handle('rdm:samples:logs',      (db, { id }) => ops.getSampleLogs(db, id));

  // Projects
  handle('rdm:projects:list',   (db) => ops.listProjects(db));
  handle('rdm:projects:create', (db, data) => ops.createProject(db, data));

  // Tasks
  handle('rdm:tasks:list',         (db, { projectId }) => ops.listTasks(db, projectId));
  handle('rdm:tasks:create',       (db, data) => ops.createTask(db, data));
  handle('rdm:tasks:updateStatus', (db, { id, status }) => ops.updateTaskStatus(db, id, status));

  // Instruments
  handle('rdm:instruments:list',              (db) => ops.listInstruments(db));
  handle('rdm:instruments:create',            (db, data) => ops.createInstrument(db, data));
  handle('rdm:instruments:reservations',      (db, { instrumentId, date }) => ops.getInstrumentReservations(db, instrumentId, date));
  handle('rdm:instruments:createReservation', (db, data) => ops.createReservation(db, data));

  // Approvals
  handle('rdm:approvals:list',    (db, { status }) => ops.listApprovals(db, status));
  handle('rdm:approvals:resolve', (db, { id, approverId, approved, remark }) =>
    ops.resolveApproval(db, id, approverId, approved, remark));

  // Dashboard
  handle('rdm:dashboard:stats', (db) => ops.getDashboardStats(db));

  // Audit
  handle('rdm:audit:list', (db, opts) => ops.listAuditLogs(db, opts));

  // Settings
  handle('rdm:settings:get',    (db, { key }) => ops.getSetting(db, key));
  handle('rdm:settings:set',    (db, { key, value }) => ops.setSetting(db, key, value));
  handle('rdm:settings:getAll', (db) => ops.getAllSettings(db));
}

module.exports = { registerRdmHandlers };
