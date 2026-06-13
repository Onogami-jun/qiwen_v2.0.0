const { ipcMain } = require('electron');
const { getDb } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

function registerPomodoroHandlers() {
  ipcMain.handle('pomodoro:start', (_, { documentId, workspaceId, duration = 1500 }) => {
    const id = uuidv4(), now = Date.now();
    getDb().prepare('INSERT INTO pomodoro_sessions (id, document_id, workspace_id, duration, completed, started_at) VALUES (?, ?, ?, ?, 0, ?)').run(id, documentId || null, workspaceId, duration, now);
    return { id, startedAt: now };
  });

  ipcMain.handle('pomodoro:complete', (_, { id }) => {
    const now = Date.now();
    getDb().prepare('UPDATE pomodoro_sessions SET completed = 1, ended_at = ? WHERE id = ?').run(now, id);
    return { success: true, endedAt: now };
  });

  ipcMain.handle('pomodoro:cancel', (_, { id }) => {
    getDb().prepare('UPDATE pomodoro_sessions SET ended_at = ? WHERE id = ?').run(Date.now(), id);
    return { success: true };
  });

  ipcMain.handle('pomodoro:stats', (_, { workspaceId, since }) => {
    const db = getDb();
    const sinceTs = since || (Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessions = db.prepare('SELECT * FROM pomodoro_sessions WHERE workspace_id = ? AND started_at >= ? ORDER BY started_at DESC').all(workspaceId, sinceTs);
    const completed = sessions.filter(s => s.completed);
    const totalMinutes = completed.reduce((sum, s) => sum + (s.duration || 1500), 0) / 60;
    return { total: sessions.length, completed: completed.length, totalMinutes: Math.round(totalMinutes), sessions };
  });

  log.info('[pomodoro] IPC handlers registered');
}

module.exports = { registerPomodoroHandlers };
