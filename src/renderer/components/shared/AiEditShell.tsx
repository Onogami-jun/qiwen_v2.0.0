import React from 'react';
import type { AiEditHistoryEntry } from '../../hooks/useAiEditSession';

/**
 * 四个 AI 编辑面板共用的外壳：header（仅悬浮变体）、空状态、loading 条、错误条、
 * diff 预览区的标题行+应用/重新生成/放弃按钮、历史记录列表、底部输入框。
 *
 * 真正的 diff 内容（结构化卡片 / 逐词高亮 / 树形列表，每个面板都不一样）通过
 * children 传入，这层只管"壳子"——四个面板视觉上原本就是同一套，只是分别复制
 * 了四份代码，现在改成一份代码、四处复用。
 *
 * variant:
 *  - 'floating'：PPT/白板/思维导图用的悬浮在画布右侧的 360px 抽屉，带 header + 关闭按钮
 *  - 'embedded'：文档编辑器侧边栏"AI 编辑"tab 用的，铺满父容器，header 由外面的 tab 切换条提供，这里不重复渲染
 */

export interface AiEditShellProps {
  variant?: 'floating' | 'embedded';
  title?: string;
  /** header 下方的一行小字提示，比如白板面板的"只对文字和图形…生效" */
  hint?: React.ReactNode;
  onClose?: () => void;

  instruction: string;
  onInstructionChange: (value: string) => void;
  placeholder?: string;
  onGenerate: () => void;
  onStop: () => void;
  loading: boolean;
  error?: string;

  emptyIcon?: string;
  emptyLine1: string;
  emptyLine2?: string;

  hasPendingDiff: boolean;
  pendingInstruction?: string | null;
  onApply: () => void;
  onDiscard: () => void;
  applyLabel?: string;

  history: AiEditHistoryEntry[];

  /** diff 预览内容，由各面板自己渲染 */
  children?: React.ReactNode;
}

const ACCENT_BTN: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'linear-gradient(135deg,var(--accent),#9a7040)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 500,
  fontFamily: 'inherit',
};
const GHOST_BTN: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '0.5px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 12.5,
  fontFamily: 'inherit',
};
const GHOST_BTN_MUTED: React.CSSProperties = { ...GHOST_BTN, color: 'var(--text-tertiary)' };

export const AiEditShell: React.FC<AiEditShellProps> = ({
  variant = 'floating',
  title = '✎ AI 编辑',
  hint,
  onClose,
  instruction,
  onInstructionChange,
  placeholder = '描述要做的修改... (Enter 发送)',
  onGenerate,
  onStop,
  loading,
  error,
  emptyIcon = '✎',
  emptyLine1,
  emptyLine2,
  hasPendingDiff,
  pendingInstruction,
  onApply,
  onDiscard,
  applyLabel = '✓ 应用修改',
  history,
  children,
}) => {
  const showEmptyState = !hasPendingDiff && !loading && history.length === 0;

  const outerStyle: React.CSSProperties =
    variant === 'floating'
      ? {
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          zIndex: 200,
          background: 'var(--bg-surface)',
          borderLeft: '0.5px solid var(--border-md)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
        }
      : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' };

  return (
    <div style={outerStyle}>
      {variant === 'floating' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 14px 12px',
            borderBottom: '0.5px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {hint && (
        <div style={{ padding: '8px 12px 0', fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, lineHeight: 1.6 }}>{hint}</div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {showEmptyState && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 12.5 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{emptyIcon}</div>
            <div>{emptyLine1}</div>
            {emptyLine2 && <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>{emptyLine2}</div>}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)',
                animation: 'spin .7s linear infinite',
              }}
            />
            正在生成修改…
            <button
              onClick={onStop}
              style={{
                marginLeft: 'auto',
                padding: '3px 10px',
                borderRadius: 'var(--radius-md)',
                border: '0.5px solid rgba(var(--color-danger-rgb), 0.4)',
                background: 'rgba(var(--color-danger-rgb), 0.08)',
                color: 'var(--color-danger)',
                cursor: 'pointer',
                fontSize: 11.5,
                fontFamily: 'inherit',
              }}
            >
              停止
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--color-danger)',
              padding: '8px 12px',
              background: 'rgba(var(--color-danger-rgb), 0.08)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 10,
            }}
          >
            {error}
          </div>
        )}

        {hasPendingDiff && !loading && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginBottom: 8 }}>「{pendingInstruction}」的修改预览</div>
            {children}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={onApply} style={ACCENT_BTN}>
                {applyLabel}
              </button>
              <button onClick={onGenerate} style={GHOST_BTN}>
                重新生成
              </button>
              <button onClick={onDiscard} style={GHOST_BTN_MUTED}>
                放弃
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>本次会话的修改记录</div>
            {history
              .slice()
              .reverse()
              .map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 0', color: 'var(--text-secondary)' }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      flexShrink: 0,
                      background: h.status === 'applied' ? 'rgba(var(--color-success-rgb), 0.15)' : 'rgba(255,255,255,0.06)',
                      color: h.status === 'applied' ? 'var(--color-success)' : 'var(--text-tertiary)',
                    }}
                  >
                    {h.status === 'applied' ? '已应用' : '已放弃'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.instruction}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 12px 10px', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={instruction}
            onChange={e => onInstructionChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onGenerate();
              }
            }}
            disabled={loading}
            placeholder={placeholder}
            rows={2}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface3)',
              border: '0.5px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 12.5,
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'none',
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={onGenerate}
            disabled={!instruction.trim() || loading}
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              flexShrink: 0,
              background: instruction.trim() && !loading ? 'linear-gradient(135deg,var(--accent),#9a7040)' : 'var(--bg-surface3)',
              color: instruction.trim() && !loading ? '#fff' : 'var(--text-tertiary)',
              cursor: instruction.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--dur-fast) var(--ease-smooth)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiEditShell;
