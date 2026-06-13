const { ipcMain } = require('electron');
const { getDb } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

function registerReferenceHandlers() {
  ipcMain.handle('references:list', (_, { workspaceId, page = 1, pageSize = 50, search = '' }) => {
    const db = getDb();
    const offset = (page - 1) * pageSize;
    const q = `%${search}%`;
    let query = 'SELECT r.*, COUNT(*) OVER() as total_count FROM paper_references r WHERE r.workspace_id = ?';
    const params = [workspaceId];
    if (search) { query += ' AND (r.title LIKE ? OR r.authors LIKE ? OR r.abstract LIKE ? OR r.citation_key LIKE ?)'; params.push(q, q, q, q); }
    query += ' ORDER BY r.updated_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);
    const rows = db.prepare(query).all(...params);
    const total = rows[0]?.total_count || 0;
    return { items: rows.map(normalizeRef), total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  });

  ipcMain.handle('references:get', (_, { id }) => {
    const row = getDb().prepare('SELECT * FROM paper_references WHERE id = ?').get(id);
    return row ? normalizeRef(row) : null;
  });

  ipcMain.handle('references:create', (_, data) => {
    const db = getDb(), id = uuidv4(), now = Date.now();
    const citationKey = data.citationKey || generateCitationKey(data);
    db.prepare(`INSERT INTO paper_references (id, workspace_id, title, authors, year, journal, volume, issue, pages, doi, url, abstract, keywords, tags, notes, file_path, citation_key, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.workspaceId, data.title, JSON.stringify(data.authors || []), data.year || null, data.journal || null, data.volume || null, data.issue || null, data.pages || null, data.doi || null, data.url || null, data.abstract || null, JSON.stringify(data.keywords || []), JSON.stringify(data.tags || []), data.notes || null, data.filePath || null, citationKey, data.type || 'article', now, now);
    return { id, ...data, citationKey, createdAt: now, updatedAt: now };
  });

  ipcMain.handle('references:update', (_, { id, ...data }) => {
    const db = getDb(), now = Date.now();
    const fields = { title: data.title, authors: data.authors ? JSON.stringify(data.authors) : undefined, year: data.year, journal: data.journal, abstract: data.abstract, notes: data.notes, tags: data.tags ? JSON.stringify(data.tags) : undefined, keywords: data.keywords ? JSON.stringify(data.keywords) : undefined, doi: data.doi, url: data.url };
    const parts = [], vals = [];
    for (const [k, v] of Object.entries(fields)) { if (v !== undefined) { parts.push(`${camelToSnake(k)} = ?`); vals.push(v); } }
    parts.push('updated_at = ?'); vals.push(now);
    db.prepare(`UPDATE paper_references SET ${parts.join(', ')} WHERE id = ?`).run(...vals, id);
    return { success: true };
  });

  ipcMain.handle('references:delete', (_, { id }) => {
    getDb().prepare('DELETE FROM paper_references WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('references:bibtex', (_, { id }) => {
    const row = getDb().prepare('SELECT * FROM paper_references WHERE id = ?').get(id);
    return row ? generateBibtex(normalizeRef(row)) : null;
  });
}

function normalizeRef(row) {
  return { id: row.id, workspaceId: row.workspace_id, title: row.title, authors: tryParse(row.authors, []), year: row.year, journal: row.journal, volume: row.volume, issue: row.issue, pages: row.pages, doi: row.doi, url: row.url, abstract: row.abstract, keywords: tryParse(row.keywords, []), tags: tryParse(row.tags, []), notes: row.notes, filePath: row.file_path, citationKey: row.citation_key, type: row.type, createdAt: row.created_at, updatedAt: row.updated_at };
}

function tryParse(str, fallback) { try { return JSON.parse(str); } catch { return fallback; } }
function camelToSnake(str) { return str.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`); }
function generateCitationKey(data) {
  const firstAuthor = (data.authors?.[0] || 'Unknown').split(' ').pop();
  const year = data.year || new Date().getFullYear();
  const titleWord = (data.title || '').split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
  return `${firstAuthor}${year}${titleWord}`;
}
function generateBibtex(ref) {
  return [`@${ref.type}{${ref.citationKey},`, `  title = {${ref.title}},`, `  author = {${ref.authors.join(' and ')}},`,
    ref.year ? `  year = {${ref.year}},` : '', ref.journal ? `  journal = {${ref.journal}},` : '',
    ref.volume ? `  volume = {${ref.volume}},` : '', ref.pages ? `  pages = {${ref.pages}},` : '',
    ref.doi ? `  doi = {${ref.doi}},` : '', `}`].filter(Boolean).join('\n');
}

module.exports = { registerReferenceHandlers };
