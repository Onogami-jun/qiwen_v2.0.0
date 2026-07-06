/**
 * DragOverlay — 全局拖拽覆盖层（简化版）
 *
 * 拖拽行为：
 * 1. 拖面板标题栏超过 8px → 显示浮动预览跟随鼠标
 * 2. 鼠标移到目标面板的上下左右边缘 30px → 显示蓝色预览区
 * 3. 松手 → 在该方向分屏插入新面板
 * 4. 鼠标不在任何热区松手 → 取消拖拽，面板归位
 */
import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { updateDrag, endDrag, splitPanel } from '../../store/slices/panelLayoutSlice';
import type { DropEdge, PanelNode } from '../../store/slices/panelLayoutSlice';

const EDGE_PX = 32;

// ── Find the leaf panel ID nearest to the mouse ──────────────

function findTarget(
  mx: number, my: number,
): { panelId: string; edge: DropEdge } | null {
  const panels = document.querySelectorAll('[data-panel-id]');
  let best: { panelId: string; edge: DropEdge; dist: number } | null = null;

  panels.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (mx < r.left || mx > r.left + r.width || my < r.top || my > r.top + r.height) return;

    const dL = mx - r.left, dR = r.left + r.width - mx;
    const dT = my - r.top, dB = r.top + r.height - my;

    for (const [edge, dist] of [['left', dL], ['right', dR], ['top', dT], ['bottom', dB]] as [DropEdge, number][]) {
      if (dist <= EDGE_PX && dist > 4 && (!best || dist < best.dist)) {
        best = { panelId: (el as HTMLElement).dataset.panelId!, edge, dist };
      }
    }
  });
  return best ? { panelId: best.panelId, edge: best.edge } : null;
}

// ── Drop Zone Indicator ─────────────────────────────────────

interface ZoneProps { panelId: string; edge: DropEdge }

const DropZone: React.FC<ZoneProps> = ({ panelId, edge }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null;
    if (!el || !ref.current) return;
    const r = el.getBoundingClientRect();
    const z = 0.35;
    const map: Record<DropEdge, { left: string; top: string; width: string; height: string }> = {
      left:   { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width*z}px`, height: `${r.height}px` },
      right:  { left: `${r.left+r.width*(1-z)}px`, top: `${r.top}px`, width: `${r.width*z}px`, height: `${r.height}px` },
      top:    { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height*z}px` },
      bottom: { left: `${r.left}px`, top: `${r.top+r.height*(1-z)}px`, width: `${r.width}px`, height: `${r.height*z}px` },
    };
    Object.assign(ref.current.style, map[edge]);
  }, [panelId, edge]);

  return <div ref={ref} className="pn-drop-zone" />;
};

// ── Component ────────────────────────────────────────────────

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
        // Determine which type of panel to create (opposite of source)
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
