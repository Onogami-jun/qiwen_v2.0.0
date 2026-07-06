/**
 * Panel — 单个面板壳（可拖拽标题栏 + 内容区 + 关闭按钮）
 */
import React, { useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { startDrag, closePanel, setActivePanel } from '../../store/slices/panelLayoutSlice';
import type { LeafPanel as LeafPanelType } from './types';

const EditorIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 5h6M5 8h4M5 11h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>);
const ChatIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5.5 12L7.5 14.5L9.5 12" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>);

interface Props { node: LeafPanelType; children: React.ReactNode; }

const DRAG_THRESHOLD = 8;

const Panel: React.FC<Props> = ({ node, children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const activeId = useSelector((s: RootState) => (s as any).panelLayout?.activePanelId) as string | null;
  const isActive = activeId === node.id;
  const dragArmed = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dispatch(setActivePanel(node.id));

    const sx = e.clientX, sy = e.clientY;
    dragArmed.current = false;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragArmed.current = true;
        dispatch(startDrag({ panelId: node.id, mouseX: ev.clientX, mouseY: ev.clientY }));
        cleanup();
      }
    };
    const onUp = () => { cleanup(); };
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dispatch, node.id]);

  const icon = node.panelType === 'chat' ? <ChatIcon /> : <EditorIcon />;

  return (
    <div
      className={'pn-panel' + (isActive ? ' pn-panel--active' : '')}
      onClick={() => dispatch(setActivePanel(node.id))}
      data-panel-id={node.id}
    >
      <div className="pn-panel__header" onMouseDown={onMouseDown}>
        <span className="pn-panel__header-icon">{icon}</span>
        <span className="pn-panel__header-title">{node.title}</span>
        <button className="pn-panel__header-close" onClick={(e) => { e.stopPropagation(); dispatch(closePanel(node.id)); }} title="关闭面板">&times;</button>
      </div>
      <div className="pn-panel__content">{children}</div>
    </div>
  );
};

export default React.memo(Panel);
