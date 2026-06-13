const { ipcMain } = require('electron');
const { getDb } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

function registerCanvasHandlers() {
  ipcMain.handle('canvases:list', (_, { workspaceId, type }) => {
    const db = getDb();
    let sql = 'SELECT id, workspace_id, title, type, thumbnail, created_at, updated_at FROM canvases WHERE workspace_id = ?';
    const params = [workspaceId];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY updated_at DESC';
    return db.prepare(sql).all(...params).map(r => ({
      id: r.id, workspaceId: r.workspace_id, title: r.title,
      type: r.type, thumbnail: r.thumbnail || null,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  });

  ipcMain.handle('canvases:get', (_, { id }) => {
    const r = getDb().prepare('SELECT * FROM canvases WHERE id = ?').get(id);
    if (!r) return null;
    return { id: r.id, workspaceId: r.workspace_id, title: r.title, type: r.type, data: r.data, thumbnail: r.thumbnail || null, createdAt: r.created_at, updatedAt: r.updated_at };
  });

  ipcMain.handle('canvases:create', (_, { workspaceId, title = '无标题', type = 'whiteboard' }) => {
    const id = uuidv4(), now = Date.now();
    const defaultData = type === 'mindmap'
      ? JSON.stringify({ nodes: [{ id: 'root', text: title || '中心主题', x: 0, y: 0, children: [] }] })
      : JSON.stringify({ elements: [], viewport: { x: 0, y: 0, zoom: 1 } });
    getDb().prepare('INSERT INTO canvases (id, workspace_id, title, type, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, workspaceId, title, type, defaultData, now, now);
    log.info('[canvases:create]', type, id);
    return { id, workspaceId, title, type, data: defaultData, createdAt: now, updatedAt: now };
  });

  ipcMain.handle('canvases:save', (_, { id, data, thumbnail, title }) => {
    const now = Date.now();
    const fields = ['data = ?', 'updated_at = ?'];
    const vals = [data, now];
    if (thumbnail !== undefined) { fields.push('thumbnail = ?'); vals.push(thumbnail); }
    if (title !== undefined) { fields.push('title = ?'); vals.push(title); }
    getDb().prepare(`UPDATE canvases SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
    return { id, updatedAt: now };
  });

  ipcMain.handle('canvases:rename', (_, { id, title }) => {
    const now = Date.now();
    getDb().prepare('UPDATE canvases SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id);
    return { id, title, updatedAt: now };
  });

  ipcMain.handle('canvases:delete', (_, { id }) => {
    getDb().prepare('DELETE FROM canvases WHERE id = ?').run(id);
    return { id };
  });

  log.info('[canvases] IPC handlers registered');
}

module.exports = { registerCanvasHandlers };
