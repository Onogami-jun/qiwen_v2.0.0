import React from 'react';
import { diffWords } from 'diff';

/**
 * 四个 AI 编辑面板共用的 diff 视觉规则：新增绿底、删除红底删除线、不变保持原样。
 * 之前 PPT/白板/思维导图/文档四份各自写了一遍同样的 diffWords + span 渲染，这里统一成一份。
 */

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

const STATUS_STYLE: Record<DiffStatus, { label: string; color: string; bg: string }> = {
  added: { label: '新增', color: 'var(--color-success)', bg: 'rgba(var(--color-success-rgb), 0.15)' },
  removed: { label: '删除', color: 'var(--color-danger)', bg: 'rgba(var(--color-danger-rgb), 0.15)' },
  modified: { label: '已修改', color: 'var(--accent)', bg: 'rgba(var(--accent-rgb), 0.15)' },
  unchanged: { label: '不变', color: 'var(--text-tertiary)', bg: 'rgba(255,255,255,0.05)' },
};

export function diffStatusStyle(status: DiffStatus) {
  return STATUS_STYLE[status];
}

export const DiffStatusBadge: React.FC<{ status: DiffStatus; style?: React.CSSProperties }> = ({ status, style }) => {
  const s = STATUS_STYLE[status];
  return (
    <span
      style={{
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 'var(--radius-sm)',
        background: s.bg,
        color: s.color,
        flexShrink: 0,
        ...style,
      }}
    >
      {s.label}
    </span>
  );
};

/** 逐词对比渲染。unchangedStyle 用于个别面板想给"没变的部分"单独上色（比如文档面板用了次要文字色）。 */
export const WordDiffText: React.FC<{ oldText: string; newText: string; unchangedStyle?: React.CSSProperties }> = ({
  oldText,
  newText,
  unchangedStyle,
}) => {
  const parts = diffWords(oldText || '', newText || '');
  return (
    <>
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} style={{ background: 'rgba(var(--color-success-rgb), 0.18)', color: 'var(--color-success)' }}>
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={i}
              style={{ background: 'rgba(var(--color-danger-rgb), 0.14)', color: 'var(--color-danger)', textDecoration: 'line-through' }}
            >
              {part.value}
            </span>
          );
        }
        return (
          <span key={i} style={unchangedStyle}>
            {part.value}
          </span>
        );
      })}
    </>
  );
};
