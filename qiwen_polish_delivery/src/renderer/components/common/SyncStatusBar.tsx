/**
 * SyncStatusBar.tsx — 同步状态指示器
 * src/renderer/components/common/SyncStatusBar.tsx
 *
 * 显示在 TitleBar 或 StatusBar 里，实时反映同步状态
 */
import React, { useState, useEffect } from 'react';
import { onSyncStatus, SyncStatus } from '../../services/syncEngine';

export const SyncStatusBar: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>({ isOnline: navigator.onLine, pendingCount: 0, lastSyncAt: null, syncing: false });

  useEffect(() => {
    const unsub = onSyncStatus(setStatus);
    return unsub;
  }, []);

  const formatTime = (ts: number | null) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  if (!status.isOnline) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--color-danger)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)' }} />
      离线
      {status.pendingCount > 0 && <span style={{ color: '#888' }}>({status.pendingCount} 待同步)</span>}
    </div>
  );

  if (status.syncing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--accent)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
      同步中…
    </div>
  );

  if (status.pendingCount > 0) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--color-info)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-info)' }} />
      待同步 {status.pendingCount} 项
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--color-success)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
      已同步 {formatTime(status.lastSyncAt)}
    </div>
  );
};
