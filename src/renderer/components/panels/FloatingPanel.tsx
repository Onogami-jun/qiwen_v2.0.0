import React, { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { moveFloating, resizeFloating, focusFloating, closeFloating, reattachPanel } from '../../store/slices/panelLayoutSlice';
import type { FloatingPanelState, DropEdge } from '../../store/slices/panelLayoutSlice';
import ChatPanel from './ChatPanel';
import EditorPanel from './EditorPanel';
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;
function getDir(e: React.MouseEvent, el: HTMLElement): ResizeDir { const r = el.getBoundingClientRect(), ex = 10; const x = e.clientX - r.left, y = e.clientY - r.top; const t = y < ex, b = y > r.height - ex, l = x < ex, ri = x > r.width - ex; if (t && l) return 'nw'; if (t && ri) return 'ne'; if (b && l) return 'sw'; if (b && ri) return 'se'; if (t) return 'n'; if (b) return 's'; if (l) return 'w'; if (ri) return 'e'; return null; }
const CURSORS: Record<string, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
const SNAP = 44;
function checkSnap(mx: number, my: number): { panelId: string; edge: DropEdge } | null {
  let bp='';let be:DropEdge='left';let bd=Infinity;
  document.querySelectorAll('[data-panel-id]').forEach(el=>{const r=(el as HTMLElement).getBoundingClientRect();if(mx<r.left-SNAP||mx>r.left+r.width+SNAP||my<r.top-SNAP||my>r.top+r.height+SNAP)return;const es:DropEdge[]=['left','right','top','bottom'];const ds=[mx-r.left,r.left+r.width-mx,my-r.top,r.top+r.height-my];const mi=ds.indexOf(Math.min(...ds));if(Math.abs(ds[mi])<=SNAP&&ds[mi]<bd){bd=ds[mi];be=es[mi];bp=(el as HTMLElement).dataset.panelId??''}});
  return bp?{panelId:bp,edge:be}:null;
}
interface Props { fp: FloatingPanelState; editorChildren?: React.ReactNode; getDocContent?: () => string; }
const FloatingPanel: React.FC<Props> = ({ fp, editorChildren, getDocContent }) => {
  const dispatch = useDispatch<AppDispatch>(); const ref = useRef<HTMLDivElement>(null);
  const dr = useRef({ sx: 0, sy: 0, x: 0, y: 0, on: false });
  const rr = useRef({ sx: 0, sy: 0, w: 0, h: 0, x: 0, y: 0, dir: null as ResizeDir, on: false });
  const onTitleDown = useCallback((e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('button')) return; e.preventDefault(); dispatch(focusFloating(fp.id)); dr.current = { sx: e.clientX, sy: e.clientY, x: fp.x, y: fp.y, on: true }; const mv = (ev: MouseEvent) => { if (!dr.current.on) return; dispatch(moveFloating({ id: fp.id, x: ev.clientX - dr.current.sx + dr.current.x, y: ev.clientY - dr.current.sy + dr.current.y })); }; const up = (ev: MouseEvent) => { dr.current.on = false; const t = checkSnap(ev.clientX, ev.clientY); if (t) dispatch(reattachPanel({ floatingId: fp.id, targetId: t.panelId, position: t.edge })); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); }, [dispatch, fp.id, fp.x, fp.y]);
  const onEdgeDown = useCallback((e: React.MouseEvent) => { if (!ref.current) return; const dir = getDir(e, ref.current); if (!dir) return; e.preventDefault(); e.stopPropagation(); dispatch(focusFloating(fp.id)); rr.current = { sx: e.clientX, sy: e.clientY, w: fp.width, h: fp.height, x: fp.x, y: fp.y, dir, on: true }; const mv = (ev: MouseEvent) => { if (!rr.current.on) return; const { sx, sy, w, h, x, y, dir: d } = rr.current; const dx = ev.clientX - sx, dy = ev.clientY - sy; let nw = w, nh = h, nx = x, ny = y; if (d === 'e' || d === 'ne' || d === 'se') nw = Math.max(250, w + dx); if (d === 'w' || d === 'nw' || d === 'sw') { nw = Math.max(250, w - dx); nx = x + (w - nw); } if (d === 's' || d === 'se' || d === 'sw') nh = Math.max(150, h + dy); if (d === 'n' || d === 'ne' || d === 'nw') { nh = Math.max(150, h - dy); ny = y + (h - nh); } if (nw !== w || nh !== h) dispatch(resizeFloating({ id: fp.id, width: nw, height: nh })); if (nx !== x || ny !== y) dispatch(moveFloating({ id: fp.id, x: nx, y: ny })); }; const up = () => { rr.current.on = false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); }, [dispatch, fp.id, fp.width, fp.height, fp.x, fp.y]);
  const onMove = useCallback((e: React.MouseEvent) => { if (!ref.current || rr.current.on) return; const d = getDir(e, ref.current); (e.target as HTMLElement).style.cursor = (d && CURSORS[d]) || 'auto'; }, []);
  return React.createElement('div', { ref, className: 'fp-window', style: { position: 'fixed', zIndex: fp.zIndex, left: fp.x, top: fp.y, width: fp.width, height: fp.height }, onMouseMove: onMove, onMouseDown: () => dispatch(focusFloating(fp.id)) },
    React.createElement('div', { className: 'fp-window__inner' },
      React.createElement('div', { className: 'fp-window__titlebar', onMouseDown: onTitleDown },
        React.createElement('span', { className: 'fp-window__title' }, fp.title),
        React.createElement('button', { className: 'fp-window__close', onClick: (e: any) => { e.stopPropagation(); dispatch(closeFloating(fp.id)); } }, '×')),
      React.createElement('div', { className: 'fp-window__body' },
        fp.panelType === 'chat'
          ? React.createElement(ChatPanel as any, { node: { id: fp.id, type: 'leaf', panelType: 'chat', title: fp.title }, gdc: getDocContent })
          : React.createElement(EditorPanel, { node: { id: fp.id, type: 'leaf', panelType: 'editor', title: fp.title } }, editorChildren))));
};
export default React.memo(FloatingPanel);
