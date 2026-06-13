/**
 * 启文云同步客户端服务
 * src/renderer/services/cloudSync.ts
 */

const API_BASE = 'https://api.bitwool.cn/api';

// ── Token 持久化 ────────────────────────────────────────────
const KEYS = {
  accessToken:   'qiwen_cloud_access',
  refreshToken:  'qiwen_cloud_refresh',
  lastSyncedAt:  'qiwen_cloud_last_sync',
  deviceId:      'qiwen_cloud_device_id',
  user:          'qiwen_cloud_user',
};

function getDeviceId(): string {
  let id = localStorage.getItem(KEYS.deviceId);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + '_' + Date.now();
    localStorage.setItem(KEYS.deviceId, id);
  }
  return id;
}

// ── HTTP 请求封装 ───────────────────────────────────────────
async function apiCall<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(KEYS.accessToken);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {}),
  };

  let res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  // Access token 过期 → 自动刷新
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new Error('登录已过期，请重新登录');
    headers.Authorization = `Bearer ${localStorage.getItem(KEYS.accessToken)}`;
    res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(body.message || body.error || body.data?.message || '请求失败');
  }
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem(KEYS.refreshToken);
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) { clearSession(); return false; }
    const json = await res.json();
    const { accessToken, refreshToken } = json.data ?? json;
    localStorage.setItem(KEYS.accessToken, accessToken);
    localStorage.setItem(KEYS.refreshToken, refreshToken);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

function clearSession() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

// ── 公开 API ────────────────────────────────────────────────
export const cloudSync = {
  isLoggedIn(): boolean {
    return !!localStorage.getItem(KEYS.accessToken);
  },

  getSavedUser(): any | null {
    const s = localStorage.getItem(KEYS.user);
    return s ? JSON.parse(s) : null;
  },

  // 注册
  async register(email: string, username: string, password: string, displayName?: string) {
    const res = await apiCall<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, displayName }),
    });
    // 服务端返回 { success, data: { accessToken, refreshToken, user } }
    const payload = res.data ?? res;
    localStorage.setItem(KEYS.accessToken, payload.accessToken);
    localStorage.setItem(KEYS.refreshToken, payload.refreshToken);
    localStorage.setItem(KEYS.user, JSON.stringify(payload.user));
    return payload.user;
  },

  // 登录
  async login(emailOrUsername: string, password: string) {
    const res = await apiCall<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        emailOrUsername, password,
        deviceId: getDeviceId(),
        deviceName: navigator.platform || 'Desktop',
      }),
    });
    // 服务端返回 { success, data: { accessToken, refreshToken, user } }
    const payload = res.data ?? res;
    localStorage.setItem(KEYS.accessToken, payload.accessToken);
    localStorage.setItem(KEYS.refreshToken, payload.refreshToken);
    localStorage.setItem(KEYS.user, JSON.stringify(payload.user));
    // 登录后全量同步（清空上次同步时间）
    localStorage.removeItem(KEYS.lastSyncedAt);
    return payload.user;
  },

  // 登出
  async logout() {
    const rt = localStorage.getItem(KEYS.refreshToken);
    try {
      await apiCall('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rt }),
      });
    } catch {}
    clearSession();
  },

  // 获取当前用户信息
  async getMe() {
    return apiCall<any>('/auth/me');
  },

  // 修改密码
  async changePassword(oldPassword: string, newPassword: string) {
    await apiCall('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    clearSession(); // 改密码后要重新登录
  },

  /**
   * 双向差量同步
   * @param getLocalChanges 函数，返回本地自上次同步后变化的数据
   * @returns 服务端返回的变更（调用方负责写入本地 DB）
   */
  async sync(getLocalChanges: () => {
    workspaces: any[];
    documents: any[];
    documentContents: any[];
    references: any[];
    settings: any;
  }): Promise<{
    syncedAt: string;
    changes: {
      workspaces: any[];
      documents: any[];
      documentContents: any[];
      references: any[];
      settings: any;
    };
  }> {
    if (!this.isLoggedIn()) throw new Error('未登录');

    const changes = getLocalChanges();
    const lastSyncedAt = localStorage.getItem(KEYS.lastSyncedAt) || null;
    const now = new Date().toISOString();

    // Push local documents to server
    const docs = (changes.documents || []).map((d: any) => ({
      id: d.id,
      workspaceId: d.workspaceId,
      title: d.title || '无标题',
      content: d.content || '',
      tags: d.tags || [],
      syncVersion: d.syncVersion || 1,
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : now,
    }));

    if (docs.length > 0) {
      await apiCall<any>('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ documents: docs }),
      });
    }

    // Pull remote changes since last sync
    const pullUrl = lastSyncedAt
      ? `/sync/pull?since=${encodeURIComponent(lastSyncedAt)}`
      : '/sync/pull';
    const pullRes = await apiCall<any>(pullUrl);
    const serverDocs = pullRes?.data?.documents || pullRes?.documents || [];

    localStorage.setItem(KEYS.lastSyncedAt, now);
    return {
      syncedAt: now,
      changes: {
        workspaces: [],
        documents: serverDocs,
        documentContents: [],
        references: [],
        settings: null,
      },
    };
  },

  getLastSyncedAt(): string | null {
    return localStorage.getItem(KEYS.lastSyncedAt);
  },
};
