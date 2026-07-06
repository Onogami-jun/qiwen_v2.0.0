/**
 * ActionConfirm — 操作确认卡片
 *
 * 显示 AI 想要执行的操作，用户点"接受"或"拒绝"。
 * replace/rewrite 操作显示新旧对比；delete 操作显示待删除内容。
 */
import React from 'react';
import type { ParsedAction } from './actionParser';

interface Props {
  action: ParsedAction;
  onAccept: () => void;
  onReject: () => void;
  pending?: boolean;
}

const ActionConfirm: React.FC<Props> = ({ action, onAccept, onReject, pending }) => {
  const label = actionTypeLabel(action.type);
  const isDestructive = action.type === 'delete';

  return (
    <div style={{
      border: `1px solid ${isDestructive ? 'var(--color-error, #ef4444)' : 'var(--accent, #c8a96e)'}`,
      borderRadius: 10, margin: '8px 0', overflow: 'hidden', fontSize: 13,
      background: 'var(--bg-surface2, #f8f9fa)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: isDestructive ? 'rgba(239,68,68,0.08)' : 'rgba(200,169,110,0.1)',
        borderBottom: '1px solid var(--border, #e2e5e9)',
      }}>
        <span style={{ fontSize: 15 }}>
          {isDestructive ? '🗑' : action.type === 'rewrite' ? '✏️' : '📝'}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px' }}>
        {/* Replace/Rewrite: show old → new */}
        {(action.type === 'replace' || action.type === 'rewrite') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {action.payload.target && (
              <div style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 6, padding: '8px 10px', fontSize: 12,
              }}>
                <div style={{ fontSize: 10, color: 'var(--color-error, #ef4444)', marginBottom: 4, fontWeight: 600 }}>
                  — 原文
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 80, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {action.payload.target.slice(0, 300)}
                </div>
              </div>
            )}
            {action.content && (
              <div style={{
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
                borderRadius: 6, padding: '8px 10px', fontSize: 12,
              }}>
                <div style={{ fontSize: 10, color: 'var(--color-success, #22c55e)', marginBottom: 4, fontWeight: 600 }}>
                  + 新内容
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 80, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {action.content.slice(0, 300)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete: show what will be deleted */}
        {action.type === 'delete' && action.payload.target && (
          <div style={{
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 6, padding: '8px 10px', fontSize: 12,
          }}>
            <div style={{ fontSize: 10, color: 'var(--color-error, #ef4444)', marginBottom: 4, fontWeight: 600 }}>
              将删除以下内容
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 80, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {action.payload.target.slice(0, 300)}
            </div>
          </div>
        )}

        {/* Append/Insert: just show content */}
        {(action.type === 'append' || action.type === 'insert') && action.content && (
          <div style={{
            background: 'var(--bg-primary, #fff)', borderRadius: 6, padding: '8px 10px', fontSize: 12,
            color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap',
          }}>
            {action.content.slice(0, 400)}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px 10px', justifyContent: 'flex-end' }}>
        <button onClick={onReject} disabled={pending} style={{
          padding: '5px 14px', borderRadius: 16, border: '1px solid var(--border, #e2e5e9)',
          background: 'var(--bg-primary, #fff)', color: 'var(--text-secondary)',
          cursor: pending ? 'default' : 'pointer', fontSize: 12, opacity: pending ? 0.5 : 1,
        }}>拒绝</button>
        <button onClick={onAccept} disabled={pending} style={{
          padding: '5px 18px', borderRadius: 16, border: 'none',
          background: isDestructive ? 'var(--color-error, #ef4444)' : 'var(--accent, #c8a96e)',
          color: '#fff', cursor: pending ? 'default' : 'pointer', fontSize: 12, fontWeight: 500,
          opacity: pending ? 0.5 : 1,
        }}>{pending ? '执行中…' : '接受'}</button>
      </div>
    </div>
  );
};

function actionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    replace: 'AI 想要替换文本', rewrite: 'AI 想要改写段落',
    delete: 'AI 想要删除内容', append: 'AI 想要追加内容', insert: 'AI 想要插入内容',
    open_panel: 'AI 想要打开面板', close_panel: 'AI 想要关闭面板',
  };
  return map[type] || `AI 操作：${type}`;
}

export default React.memo(ActionConfirm);
