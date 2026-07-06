/**
 * Panel — 单个面板壳（标题栏可拖拽 + 内容区 + 关闭按钮）
 */
import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { startDrag, closePanel, setActivePanel } from '../../store/slices/panelLayoutSlice';
import type { LeafPanel as LeafPanelType } from './types';

// ── Icons ────────────────────────────────────────────────────

const EditorIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 5h6M5 8h4M5 11h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>);
const ChatIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5.5 12L7.5 14.5L9.5 12" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const CloseIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);

// ── Component ────────────────────────────────────────────────

interface PanelProps { node: LeafPanelType; children: React.ReactNode; }

const Panel: React.FC<PanelProps> = ({ node, children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const activePanelId = useSelector((s: RootState) => (s as any).panelLayout?.activePanelId);
  const isActive = activePanelId === node.id;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dispatch(setActivePanel(node.id));
    const sx = e.clientX, sy = e.clientY;
    const onMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - sx) > 5 || Math.abs(ev.clientY - sy) > 5) {
        dispatch(startDrag({ panelId: node.id, mouseX: ev.clientX, mouseY: ev.clientY }));
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dispatch, node.id]);

  const icon = node.panelType === 'chat' ? <ChatIcon /> : <EditorIcon />;

  return (
    <div className={`pn-panel${isActive ? ' pn-panel--active' : ''}`} onClick={() => dispatch(setActivePanel(node.id))} data-panel-id={node.id}>
      <div className="pn-panel__header" onMouseDown={handleMouseDown}>
        <span className="pn-panel__header-icon">{icon}</span>
        <span className="pn-panel__header-title">{node.title}</span>
        <button className="pn-panel__header-close" onClick={(e) => { e.stopPropagation(); dispatch(closePanel(node.id)); }} title="关闭面板"><CloseIcon /></button>
      </div>
      <div className="pn-panel__content">{children}</div>
    </div>
  );
};

export default React.memo(Panel);
