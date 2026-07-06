/**
 * AgentControlBar — AI 执行控制栏
 *
 * AI 自动执行时浮在编辑器区域底部，显示状态、当前步骤、可打断/输入新指令。
 * 模拟"有人在操作你的软件"的感觉。
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';

export interface ControlBarState {
  visible: boolean;
  status: 'thinking' | 'executing' | 'waiting' | 'idle';
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
}

interface Props {
  state: ControlBarState;
  onStop: () => void;
  onOverride: (instruction: string) => void;
}

const statusLabels: Record<string, string> = {
  thinking: '正在思考...',
  executing: '正在操作...',
  waiting: '等待确认',
  idle: '',
};

const AgentControlBar: React.FC<Props> = ({ state, onStop, onOverride }) => {
  const [overrideInput, setOverrideInput] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showOverride) inputRef.current?.focus();
  }, [showOverride]);

  const handleOverride = useCallback(() => {
    const v = overrideInput.trim();
    if (!v) return;
    onOverride(v);
    setOverrideInput('');
    setShowOverride(false);
  }, [overrideInput, onOverride]);

  if (!state.visible) return null;

  const progress = state.totalSteps > 0 ? Math.round((state.completedSteps / state.totalSteps) * 100) : 0;

  return (
    <div className="ac-bar" style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--bg-surface2, #f8f9fa)',
      borderTop: '1px solid var(--border, #e2e5e9)',
      padding: '0 16px', height: 46,
      display: 'flex', alignItems: 'center', gap: 12,
      zIndex: 50, fontSize: 13,
    }}>
      {/* Status dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: state.status === 'executing' ? 'var(--accent, #c8a96e)' :
          state.status === 'thinking' ? 'var(--color-info, #3b82f6)' :
          state.status === 'waiting' ? 'var(--color-warning, #f59e0b)' :
          'var(--text-tertiary, #999)',
        animation: state.status !== 'idle' ? 'pn-pulse 1.5s infinite' : 'none',
        flexShrink: 0,
      }} />

      {/* Status text */}
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {statusLabels[state.status]}
      </span>

      {/* Current step */}
      {state.currentStep && (
        <span style={{ color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {state.currentStep}
        </span>
      )}

      {/* Progress */}
      {state.totalSteps > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 60, height: 4, borderRadius: 2,
            background: 'var(--border, #e2e5e9)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'var(--accent, #c8a96e)',
              transition: 'width 0.3s ease-out',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{state.completedSteps}/{state.totalSteps}</span>
        </div>
      )}

      {/* Override input */}
      {showOverride ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <input ref={inputRef} value={overrideInput} onChange={e => setOverrideInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleOverride(); if (e.key === 'Escape') setShowOverride(false); }}
            placeholder="修改指令..." style={{
              width: 180, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--accent, #c8a96e)',
              fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
            }} />
          <button onClick={handleOverride} style={{
            padding: '3px 10px', borderRadius: 6, border: 'none', background: 'var(--accent, #c8a96e)',
            color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 500,
          }}>发送</button>
          <button onClick={() => setShowOverride(false)} style={{
            padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 11,
          }}>取消</button>
        </div>
      ) : (
        <button onClick={() => setShowOverride(true)} style={{
          padding: '3px 12px', borderRadius: 14, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
          fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          💬 修改指令
        </button>
      )}

      {/* Stop button */}
      <button onClick={onStop} style={{
        padding: '4px 14px', borderRadius: 14, border: 'none',
        background: 'var(--color-error, #ef4444)', color: '#fff',
        cursor: 'pointer', fontSize: 12, fontWeight: 500, flexShrink: 0,
      }}>
        ⏹ 停止
      </button>
    </div>
  );
};

export default React.memo(AgentControlBar);
