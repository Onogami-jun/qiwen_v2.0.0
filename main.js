const { app, BrowserWindow, ipcMain, shell, dialog, Menu, nativeTheme } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
require('@electron/remote/main').initialize();

const isDev = process.env.NODE_ENV === 'development';
const fs = require('fs');

// ── userData 路径修正 + 旧路径数据迁移 ──────────────────────
(function fixUserDataPath() {
  const newPath2 = isDev
    ? path.join(app.getPath('appData'), 'QiWen-dev')
    : path.join(app.getPath('appData'), 'QiWen');
  app.setPath('userData', newPath2);
  try {
    const newDb = path.join(newPath2, 'data', 'qiwen.db');
    if (!fs.existsSync(newDb)) {
      const appData = app.getPath('appData');
      const oldCandidates = [
        path.join(appData, '启文', 'data', 'qiwen.db'),
        path.join(appData, 'qiwen', 'data', 'qiwen.db'),
        path.join(appData, 'Qiwen', 'data', 'qiwen.db'),
      ];
      for (const oldDb of oldCandidates) {
        if (fs.existsSync(oldDb)) {
          const newDir2 = path.join(newPath2, 'data');
          if (!fs.existsSync(newDir2)) fs.mkdirSync(newDir2, { recursive: true });
          fs.copyFileSync(oldDb, newDb);
          fs.writeFileSync(path.join(newPath2, 'migrated_from.txt'), oldDb);
          break;
        }
      }
    }
  } catch (e) {}
})();

log.transports.file.level = 'info';
autoUpdater.logger = log;

let mainWindow = null;
let db = null;

let _saveDatabase = null;
let _closeDb = null;

async function initDB() {
  try {
    log.info('Starting DB initialization...');
    const dbModule = require('../src/main/database/db');
    db = await dbModule.initDatabase();
    _saveDatabase = dbModule.saveDatabase;
    _closeDb = dbModule.closeDb;
    log.info('Database initialized successfully');

    const { registerDocumentHandlers }  = require('../src/main/ipc/documents');
    const { registerWorkspaceHandlers } = require('../src/main/ipc/workspaces');
    const { registerSettingsHandlers }  = require('../src/main/ipc/settings');
    const { registerReferenceHandlers } = require('../src/main/ipc/references');
    const { registerTemplateHandlers } = require('../src/main/ipc/templates');
    const { registerRdmHandlers }      = require('../src/main/ipc/rdm');
    const { registerPresentationHandlers } = require('../src/main/ipc/presentations');
    const { registerChatHandlers } = require('../src/main/ipc/chat');

    registerDocumentHandlers();
    registerWorkspaceHandlers();
    registerSettingsHandlers();
    registerRdmHandlers(dbModule.getDb, dbModule.saveDatabase);
    registerPresentationHandlers();
    registerChatHandlers();

    // ── App State ──────────────────────────
    const stateFile = path.join(app.getPath('userData'), 'app-state.json');
    function readAppState() {
      try { if (fs.existsSync(stateFile)) return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
      return {};
    }
    function writeAppState(updates) {
      try { const current = readAppState(); const merged = { ...current, ...updates }; fs.writeFileSync(stateFile, JSON.stringify(merged), 'utf8'); return true; } catch (e) { log.error('[app-state] write failed:', e); return false; }
    }
    ipcMain.handle('app:get-state', () => readAppState());
    ipcMain.handle('app:set-state', (_, updates) => writeAppState(updates));
    registerReferenceHandlers();
    registerTemplateHandlers();

    ipcMain.handle('app:is-first-run', () => {
      try {
        const d = dbModule.getDb();
        const stmt = d.prepare('SELECT id FROM workspaces LIMIT 1');
        const hasWorkspace = stmt.step();
        stmt.free();
        return !hasWorkspace;
      } catch (e) { return true; }
    });

    // ── AI API 代理 ──────────────────────────────
    const https = require('https');

    // v1: non-streaming (backward compat)
    ipcMain.handle('ai:chat-stream', async (event, { messages, apiKey, model }) => {
      return new Promise((resolve, reject) => {
        const effectiveModel = model || 'doubao-seed-2-0-pro-260215';
        const effectiveKey = apiKey || 'ark-0f0fd51c-1395-45bd-9df0-29a195257d96-5ab55';
        const body = JSON.stringify({ model: effectiveModel, max_tokens: 4096, stream: false, messages });
        const options = { hostname: 'ark.cn-beijing.volces.com', path: '/api/v3/chat/completions', method: 'POST', timeout: 120000, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + effectiveKey, 'Content-Length': Buffer.byteLength(body) } };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) { reject(new Error(json.error.message || 'API error')); return; }
              resolve(json.choices?.[0]?.message?.content || '');
            } catch(e) { reject(new Error('Parse error: ' + e.message)); }
          });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
        req.on('error', (err) => reject(new Error('network: ' + err.message)));
        req.write(body); req.end();
      });
    });

    // v2: streaming — sends partial chunks to renderer via webContents event
    ipcMain.handle('ai:chat-stream-v2', async (event, { messages, apiKey, model }) => {
      const effectiveModel = model || 'doubao-seed-2-0-pro-260215';
      const effectiveKey = apiKey || 'ark-0f0fd51c-1395-45bd-9df0-29a195257d96-5ab55';
      const body = JSON.stringify({ model: effectiveModel, max_tokens: 4096, stream: true, messages });

      return new Promise((resolve, reject) => {
        const options = { hostname: 'ark.cn-beijing.volces.com', path: '/api/v3/chat/completions', method: 'POST', timeout: 120000, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + effectiveKey, 'Content-Length': Buffer.byteLength(body) } };
        const req = https.request(options, (res) => {
          let fullContent = '';
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const delta = json.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    fullContent += delta;
                    // Send partial chunk to renderer
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send('ai:stream-chunk', { content: delta, full: fullContent });
                    }
                  }
                } catch (e) { /* skip malformed SSE line */ }
              }
            }
          });
          res.on('end', () => resolve(fullContent));
          res.on('error', (err) => reject(new Error('stream error: ' + err.message)));
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
        req.on('error', (err) => reject(new Error('network: ' + err.message)));
        req.write(body); req.end();
      });
    });

    return true;
  } catch (err) {
    log.error('DB init failed:', err);
    dialog.showErrorBox('启文启动失败', '数据库初始化失败，请重新安装应用。\n\n错误：' + err.message);
    return false;
  }
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600, center: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 12 },
    backgroundColor: '#0a0a0f',
    vibrancy: isMac ? 'sidebar' : undefined,
    frame: false, show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), webSecurity: false,
    },
  });
  require('@electron/remote/main').enable(mainWindow.webContents);
  const startURL = isDev ? 'http://localhost:3000' : 'file://' + path.join(__dirname, '../build/index.html');
  mainWindow.loadURL(startURL);
  const showFallbackTimer = setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) { log.warn('ready-to-show timeout, force showing window'); mainWindow.show(); mainWindow.center(); } }, 8000);
  mainWindow.once('ready-to-show', () => { clearTimeout(showFallbackTimer); if (mainWindow.isMaximized()) mainWindow.unmaximize(); mainWindow.show(); mainWindow.center(); if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' }); });
  mainWindow.webContents.on('render-process-gone', (event, details) => { log.error('Renderer process gone:', details.reason, details.exitCode); dialog.showErrorBox('启文崩溃', '渲染进程异常退出 (' + details.reason + ')，请重新启动应用。'); });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => { log.error('Page failed to load:', errorCode, errorDescription, validatedURL); if (!isDev) { setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(startURL); }, 1000); } });

  let isReallyClosing = false;
  let isWaitingForFlush = false;
  mainWindow.on('close', (e) => {
    if (isReallyClosing) return;
    e.preventDefault();
    if (isWaitingForFlush) return;
    isWaitingForFlush = true;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app-before-close');
    const forceClose = setTimeout(() => { log.warn('Save timeout'); try { if (_saveDatabase) _saveDatabase(); } catch(e) { log.error(e); } isReallyClosing = true; if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); }, 5000);
    ipcMain.once('flush-complete', () => { clearTimeout(forceClose); try { if (_saveDatabase) _saveDatabase(); } catch(e) { log.error(e); } isReallyClosing = true; if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  setupMenu(); setupIPC(); setupAutoUpdater();
}

function setupMenu() {
  const isMac = process.platform === 'darwin';
  const send = (ch) => () => mainWindow?.webContents.send(ch);
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about', label: '关于启文' }, { type: 'separator' }, { label: '偏好设置', accelerator: 'Cmd+,', click: send('open-settings') }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit', label: '退出启文' }] }] : []),
    { label: '文件', submenu: [{ label: '新建文档', accelerator: 'CmdOrCtrl+N', click: send('new-document') }, { label: '新建窗口', accelerator: 'CmdOrCtrl+Shift+N', click: createWindow }, { type: 'separator' }, { label: '保存', accelerator: 'CmdOrCtrl+S', click: send('save-document') }, { type: 'separator' }, { label: '导出 PDF', click: send('export-pdf') }, ...(!isMac ? [{ type: 'separator' }, { role: 'quit', label: '退出' }] : [])] },
    { label: '编辑', submenu: [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { type: 'separator' }, { label: '查找', accelerator: 'CmdOrCtrl+F', click: send('find-replace') }] },
    { label: '视图', submenu: [{ label: '切换侧边栏', accelerator: 'CmdOrCtrl+\\', click: send('toggle-sidebar') }, { label: '专注模式', accelerator: 'CmdOrCtrl+Shift+F', click: send('focus-mode') }, { type: 'separator' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { role: 'resetZoom', label: '实际大小' }, { type: 'separator' }, { role: 'togglefullscreen', label: '全屏' }] },
    { label: '帮助', submenu: [{ label: '键盘快捷键', click: send('show-shortcuts') }, { label: '官方网站', click: () => shell.openExternal('https://qiwen.studio') }, ...(!isMac ? [{ label: '关于启文', click: () => dialog.showMessageBox(mainWindow, { title: '关于启文', message: '启文 v1.0.0\n启于思，行于文\n\n© 2024 启文团队' }) }] : [])] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupIPC() {
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-app-path', () => app.getPath('userData'));
  ipcMain.handle('get-platform', () => process.platform);

  // PDF export (abbreviated — same as original)
  ipcMain.handle('documents:export-pdf', async (event, { id, title, html, theme = 'light', pageSize = 'A4', includeTitle = true, includeMeta = false, meta = {} }) => {
    try {
      const { filePath } = await dialog.showSaveDialog(mainWindow, { title: '导出 PDF', defaultPath: path.join(require('os').homedir(), 'Downloads', title + '.pdf'), filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] });
      if (!filePath) return { success: false, reason: 'cancelled' };
      const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
      const metaBlock = includeMeta ? '<div style="margin-bottom:24px;padding:10px 14px;border-radius:6px;font-size:12px;opacity:.6">字数：' + (meta.wordCount||0) + ' · 导出时间：' + (meta.exportTime||'') + '</div>' : '';
      const bgStyles = theme === 'dark' ? 'body{background:#141414;color:#e0ddd8}' : theme === 'elegant' ? 'body{background:#faf7f2;color:#2a2318}' : 'body{background:#fff;color:#1a1a1a}';
      const fullHtml2 = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>' + title + '</title><style>' + bgStyles + 'body{font-family:PingFang SC,Microsoft YaHei,serif;max-width:800px;margin:40px auto;line-height:1.85;font-size:14px}h1{font-size:2em;font-weight:300;margin:0 0 .6em;border-bottom:1px solid;padding-bottom:.3em;opacity:.85}p{margin:0 0 .8em}</style></head><body>' + (includeTitle ? '<h1>' + title + '</h1>' : '') + metaBlock + html + '</body></html>';
      await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml2));
      await new Promise(r => setTimeout(r, 800));
      const pdfData = await printWin.webContents.printToPDF({ printBackground: true, pageSize: pageSize || 'A4', margins: { top: 20, bottom: 20, left: 20, right: 20 } });
      printWin.close();
      fs.writeFileSync(filePath, pdfData);
      shell.showItemInFolder(filePath);
      return { success: true, filePath };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  // DOCX export (abbreviated)
  ipcMain.handle('documents:export-docx', async (event, { id, title, html }) => {
    const result = await dialog.showSaveDialog(mainWindow, { title: '另存为 Word 文档', defaultPath: (title || '无标题') + '.docx', filters: [{ name: 'Word 文档', extensions: ['docx'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const text = stripTags(html || '');
      const paragraphs = text.split('\n').filter(l => l.trim()).map(l => '<w:p><w:r><w:t xml:space="preserve">' + l.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</w:t></w:r></w:p>').join('\n');
      const wordXml = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs + '</w:body></w:document>';
      fs.writeFileSync(result.filePath, wordXml, 'utf8');
      return { success: true, filePath: result.filePath };
    } catch (e) { throw e; }
  });

  ipcMain.handle('show-save-dialog', async (_, o) => dialog.showSaveDialog(mainWindow, o));
  ipcMain.handle('fs:write-file', async (_, { path: filePath, content: fileContent }) => { try { fs.writeFileSync(filePath, fileContent, 'utf8'); shell.showItemInFolder(filePath); return { success: true }; } catch (err) { return { success: false, error: String(err) }; } });
  ipcMain.handle('show-open-dialog', async (_, o) => dialog.showOpenDialog(mainWindow, o));
  ipcMain.handle('image:upload-local', async () => { try { const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, { title: '选择图片', filters: [{ name: '图片文件', extensions: ['png','jpg','jpeg','gif','webp','svg','bmp'] }], properties: ['openFile'] }); if (canceled || !filePaths.length) return { success: false }; const mimeMap = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp' }; const ext = path.extname(filePaths[0]).toLowerCase().slice(1); const data = fs.readFileSync(filePaths[0]); return { success: true, dataUrl: 'data:' + (mimeMap[ext]||'image/png') + ';base64,' + data.toString('base64'), fileName: path.basename(filePaths[0]) }; } catch (e) { return { success: false }; } });
  ipcMain.handle('show-message-box', async (_, o) => dialog.showMessageBox(mainWindow, o));
  ipcMain.handle('open-external', async (_, url) => shell.openExternal(url));
  ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  ipcMain.on('set-title', (_, t) => mainWindow?.setTitle(t));
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.restore() : mainWindow?.maximize());
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.on('toggle-always-on-top', () => mainWindow?.setAlwaysOnTop(!mainWindow?.isAlwaysOnTop()));
  nativeTheme.on('updated', () => mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));
}

function setupAutoUpdater() { if (isDev) return; autoUpdater.checkForUpdatesAndNotify(); autoUpdater.on('update-available', () => mainWindow?.webContents.send('update-available')); autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('update-downloaded')); }

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
app.commandLine.appendSwitch('disable-features', 'UseOzonePlatform,WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('renderer-process-limit', '1');

app.whenReady().then(async () => { const dbOk = await initDB(); if (!dbOk) { app.quit(); return; } createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { try { if (_saveDatabase) _saveDatabase(); if (_closeDb) _closeDb(); else if (db) db.close(); } catch (e) { log.error(e); } });
process.on('uncaughtException', (err) => log.error('Uncaught:', err));
process.on('unhandledRejection', (r) => log.error('Rejection:', r));
