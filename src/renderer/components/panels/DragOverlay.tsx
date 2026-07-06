/**
 * DragOverlay — 全局拖拽覆盖层
 * 拖拽时显示浮动预览 + 检测落点热区 + 触发分屏
 */
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { updateDrag, endDrag, splitPanel } from '../../store/slices/panelLayoutSlice';
import type { PanelLayoutState, DropEdge, PanelType } from '../../store/slices/panelLayoutSlice';
import { findNodeById } from './types';

const EDGE_PX = 35;

interface Rect { id: string; left: number; top: number; width: number; height: number; }

function getRects(): Rect[] {
  const els = document.querySelectorAll('[data-container-id]');
  const rs: Rect[] = [];
  els.forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height) rs.push({ id: (el as HTMLElement).dataset.containerId ?? '', left: r.left, top: r.top, width: r.width, height: r.height }); });
  return rs;
}

function findTarget(mx: number, my: number, rects: Rect[]): { containerId: string; edge: DropEdge } | null {
  let best: { containerId: string; edge: DropEdge; dist: number } | null = null;
  for (const r of rects) {
    if (mx < r.left || mx > r.left + r.width || my < r.top || my > r.top + r.height) continue;
    const edges: { edge: DropEdge; dist: number }[] = [
      { edge: 'left', dist: mx - r.left }, { edge: 'right', dist: r.left + r.width - mx },
      { edge: 'top', dist: my - r.top }, { edge: 'bottom', dist: r.top + r.height - my },
    ];
    for (const { edge, dist } of edges) {
      if (dist <= EDGE_PX && dist > 5 && (!best || dist < best.dist)) best = { containerId: r.id, edge, dist };
    }
  }
  return best ? { containerId: best.containerId, edge: best.edge } : null;
}

// Resolve container ID path to leaf panel ID
function resolveLeaf(tree: any, cid: string): string | null {
  const path = cid.replace(/^root\/?/, ''); if (!path) return tree.id;
  const idxs = path.split('/').map(Number); let n = tree;
  for (const i of idxs) { if (n.type !== 'split' || i >= n.children.length) return null; n = n.children[i]; }
  return n.id;
}

const DragOverlay: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const dragState = useSelector((s: RootState) => (s as any).panelLayout?.dragState) as PanelLayoutState['dragState'];
  const tree = useSelector((s: RootState) => (s as any).panelLayout?.tree);
  const [, tick] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!dragState) return;
    const onMove = (e: MouseEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => { raf.current = 0;
        const rs = getRects(); const t = findTarget(e.clientX, e.clientY, rs);
        dispatch(updateDrag({ mouseX: e.clientX, mouseY: e.clientY, targetContainerId: t?.containerId ?? null, dropEdge: t?.edge ?? null }));
        tick(n => n + 1);
      });
    };
    const onUp = (e: MouseEvent) => {
      const rs = getRects(); const t = findTarget(e.clientX, e.clientY, rs);
      if (t && tree) {
        const src = findNodeById(tree, dragState.sourcePanelId);
        const st: PanelType = src?.type === 'leaf' ? src.panelType : 'chat';
        const np: PanelType = st === 'editor' ? 'chat' : 'editor';
        const tid = resolveLeaf(tree, t.containerId);
        if (tid) {
          const dir = (t.edge === 'left' || t.edge === 'right') ? 'horizontal' : 'vertical';
          dispatch(splitPanel({ targetId: tid, direction: dir, newPanelType: np, position: t.edge }));
        }
      }
      dispatch(endDrag());
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [dragState, dispatch, tree]);

  if (!dragState) return null;

  const label = (() => { if (!tree) return '面板'; const f = findNodeById(tree, dragState.sourcePanelId); return f?.type === 'leaf' ? f.title : '面板'; })();

  return (<>
    <div className="pn-drag-overlay" style={{ left: dragState.mouseX, top: dragState.mouseY }}><span className="pn-drag-overlay__label">{label}</span></div>
    {dragState.targetContainerId && dragState.dropEdge && <DropZone containerId={dragState.targetContainerId} edge={dragState.dropEdge} />}
  </>);
};

const DropZone: React.FC<{ containerId: string; edge: DropEdge }> = ({ containerId, edge }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = document.querySelector(`[data-container-id="${CSS.escape(containerId)}"]`) as HTMLElement | null;
    if (!el || !ref.current) return;
    const r = el.getBoundingClientRect(); const s = 0.4;
    const styles: Record<string, string> = {
      left: { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width*s}px`, height: `${r.height}px` },
      right: { left: `${r.left+r.width*(1-s)}px`, top: `${r.top}px`, width: `${r.width*s}px`, height: `${r.height}px` },
      top: { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height*s}px` },
      bottom: { left: `${r.left}px`, top: `${r.top+r.height*(1-s)}px`, width: `${r.width}px`, height: `${r.height*s}px` },
    }[edge];
    if (styles) Object.assign(ref.current.style, styles);
  }, [containerId, edge]);
  return <div ref={ref} className="pn-drop-zone" />;
};

export default DragOverlay;
