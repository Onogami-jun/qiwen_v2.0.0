/**
 * logger.ts — 渲染进程统一日志工具
 *
 * 用法：
 *   import { logger } from '../utils/logger';
 *   logger.info('AutoSave', '保存成功', { docId });
 *   logger.error('IPC', '调用失败', err);
 *
 * 日志文件位置：userData/logs/qiwen-YYYY-MM-DD.log
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// 格式化附加数据
function serialize(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;
  if (data instanceof Error) {
    return `${data.message}${data.stack ? '\n' + data.stack : ''}`;
  }
  try {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 0);
  } catch {
    return String(data);
  }
}

// 写入到主进程（通过 IPC）
function write(level: LogLevel, tag: string, message: string, data?: unknown): void {
  const api = (window as any).electronAPI;
  if (!api?.logger) {
    // 开发环境降级到 console
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level.toUpperCase()}][${tag}]`, message, data !== undefined ? data : '');
    return;
  }
  const serialized = serialize(data);
  api.logger[level](tag, message, serialized).catch(() => {});
}

export const logger = {
  info:  (tag: string, message: string, data?: unknown) => write('info',  tag, message, data),
  warn:  (tag: string, message: string, data?: unknown) => write('warn',  tag, message, data),
  error: (tag: string, message: string, data?: unknown) => write('error', tag, message, data),
  debug: (tag: string, message: string, data?: unknown) => write('debug', tag, message, data),

  // 打开日志目录（Finder/Explorer）
  openDir: () => {
    const api = (window as any).electronAPI;
    api?.logger?.openDir?.();
  },

  // 获取当天日志文件路径
  getPath: async (): Promise<string | null> => {
    const api = (window as any).electronAPI;
    return api?.logger?.getPath?.() ?? null;
  },
};

// ── 全局错误自动捕获 ──────────────────────────────────────────
// 在 index.tsx 调用 setupGlobalErrorCapture() 一次即可

export function setupGlobalErrorCapture(): void {
  // 1. 未捕获的同步异常
  window.addEventListener('error', (e) => {
    logger.error('GlobalError', e.message || 'Unknown error', {
      filename: e.filename,
      lineno:   e.lineno,
      colno:    e.colno,
      stack:    e.error?.stack,
    });
  });

  // 2. 未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    logger.error('UnhandledPromise',
      reason instanceof Error ? reason.message : String(reason),
      reason instanceof Error ? reason.stack : undefined,
    );
  });

  // 3. 拦截 console.error，同步写日志文件
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalError(...args);
    // 避免日志写日志导致死循环（IPC 本身失败时 console.error 会再触发）
    try {
      const message = args.map(a =>
        a instanceof Error ? a.message : (typeof a === 'object' ? JSON.stringify(a) : String(a))
      ).join(' ');
      write('error', 'Console', message);
    } catch {}
  };

  // 4. 拦截 console.warn
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    try {
      const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      write('warn', 'Console', message);
    } catch {}
  };

  logger.info('App', '启文启动', {
    version: (window as any).electronAPI?.getAppVersion?.(),
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  });
}
