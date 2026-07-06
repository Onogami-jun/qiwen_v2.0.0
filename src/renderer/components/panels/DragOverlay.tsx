/**
 * DragOverlay — 全局拖拽覆盖层
 */
import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { updateDrag, endDrag, splitPanel } from '../../store/slices/panelLayoutSlice';
import type { DropEdge, PanelNode } from '../../store/slices/panelLayoutSlice';

const EDGE_PX = 32;

// ── Find target ──────────────────────────────────────────────

function findTarget(mx: number, my: number): { panelId: string; edge: DropEdge } | null {
  const panels = document.querySelectorAll('[data-panel-id]');
  let bestId = ''; let bestEdge: DropEdge = 'left'; let bestDist = Infinity;

  for (const el of panels) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (mx < r.left || mx > r.left + r.width || my < r.top || my > r.top + r.height) continue;

    const dL = mx - r.left, dR = r.left + r.width - mx;
    const dT = my - r.top, dB = r.top + r.height - my;

    for (const [edge, dist] of [['left', dL], ['right', dR], ['top', dT], ['bottom', dB]] as [DropEdge, number][]) {
      if (dist <= EDGE_PX && dist > 4 && dist < bestDist) {
        bestDist = dist;
        bestEdge = edge;
        bestId = (el as HTMLElement).dataset.panelId ?? '';
      }
    }
  }
  return bestDist < Infinity ? { panelId: bestId, edge: bestEdge } : null;
}

// ── Drop Zone ────────────────────────────────────────────────

const DropZone: React.FC<{ panelId: string; edge: DropEdge }> = ({ panelId, edge }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null;
    if (!el || !ref.current) return;
    const r = el.getBoundingClientRect();
    const z = 0.35;
    const map: Record<DropEdge, Record<string, string>> = {
      left:   { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width*z}px`, height: `${r.height}px` },
      right:  { left: `${r.left+r.width*(1-z)}px`, top: `${r.top}px`, width: `${r.width*z}px`, height: `${r.height}px` },
      top:    { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height*z}px` },
      bottom: { left: `${r.left}px`, top: `${r.top+r.height*(1-z)}px`, width: `${r.width}px`, height: `${r.height*z}px` },
    };
    Object.assign(ref.current.style, map[edge]);
  }, [panelId, edge]);

  return <div ref={ref} className="pn-drop-zone" />;
};

// ── Main ─────────────────────────────────────────────────────

let _raf = 0;

const DragOverlay: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const ds = useSelector((s: RootState) => (s as any).panelLayout?.dragState) as {
    sourcePanelId: string; mouseX: number; mouseY: number;
    targetContainerId: string | null; dropEdge: DropEdge | null;
  } | null;
  const tree = useSelector((s: RootState) => (s as any).panelLayout?.tree) as PanelNode | null;

  useEffect(() => {
    if (!ds) return;

    const onMove = (e: MouseEvent) => {
      if (_raf) return;
      _raf = requestAnimationFrame(() => {
        _raf = 0;
        const t = findTarget(e.clientX, e.clientY);
        dispatch(updateDrag({
          mouseX: e.clientX, mouseY: e.clientY,
          targetContainerId: t?.panelId ?? null,
          dropEdge: t?.edge ?? null,
        }));
      });
    };

    const onUp = (e: MouseEvent) => {
      const t = findTarget(e.clientX, e.clientY);
      if (t && tree) {
        const sourceType: 'editor' | 'chat' =
          ds.sourcePanelId.includes('chat') ? 'chat' : 'editor';
        const newType = sourceType === 'editor' ? 'chat' : 'editor';
        const dir = (t.edge === 'left' || t.edge === 'right') ? 'horizontal' : 'vertical';
        dispatch(splitPanel({ targetId: t.panelId, direction: dir, newPanelType: newType, position: t.edge }));
      }
      dispatch(endDrag());
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (_raf) { cancelAnimationFrame(_raf); _raf = 0; }
    };
  }, [ds, dispatch, tree]);

  if (!ds) return null;

  return (<>
    <div className="pn-drag-overlay" style={{ left: ds.mouseX, top: ds.mouseY }}>
      <span className="pn-drag-overlay__label">拖放以分屏</span>
    </div>
    {ds.targetContainerId && ds.dropEdge && (
      <DropZone panelId={ds.targetContainerId} edge={ds.dropEdge} />
    )}
  </>);
};

export default DragOverlay;
