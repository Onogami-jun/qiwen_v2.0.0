/**
 * chat.js — 面板系统 + AI 对话 IPC 处理器
 */
const log = require('electron-log');
const { ipcMain } = require('electron');
const { getDb } = require('../database/db');

function registerChatHandlers() {
  const db = getDb();

  // Ensure meta column exists (lazy migration)
  try {
    db.prepare("ALTER TABLE chat_messages ADD COLUMN meta TEXT DEFAULT ''").run();
  } catch {}

  // ── 面板布局 ──────────────────────────────────────

  ipcMain.handle('db:getPanelLayout', (_, documentId) => {
    try {
      const row = db.prepare('SELECT layout_json FROM panel_layouts WHERE document_id = ?').get(documentId);
      return row ? row.layout_json : null;
    } catch (e) { return null; }
  });

  ipcMain.handle('db:savePanelLayout', (_, { documentId, layoutJson }) => {
    try {
      db.prepare(`INSERT INTO panel_layouts (document_id, layout_json, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(document_id) DO UPDATE SET layout_json=excluded.layout_json, updated_at=datetime('now')`).run(documentId, layoutJson);
      return true;
    } catch (e) { return false; }
  });

  // ── 对话消息 ──────────────────────────────────────

  ipcMain.handle('db:getChatMessages', (_, { documentId, limit = 50 }) => {
    try {
      const rows = db.prepare(`SELECT id, document_id, role, content, meta, created_at FROM chat_messages WHERE document_id=? ORDER BY created_at ASC LIMIT ?`).all(documentId, limit);
      return rows.map(r => ({ id: r.id, documentId: r.document_id, role: r.role, content: r.content, meta: r.meta || null, createdAt: r.created_at }));
    } catch (e) { return []; }
  });

  ipcMain.handle('db:saveChatMessage', (_, msg) => {
    try {
      const meta = msg.meta ? JSON.stringify(msg.meta) : '';
      db.prepare(`INSERT OR REPLACE INTO chat_messages (id, document_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(msg.id, msg.documentId, msg.role, msg.content, meta);
      return true;
    } catch (e) {
      // Fallback: if meta column doesn't exist
      try {
        db.prepare(`INSERT OR REPLACE INTO chat_messages (id, document_id, role, content, created_at) VALUES (?, ?, ?, ?, datetime('now'))`).run(msg.id, msg.documentId, msg.role, msg.content);
        return true;
      } catch (e2) { return false; }
    }
  });

  ipcMain.handle('db:clearChatMessages', (_, documentId) => {
    try { db.prepare('DELETE FROM chat_messages WHERE document_id=?').run(documentId); return true; } catch (e) { return false; }
  });

  // ── 写作偏好 ──────────────────────────────────────

  ipcMain.handle('db:getWritingPreference', (_, key) => {
    try { const r = db.prepare('SELECT value FROM writing_preferences WHERE key=?').get(key); return r ? r.value : null; } catch (e) { return null; }
  });

  ipcMain.handle('db:setWritingPreference', (_, { key, value }) => {
    try { db.prepare(`INSERT INTO writing_preferences (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`).run(key, value); return true; } catch (e) { return false; }
  });

  ipcMain.handle('db:getAllWritingPreferences', () => {
    try { const rows = db.prepare('SELECT key, value, updated_at FROM writing_preferences').all(); const r = {}; rows.forEach(x => r[x.key] = x.value); return r; } catch (e) { return {}; }
  });

  log.info('[chat] Panel and chat IPC handlers registered');
}

module.exports = { registerChatHandlers };
