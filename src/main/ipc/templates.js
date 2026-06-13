const { ipcMain } = require('electron');
const { getDb } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

function registerTemplateHandlers() {
  ipcMain.handle('templates:list', (_, { category } = {}) => {
    const db = getDb();
    if (category) return db.prepare('SELECT * FROM templates WHERE category = ? ORDER BY use_count DESC, updated_at DESC').all(category);
    return db.prepare('SELECT * FROM templates ORDER BY use_count DESC, updated_at DESC').all();
  });

  ipcMain.handle('templates:get', (_, { id }) => {
    return getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id);
  });

  ipcMain.handle('templates:create', (_, { title, content = '', category = 'general', description = '', tags = [] }) => {
    const id = uuidv4(), now = Date.now();
    getDb().prepare('INSERT INTO templates (id, title, content, category, description, tags, is_builtin, use_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)')
      .run(id, title, content, category, description, JSON.stringify(tags), now, now);
    return { id, title, content, category, description, tags, isBuiltin: false, useCount: 0, createdAt: now, updatedAt: now };
  });

  ipcMain.handle('templates:use', (_, { id }) => {
    const db = getDb();
    db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(id);
    const tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    return tmpl ? { id: tmpl.id, title: tmpl.title, content: tmpl.content, category: tmpl.category } : null;
  });

  ipcMain.handle('templates:delete', (_, { id }) => {
    getDb().prepare('DELETE FROM templates WHERE id = ? AND is_builtin = 0').run(id);
    return { success: true };
  });

  log.info('[templates] IPC handlers registered');
}

module.exports = { registerTemplateHandlers };
