const { ipcMain } = require('electron');
const { getDb } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

function registerPresentationHandlers() {

  ipcMain.handle('presentations:list', (_, { workspaceId }) => {
    return getDb().prepare('SELECT * FROM presentations WHERE workspace_id = ? ORDER BY updated_at DESC').all(workspaceId).map(r => ({
      id: r.id, workspaceId: r.workspace_id, title: r.title, theme: r.theme,
      aspectRatio: r.aspect_ratio, slideCount: r.slide_count, createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  });

  ipcMain.handle('presentations:get', (_, { id }) => {
    const db = getDb();
    const p = db.prepare('SELECT * FROM presentations WHERE id = ?').get(id);
    if (!p) return null;
    const slides = db.prepare('SELECT * FROM slides WHERE presentation_id = ? ORDER BY sort_order ASC').all(id).map(s => ({
      id: s.id, presentationId: s.presentation_id, sortOrder: s.sort_order,
      layout: s.layout, content: JSON.parse(s.content || '{}'), notes: s.notes || '',
      createdAt: s.created_at, updatedAt: s.updated_at,
    }));
    return { id: p.id, workspaceId: p.workspace_id, title: p.title, theme: p.theme,
      aspectRatio: p.aspect_ratio, slideCount: slides.length, slides, createdAt: p.created_at, updatedAt: p.updated_at };
  });

  ipcMain.handle('presentations:create', (_, { workspaceId, title = '无标题演示', theme = 'dark' }) => {
    const db = getDb(), now = Date.now(), presId = uuidv4(), slideId = uuidv4();
    db.transaction(() => {
      db.prepare('INSERT INTO presentations (id, workspace_id, title, theme, aspect_ratio, slide_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .run(presId, workspaceId, title, theme, '16:9', now, now);
      db.prepare('INSERT INTO slides (id, presentation_id, sort_order, layout, content, notes, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?)')
        .run(slideId, presId, 'title', JSON.stringify({ title, subtitle: '点击编辑副标题' }), '', now, now);
    })();
    log.info('[presentations:create]', presId);
    return { id: presId, workspaceId, title, theme, aspectRatio: '16:9', slideCount: 1,
      slides: [{ id: slideId, presentationId: presId, sortOrder: 0, layout: 'title', content: { title, subtitle: '点击编辑副标题' }, notes: '', createdAt: now, updatedAt: now }],
      createdAt: now, updatedAt: now };
  });

  ipcMain.handle('presentations:update-meta', (_, { id, title, theme, aspectRatio }) => {
    const db = getDb(), now = Date.now();
    const parts = ['updated_at = ?'], vals = [now];
    if (title !== undefined) { parts.unshift('title = ?'); vals.unshift(title); }
    if (theme !== undefined) { parts.unshift('theme = ?'); vals.unshift(theme); }
    if (aspectRatio !== undefined) { parts.unshift('aspect_ratio = ?'); vals.unshift(aspectRatio); }
    db.prepare(`UPDATE presentations SET ${parts.join(', ')} WHERE id = ?`).run(...vals, id);
    return { success: true, updatedAt: now };
  });

  ipcMain.handle('presentations:delete', (_, { id }) => {
    getDb().prepare('DELETE FROM presentations WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('slides:save', (_, { presentationId, slide }) => {
    const db = getDb(), now = Date.now();
    db.transaction(() => {
      db.prepare(`INSERT INTO slides (id, presentation_id, sort_order, layout, content, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET sort_order=excluded.sort_order, layout=excluded.layout,
          content=excluded.content, notes=excluded.notes, updated_at=excluded.updated_at`)
        .run(slide.id, presentationId, slide.sortOrder, slide.layout, JSON.stringify(slide.content || {}), slide.notes || '', slide.createdAt || now, now);
      db.prepare('UPDATE presentations SET slide_count=(SELECT COUNT(*) FROM slides WHERE presentation_id=?), updated_at=? WHERE id=?')
        .run(presentationId, now, presentationId);
    })();
    return { success: true, updatedAt: now };
  });

  ipcMain.handle('slides:save-all', (_, { presentationId, slides }) => {
    const db = getDb(), now = Date.now();
    db.transaction(() => {
      db.prepare('DELETE FROM slides WHERE presentation_id = ?').run(presentationId);
      const ins = db.prepare('INSERT INTO slides (id, presentation_id, sort_order, layout, content, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      slides.forEach((s, i) => ins.run(s.id || uuidv4(), presentationId, i, s.layout || 'content', JSON.stringify(s.content || {}), s.notes || '', s.createdAt || now, now));
      db.prepare('UPDATE presentations SET slide_count=?, updated_at=? WHERE id=?').run(slides.length, now, presentationId);
    })();
    return { success: true, updatedAt: now };
  });

  ipcMain.handle('slides:delete', (_, { slideId, presentationId }) => {
    const db = getDb(), now = Date.now();
    db.transaction(() => {
      db.prepare('DELETE FROM slides WHERE id = ?').run(slideId);
      db.prepare('UPDATE presentations SET slide_count=(SELECT COUNT(*) FROM slides WHERE presentation_id=?), updated_at=? WHERE id=?')
        .run(presentationId, now, presentationId);
    })();
    return { success: true };
  });

  log.info('[presentations] IPC handlers registered');
}

module.exports = { registerPresentationHandlers };
