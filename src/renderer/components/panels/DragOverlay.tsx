/**
 * DragOverlay — 拖拽覆盖层（支持浮动脱离）
 * 热区松手 → 分屏  |  非热区松手 → 对话面板浮动  |  编辑器面板 → 取消
 */
import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { updateDrag, endDrag, splitPanel, detachPanel } from '../../store/slices/panelLayoutSlice';
import type { DropEdge, PanelNode } from '../../store/slices/panelLayoutSlice';

const EDGE = 32;

function findTarget(mx: number, my: number): { panelId: string; edge: DropEdge } | null {
  let bi = '', be: DropEdge = 'left', bd = Infinity;
  for (const el of document.querySelectorAll('[data-panel-id]')) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (mx < r.left || mx > r.left + r.width || my < r.top || my > r.top + r.height) continue;
    for (const [e, d] of [['left',mx-r.left],['right',r.left+r.width-mx],['top',my-r.top],['bottom',r.top+r.height-my]] as [DropEdge,number][]) {
      if (d <= EDGE && d > 4 && d < bd) { bd = d; be = e; bi = (el as HTMLElement).dataset.panelId ?? ''; }
    }
  }
  return bd < Infinity ? { panelId: bi, edge: be } : null;
}

const DropZone: React.FC<{ pid: string; edge: DropEdge }> = ({ pid, edge }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = document.querySelector(`[data-panel-id="${pid}"]`) as HTMLElement | null;
    if (!el || !ref.current) return;
    const r = el.getBoundingClientRect(), z = 0.35;
    const m: Record<DropEdge, Record<string,string>> = {
      left:{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width*z}px`,height:`${r.height}px`},
      right:{left:`${r.left+r.width*(1-z)}px`,top:`${r.top}px`,width:`${r.width*z}px`,height:`${r.height}px`},
      top:{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height*z}px`},
      bottom:{left:`${r.left}px`,top:`${r.top+r.height*(1-z)}px`,width:`${r.width}px`,height:`${r.height*z}px`},
    };
    Object.assign(ref.current.style, m[edge]);
  }, [pid, edge]);
  return <div ref={ref} className="pn-drop-zone" />;
};

let _r = 0;

const DragOverlay: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const ds = useSelector((s: RootState) => (s as any).panelLayout?.dragState) as { sourcePanelId:string; mouseX:number; mouseY:number; targetContainerId:string|null; dropEdge:DropEdge|null; } | null;
  const tree = useSelector((s: RootState) => (s as any).panelLayout?.tree) as PanelNode | null;

  useEffect(() => {
    if (!ds) return;
    const mv = (e: MouseEvent) => {
      if (_r) return; _r = requestAnimationFrame(() => { _r = 0;
        const t = findTarget(e.clientX, e.clientY);
        dispatch(updateDrag({ mouseX:e.clientX, mouseY:e.clientY, targetContainerId:t?.panelId??null, dropEdge:t?.edge??null }));
      });
    };
    const up = (e: MouseEvent) => {
      const t = findTarget(e.clientX, e.clientY);
      if (t && tree) {
        const st: 'editor'|'chat' = ds.sourcePanelId.includes('chat') ? 'chat' : 'editor';
        const dir = (t.edge==='left'||t.edge==='right') ? 'horizontal' as const : 'vertical' as const;
        dispatch(splitPanel({ targetId:t.panelId, direction:dir, newPanelType:st==='editor'?'chat':'editor', position:t.edge }));
      } else if (ds.sourcePanelId.includes('chat')) {
        dispatch(detachPanel({ panelId:ds.sourcePanelId, x:Math.max(0,e.clientX-210), y:Math.max(0,e.clientY-30) }));
      }
      dispatch(endDrag());
    };
    window.addEventListener('mousemove', mv, {passive:true}); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); if (_r) { cancelAnimationFrame(_r); _r = 0; } };
  }, [ds, dispatch, tree]);

  if (!ds) return null;
  return (<>
    <div className="pn-drag-overlay" style={{ left:ds.mouseX, top:ds.mouseY }}><span className="pn-drag-overlay__label">{ds.targetContainerId?'松手分屏':'松手浮动'}</span></div>
    {ds.targetContainerId && ds.dropEdge && <DropZone pid={ds.targetContainerId} edge={ds.dropEdge} />}
  </>);
};

export default DragOverlay;
