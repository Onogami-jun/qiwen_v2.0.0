// IPC 工具 — 渲染进程与主进程通信桥接

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getAppPath:    () => Promise<string>;
      getPlatform:   () => Promise<string>;
      getTheme:      () => Promise<string>;
      openExternal:  (url: string) => Promise<void>;
      minimize:           () => void;
      maximize:           () => void;
      close:              () => void;
      setTitle:           (t: string) => void;
      toggleAlwaysOnTop:  () => void;
      showSaveDialog: (o: any) => Promise<any>;
      showOpenDialog: (o: any) => Promise<any>;
      showMessageBox: (o: any) => Promise<any>;
      onMenuAction:    (ch: string, cb: (...a: any[]) => void) => void;
      removeMenuAction:(ch: string, cb: (...a: any[]) => void) => void;
      onThemeChanged:  (cb: (t: string) => void) => void;
      onUpdateAvailable:(cb: () => void) => void;
      onUpdateDownloaded:(cb: () => void) => void;
      invoke: (channel: string, payload?: any) => Promise<any>;
      // AI 流式响应
      onStreamChunk: (cb: (data: { content: string; full: string }) => void) => void;
      removeStreamChunk: (cb: (data: { content: string; full: string }) => void) => void;
    };
  }
}

export const isElectron = (): boolean => typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

export const ipc = {
  async invoke<T = any>(channel: string, payload?: any): Promise<T> {
    if (!isElectron()) { console.warn('[IPC Mock] ' + channel, payload); return undefined as any; }
    try { return await window.electronAPI.invoke(channel, payload); }
    catch (e: any) { import('./logger').then(({ logger }) => { logger.error('IPC', '调用失败 channel=' + channel, { channel, payload: payload ? JSON.stringify(payload).slice(0, 200) : undefined, error: e?.message || String(e) }); }).catch(() => {}); throw e; }
  },
};

export const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null;
