/**
 * chat.js — 面板系统 + AI 对话 IPC 处理器
 * v2.0.0 Phase 1: 面板布局持久化、对话消息存储、写作偏好
 */

const log = require('electron-log');
const { ipcMain } = require('electron');
const { getDb } = require('../database/db');

function registerChatHandlers() {

  // ── 面板布局 ──────────────────────────────────────

  ipcMain.handle('db:getPanelLayout', (_, documentId) => {
    const db = getDb();
    try {
      const row = db.prepare(
        'SELECT layout_json FROM panel_layouts WHERE document_id = ?'
      ).get(documentId);
      return row ? row.layout_json : null;
    } catch (err) {
      log.warn('[chat] getPanelLayout failed:', err?.message);
      return null;
    }
  });

  ipcMain.handle('db:savePanelLayout', (_, { documentId, layoutJson }) => {
    const db = getDb();
    try {
      db.prepare(
        `INSERT INTO panel_layouts (document_id, layout_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(document_id) DO UPDATE SET
           layout_json = excluded.layout_json,
           updated_at = datetime('now')`
      ).run(documentId, layoutJson);
      return true;
    } catch (err) {
      log.warn('[chat] savePanelLayout failed:', err?.message);
      return false;
    }
  });

  // ── 对话消息 ──────────────────────────────────────

  ipcMain.handle('db:getChatMessages', (_, { documentId, limit = 50 }) => {
    const db = getDb();
    try {
      const rows = db.prepare(
        `SELECT id, document_id, role, content, created_at
         FROM chat_messages
         WHERE document_id = ?
         ORDER BY created_at ASC
         LIMIT ?`
      ).all(documentId, limit);
      return rows.map(r => ({
        id: r.id,
        documentId: r.document_id,
        role: r.role,
        content: r.content,
        createdAt: r.created_at,
      }));
    } catch (err) {
      log.warn('[chat] getChatMessages failed:', err?.message);
      return [];
    }
  });

  ipcMain.handle('db:saveChatMessage', (_, { id, documentId, role, content }) => {
    const db = getDb();
    try {
      db.prepare(
        `INSERT OR REPLACE INTO chat_messages (id, document_id, role, content, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(id, documentId, role, content);
      return true;
    } catch (err) {
      log.warn('[chat] saveChatMessage failed:', err?.message);
      return false;
    }
  });

  ipcMain.handle('db:clearChatMessages', (_, documentId) => {
    const db = getDb();
    try {
      db.prepare('DELETE FROM chat_messages WHERE document_id = ?').run(documentId);
      return true;
    } catch (err) {
      log.warn('[chat] clearChatMessages failed:', err?.message);
      return false;
    }
  });

  // ── 写作偏好 ──────────────────────────────────────

  ipcMain.handle('db:getWritingPreference', (_, key) => {
    const db = getDb();
    try {
      const row = db.prepare(
        'SELECT value FROM writing_preferences WHERE key = ?'
      ).get(key);
      return row ? row.value : null;
    } catch (err) {
      log.warn('[chat] getWritingPreference failed:', err?.message);
      return null;
    }
  });

  ipcMain.handle('db:setWritingPreference', (_, { key, value }) => {
    const db = getDb();
    try {
      db.prepare(
        `INSERT INTO writing_preferences (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = datetime('now')`
      ).run(key, value);
      return true;
    } catch (err) {
      log.warn('[chat] setWritingPreference failed:', err?.message);
      return false;
    }
  });

  ipcMain.handle('db:getAllWritingPreferences', () => {
    const db = getDb();
    try {
      const rows = db.prepare(
        'SELECT key, value, updated_at FROM writing_preferences'
      ).all();
      const result = {};
      for (const r of rows) {
        result[r.key] = r.value;
      }
      return result;
    } catch (err) {
      log.warn('[chat] getAllWritingPreferences failed:', err?.message);
      return {};
    }
  });

  log.info('[chat] Panel and chat IPC handlers registered');
}

module.exports = { registerChatHandlers };
