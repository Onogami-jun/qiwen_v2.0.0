import { ipc } from './ipc';
import { logger } from './logger';

// ── 极简防抖保存管理器 ──────────────────────────────────────
// 设计原则：每个文档独立防抖，绝对不丢数据
// - pending: 最新待保存内容
// - timer: 防抖定时器
// - saving: 当前是否有保存请求在飞行中
// 保存完成后若 pending 里还有新内容，立即再保存一次

class AutoSaveManager {
  private timers  = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, string>();   // 最新内容
  private flying  = new Map<string, boolean>();  // 是否在飞行中
  private delay   = 600; // 防抖毫秒

  private onSaveCb?:  (id: string) => void;
  private onSavedCb?: (id: string, updatedAt: number) => void;

  configure(opts: {
    interval?: number;
    onSave?:  (id: string) => void;
    onSaved?: (id: string, updatedAt: number) => void;
  }) {
    if (opts.interval  !== undefined) this.delay      = opts.interval;
    if (opts.onSave)   this.onSaveCb  = opts.onSave;
    if (opts.onSaved)  this.onSavedCb = opts.onSaved;
  }

  /** 接收内容变更，防抖后保存 */
  schedule(id: string, content: string) {
    this.pending.set(id, content);               // 记录最新内容
    const old = this.timers.get(id);
    if (old) clearTimeout(old);
    const t = setTimeout(() => {
      this.timers.delete(id);
      this._doSave(id);
    }, this.delay);
    this.timers.set(id, t);
  }

  /** 立即保存（不等防抖），返回保存完成的 Promise */
  async flush(id: string): Promise<void> {
    // 取消定时器
    const old = this.timers.get(id);
    if (old) { clearTimeout(old); this.timers.delete(id); }

    // 等待飞行中的保存完成
    await this._waitFlying(id);

    // 还有新内容就再保存一次
    if (this.pending.has(id)) {
      await this._doSave(id);
    }
  }

  /** 保存所有有内容的文档 */
  async flushAll(): Promise<void> {
    // 先取消所有定时器，收集所有需要保存的 id
    const ids = new Set<string>([
      ...this.timers.keys(),
      ...this.pending.keys(),
      ...this.flying.keys(),
    ]);
    for (const [id, t] of this.timers) {
      clearTimeout(t);
      this.timers.delete(id);
    }
    // 逐个等待+保存
    for (const id of ids) {
      await this.flush(id);
    }
  }

  hasPending() {
    return this.pending.size > 0 || this.flying.size > 0;
  }

  // ── 内部方法 ──────────────────────────────────────────────

  private async _waitFlying(id: string): Promise<void> {
    // 轮询等待，最多等 10 秒（保存一次不应超过 10 秒）
    const start = Date.now();
    while (this.flying.get(id)) {
      if (Date.now() - start > 10000) break;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  private async _doSave(id: string): Promise<void> {
    const content = this.pending.get(id);
    if (content === undefined) return;          // 没内容，跳过

    this.pending.delete(id);                    // 取出，防止重复保存
    this.flying.set(id, true);
    this.onSaveCb?.(id);

    try {
      const result = await ipc.invoke('documents:update', { id, content });
      const updatedAt: number = result?.updatedAt ?? Date.now();
      this.onSavedCb?.(id, updatedAt);
    } catch (e) {
      console.error('[AutoSave] save failed for', id, e);
      logger.error('AutoSave', `保存失败 id=${id}`, e);
      // 失败：把内容放回 pending，下次有机会再试
      if (!this.pending.has(id)) {
        this.pending.set(id, content);
      }
    } finally {
      this.flying.delete(id);

      // 保存完成后，如果期间又有新内容进来，立即再保存
      if (this.pending.has(id)) {
        // 用 setTimeout(0) 避免深度递归
        setTimeout(() => this._doSave(id), 0);
      }
    }
  }
}

export const autoSave = new AutoSaveManager();
