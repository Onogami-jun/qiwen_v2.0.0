const { ipcMain } = require('electron');
const { getDb } = require('../database/db');

function registerSettingsHandlers() {
  ipcMain.handle('settings:get-all', () => {
    const rows = getDb().prepare('SELECT key, value FROM app_settings').all();
    const settings = {};
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    }
    return settings;
  });

  ipcMain.handle('settings:get', (_, { key }) => {
    const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return row.value; }
  });

  ipcMain.handle('settings:set', (_, { key, value }) => {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), Date.now());
    return { success: true };
  });

  ipcMain.handle('settings:set-many', (_, { settings }) => {
    const db = getDb();
    const insert = db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)');
    const now = Date.now();
    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) insert.run(key, JSON.stringify(value), now);
    })();
    return { success: true };
  });

  ipcMain.handle('profile:get', () => {
    return getDb().prepare('SELECT * FROM user_profile LIMIT 1').get();
  });

  ipcMain.handle('profile:update', (_, { name, email, avatar }) => {
    const db = getDb();
    const user = db.prepare('SELECT id FROM user_profile LIMIT 1').get();
    if (!user) return { success: false };
    const parts = [], vals = [];
    if (name !== undefined) { parts.push('name = ?'); vals.push(name); }
    if (email !== undefined) { parts.push('email = ?'); vals.push(email); }
    if (avatar !== undefined) { parts.push('avatar = ?'); vals.push(avatar); }
    if (!parts.length) return { success: true };
    db.prepare(`UPDATE user_profile SET ${parts.join(', ')} WHERE id = ?`).run(...vals, user.id);
    return { success: true };
  });
}

module.exports = { registerSettingsHandlers };
