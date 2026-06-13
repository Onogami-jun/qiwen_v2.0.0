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

// ── 保存 / 另存为 按钮组 ─────────────────────────────────────
const SaveButtons: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const activeTabId = useSelector((s: RootState) => s.app.activeTabId);
  const tabs = useSelector((s: RootState) => s.app.tabs);
  const openDocuments = useSelector((s: RootState) => s.documents.openDocuments);
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeDoc = activeTab ? openDocuments[activeTab.documentId] : null;
  const [saveState, setSaveState] = useState<'idle'|'saving'|'saved'>('idle');

  const handleSave = useCallback(async () => {
    if (!activeDoc) return;
    setSaveState('saving');
    try {
      // 统一走 autoSave.flush，它内部会从 pending 取最新内容
      // 如果 pending 为空，说明内容已经保存过了
      await autoSave.flush(activeDoc.id);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (e) {
      console.error('[Save] failed:', e);
      setSaveState('idle');
    }
  }, [activeDoc]);

  const handleSaveAs = useCallback(async () => {
    const ed = (window as any).__activeEditor;
    if (!ed || !activeDoc) return;
    const api = (window as any).electronAPI;
    if (api?.invoke) {
      try {
        await api.invoke('documents:export-docx', {
          id: activeDoc.id,
          title: activeDoc.title || '无标题',
          html: ed.getHTML(),
        });
      } catch (err: any) {
        alert('导出失败：' + (err?.message || '未知错误'));
      }
    }
  }, [activeDoc]);

  // Ctrl+S 由 EditorToolbar 统一处理，TitleBar 不重复注册

  if (!activeDoc) return null;

  const btnBase: React.CSSProperties = {
    height: 26, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 12, fontFamily: 'inherit', flexShrink: 0,
    transition: 'all 0.15s', ['WebkitAppRegion' as string]: 'no-drag',
  };

  return (
    <div style={{ display: 'flex', gap: 5, marginLeft: 8, ['WebkitAppRegion' as string]: 'no-drag' }}>
      <button
        onClick={handleSave}
        title="保存 Ctrl+S"
        style={{
          ...btnBase,
          border: '0.5px solid rgba(200,169,110,0.35)',
          background: saveState === 'saved' ? 'rgba(82,201,122,0.12)' : 'rgba(200,169,110,0.1)',
          color: saveState === 'saved' ? 'rgba(82,201,122,0.9)' : '#c8a96e',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.25)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = saveState === 'saved' ? 'rgba(82,201,122,0.12)' : 'rgba(200,169,110,0.1)'; }}
      >
        {saveState === 'saving' ? (
          <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #c8a96e', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        ) : saveState === 'saved' ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        )}
        {saveState === 'saved' ? '已保存' : '保存'}
      </button>
      <button
        onClick={handleSaveAs}
        title="另存为 .docx"
        style={{
          ...btnBase,
          border: '0.5px solid var(--border)',
          background: 'var(--bg-surface3)',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        另存为
      </button>
    </div>
  );
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
