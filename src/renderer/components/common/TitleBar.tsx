import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { electronAPI } from '../../utils/ipc';
import { autoSave } from '../../utils/autoSave';
import { AppDispatch } from '../../store';

interface TitleBarProps {
  title?: string;
  showControls?: boolean;
}

// ── 自动保存状态指示器（无需手动保存）──────────────────────
// 用极细的视觉提示代替按钮，降低认知负担
const SaveIndicator: React.FC = () => {
  const activeTabId = useSelector((s: RootState) => s.app.activeTabId);
  const tabs = useSelector((s: RootState) => s.app.tabs);
  const openDocuments = useSelector((s: RootState) => s.documents.openDocuments);
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeDoc = activeTab ? openDocuments[activeTab.documentId] : null;
  const [state, setState] = useState<'idle'|'saving'|'saved'>('idle');

  // 监听 autoSave 事件
  useEffect(() => {
    const onSaving = () => setState('saving');
    const onSaved = () => { setState('saved'); setTimeout(() => setState('idle'), 1800); };
    window.addEventListener('autosave:start', onSaving);
    window.addEventListener('autosave:done', onSaved);
    return () => {
      window.removeEventListener('autosave:start', onSaving);
      window.removeEventListener('autosave:done', onSaved);
    };
  }, []);

  // Ctrl+S 仍然支持，但只是 flush 不显示按钮
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeDoc) {
          window.dispatchEvent(new Event('autosave:start'));
          autoSave.flush(activeDoc.id).then(() => window.dispatchEvent(new Event('autosave:done')));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeDoc]);

  if (!activeDoc || state === 'idle') return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8,
      fontSize: 11.5, color: state === 'saved' ? '#52c97a' : 'var(--text-tertiary)',
      transition: 'opacity 0.3s, color 0.3s',
      opacity: (state === 'saving' || state === 'saved') ? 1 : 0,
      ['WebkitAppRegion' as string]: 'no-drag',
    }}>
      {state === 'saving' ? (
        <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid var(--text-tertiary)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c97a', flexShrink: 0 }} />
      )}
      {state === 'saving' ? '保存中' : '已保存'}
    </div>
  );
};

// ── 导出按钮（保留 另存为 功能，移到工具栏） ──────────────
const SaveButtons: React.FC = () => {
  return <SaveIndicator />;
};


export const TitleBar: React.FC<TitleBarProps> = ({ title = '启文', showControls = true }) => {
  const dispatch = useDispatch<AppDispatch>();
  const sidebarOpen = useSelector((s: RootState) => s.app.sidebarOpen);
  const platform = navigator.platform.toLowerCase();
  const isMac = platform.includes('mac');

  return (
    <div className="titlebar" style={{
      height: 'var(--titlebar-height)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      borderBottom: '0.5px solid var(--border)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
      ['WebkitAppRegion' as string]: 'drag',
      background: 'var(--bg-surface)',
    }}>
      {/* Traffic lights - macOS handles them natively, we add spacing */}
      {isMac && <div style={{ width: 68, flexShrink: 0 }} />}

      {/* 侧边栏切换按钮 - 左侧 */}
      <button
        onClick={() => dispatch({ type: 'app/toggleSidebar' })}
        title={sidebarOpen ? '隐藏侧边栏' : '显示侧边栏'}
        style={{
          width: 28, height: 28, borderRadius: 6, border: 'none',
          background: sidebarOpen ? 'rgba(200,169,110,0.15)' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: sidebarOpen ? 'var(--accent)' : 'var(--text-tertiary)',
          transition: 'background 0.15s, color 0.15s',
          flexShrink: 0,
          ['WebkitAppRegion' as string]: 'no-drag',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'rgba(200,169,110,0.12)')}
        onMouseOut={e => (e.currentTarget.style.background = sidebarOpen ? 'rgba(200,169,110,0.15)' : 'transparent')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      {/* 保存 / 另存为 — 固定在左侧 */}
      <SaveButtons />

      {/* Windows controls */}
      {!isMac && showControls && (
        <div style={{ display: 'flex', position: 'absolute', right: 0, top: 0, ['WebkitAppRegion' as string]: 'no-drag' }}>
          <WinBtn onClick={() => electronAPI?.minimize()} title="最小化" hover="rgba(255,255,255,0.1)">
            <svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.2"/></svg>
          </WinBtn>
          <WinBtn onClick={() => electronAPI?.maximize()} title="最大化/还原" hover="rgba(255,255,255,0.1)">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
          </WinBtn>
          <WinBtn onClick={() => electronAPI?.close()} title="关闭" hover="#e81123" danger>
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/></svg>
          </WinBtn>
        </div>
      )}

      <span style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 13,
        color: 'var(--text-tertiary)',
        letterSpacing: '0.3px',
        fontWeight: 400,
        pointerEvents: 'none',
      }}>
        {title}
      </span>

      {/* Right actions slot - Windows需要为窗口按钮留出空间 */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', ['WebkitAppRegion' as string]: 'no-drag' }}>
        {!isMac && <div style={{ width: 138 }} />}
      </div>
    </div>
  );
};

interface WinBtnProps {
  onClick: () => void;
  title: string;
  hover: string;
  danger?: boolean;
  children: React.ReactNode;
}

const WinBtn: React.FC<WinBtnProps> = ({ onClick, title, hover, danger, children }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 46, height: 'var(--titlebar-height)',
        background: hovered ? hover : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hovered && danger ? '#fff' : 'var(--text-secondary)',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
};

interface TrafficLightProps {
  color: string;
  onClick: () => void;
  title: string;
}

const TrafficLight: React.FC<TrafficLightProps> = ({ color, onClick, title }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color,
        border: 'none',
        cursor: 'pointer',
        filter: hovered ? 'brightness(1.2)' : 'none',
        transition: 'filter 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 8,
        color: 'transparent',
        flexShrink: 0,
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.5)';
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'transparent';
      }}
    >
      ×
    </button>
  );
};
