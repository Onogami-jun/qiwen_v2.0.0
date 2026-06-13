const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── 系统信息 ──────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath:    () => ipcRenderer.invoke('get-app-path'),
  getPlatform:   () => ipcRenderer.invoke('get-platform'),
  getTheme:      () => ipcRenderer.invoke('get-theme'),
  openExternal:  (url) => ipcRenderer.invoke('open-external', url),

  // ── 窗口控制 ──────────────────────────────────────────
  minimize:          () => ipcRenderer.send('window-minimize'),
  maximize:          () => ipcRenderer.send('window-maximize'),
  close:             () => ipcRenderer.send('window-close'),
  setTitle:          (t) => ipcRenderer.send('set-title', t),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),

  // ── 对话框 ────────────────────────────────────────────
  showSaveDialog: (o) => ipcRenderer.invoke('show-save-dialog', o),
  showOpenDialog: (o) => ipcRenderer.invoke('show-open-dialog', o),
  showMessageBox: (o) => ipcRenderer.invoke('show-message-box', o),

  // ── 事件监听 ──────────────────────────────────────────
  onMenuAction:     (ch, cb) => ipcRenderer.on(ch, (_, ...a) => cb(...a)),
  removeMenuAction: (ch, cb) => ipcRenderer.removeListener(ch, cb),
  onThemeChanged:   (cb) => ipcRenderer.on('theme-changed', (_, t) => cb(t)),
  onUpdateAvailable:(cb) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded:(cb)=> ipcRenderer.on('update-downloaded', cb),

  // ── 通用数据库 IPC（文档、工作区、设置等全走这里）──────
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),

  // ── 日志系统 ──────────────────────────────────────────
  logger: {
    info:  (tag, message, data) => ipcRenderer.invoke('logger:write', { level: 'info',  tag, message, data }),
    warn:  (tag, message, data) => ipcRenderer.invoke('logger:write', { level: 'warn',  tag, message, data }),
    error: (tag, message, data) => ipcRenderer.invoke('logger:write', { level: 'error', tag, message, data }),
    debug: (tag, message, data) => ipcRenderer.invoke('logger:write', { level: 'debug', tag, message, data }),
    getPath: () => ipcRenderer.invoke('logger:get-path'),
    openDir: () => ipcRenderer.invoke('logger:open-dir'),
  },

  // ── 单向消息（用于 flush-complete 等信号）────────────────
  send: (channel, ...args) => {
    const allowed = ['flush-complete'];
    if (allowed.includes(channel)) ipcRenderer.send(channel, ...args);
  },
});
