/**
 * FloatingPanel — 可拖拽、可缩放的浮动窗口
 *
 * 行为：
 * - 拖标题栏：移动窗口
 * - 拖八向边缘手柄：缩放窗口
 * - 点击：置顶（zIndex + 1）
 * - 拖动到网格边缘松手 → 触发 reattach
 */
import React, { useCallback, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { moveFloating, resizeFloating, focusFloating, closeFloating, reattachPanel } from '../../store/slices/panelLayoutSlice';
import type { FloatingPanelState } from '../../store/slices/panelLayoutSlice';
import ChatPanel from './ChatPanel';
import EditorPanel from './EditorPanel';

const MIN_W = 250, MIN_H = 150;

// ── Resize direction from edge proximity ────────────────────

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

function getResizeDir(e: React.MouseEvent, el: HTMLElement): ResizeDir {
  const r = el.getBoundingClientRect();
  const edge = 10;
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const nearT = y < edge, nearB = y > r.height - edge;
  const nearL = x < edge, nearR = x > r.width - edge;
  if (nearT && nearL) return 'nw'; if (nearT && nearR) return 'ne';
  if (nearB && nearL) return 'sw'; if (nearB && nearR) return 'se';
  if (nearT) return 'n'; if (nearB) return 's';
  if (nearL) return 'w'; if (nearR) return 'e';
  return null;
}

function cursorForDir(d: ResizeDir): string {
  return d === 'n' || d === 's' ? 'ns-resize' :
    d === 'e' || d === 'w' ? 'ew-resize' :
    d === 'ne' || d === 'sw' ? 'nesw-resize' :
    d === 'nw' || d === 'se' ? 'nwse-resize' : 'auto';
}

// ── Reattach detection ─────────────────────────────────────

const SNAP_DIST = 40;

function checkReattach(mx: number, my: number): { panelId: string; edge: 'left' | 'right' | 'top' | 'bottom' } | null {
  // Check if near any grid panel edge
  const panels = document.querySelectorAll('[data-panel-id]');
  let best: any = null;
  panels.forEach(el => {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (mx < r.left - SNAP_DIST || mx > r.left + r.width + SNAP_DIST) return;
    if (my < r.top - SNAP_DIST || my > r.top + r.height + SNAP_DIST) return;
    // Inside or near — check which edge is closest
    const edges: ['left','right','top','bottom'] = ['left','right','top','bottom'];
    const dists = [mx - r.left, r.left + r.width - mx, my - r.top, r.top + r.height - my];
    const minI = dists.indexOf(Math.min(...dists));
    if (Math.abs(dists[minI]) <= SNAP_DIST) {
      best = { panelId: (el as HTMLElement).dataset.panelId!, edge: edges[minI] };
    }
  });
  return best;
}

// ── Props ───────────────────────────────────────────────────

interface Props {
  fp: FloatingPanelState;
  editorChildren?: React.ReactNode;
  getDocContent?: () => string;
}

const FloatingPanel: React.FC<Props> = ({ fp, editorChildren, getDocContent }) => {
  const dispatch = useDispatch<AppDispatch>();
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ sx: 0, sy: 0, fx: 0, fy: 0, active: false });
  const resizeRef = useRef({ sx: 0, sy: 0, fw: 0, fh: 0, fx: 0, fy: 0, dir: null as ResizeDir, active: false });

  // ── Titlebar drag ──────────────────────────────────────

  const onTitleDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dispatch(focusFloating(fp.id));
    dragRef.current = { sx: e.clientX - fp.x, sy: e.clientY - fp.y, fx: fp.x, fy: fp.y, active: true };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.active) return;
      const newX = ev.clientX - dragRef.current.sx, newY = ev.clientY - dragRef.current.sy;
      dispatch(moveFloating({ id: fp.id, x: newX, y: newY }));
    };
    const onUp = (ev: MouseEvent) => {
      dragRef.current.active = false;
      // Check reattach
      const target = checkReattach(ev.clientX, ev.clientY);
      if (target) {
        dispatch(reattachPanel({ floatingId: fp.id, targetId: target.panelId, position: target.edge }));
        return;
      }
      cleanup();
    };
    const cleanup = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dispatch, fp.id, fp.x, fp.y]);

  // ── Edge resize ────────────────────────────────────────

  const onEdgeDown = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const dir = getResizeDir(e, ref.current);
    if (!dir) return;
    e.preventDefault(); e.stopPropagation();
    dispatch(focusFloating(fp.id));
    resizeRef.current = { sx: e.clientX, sy: e.clientY, fw: fp.width, fh: fp.height, fx: fp.x, fy: fp.y, dir, active: true };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.active) return;
      const { sx, sy, fw, fh, fx, fy, dir: d } = resizeRef.current;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let nw = fw, nh = fh, nx = fx, ny = fy;

      if (d?.includes('e')) nw = Math.max(MIN_W, fw + dx);
      if (d?.includes('w')) { nw = Math.max(MIN_W, fw - dx); nx = fx + (fw - nw); }
      if (d?.includes('s')) nh = Math.max(MIN_H, fh + dy);
      if (d?.includes('n')) { nh = Math.max(MIN_H, fh - dy); ny = fy + (fh - nh); }

      dispatch(resizeFloating({ id: fp.id, width: nw, height: nh }));
      if (d?.includes('w') || d?.includes('n')) dispatch(moveFloating({ id: fp.id, x: nx, y: ny }));
    };
    const onUp = () => { resizeRef.current.active = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dispatch, fp.id, fp.width, fp.height, fp.x, fp.y]);

  // ── Mouse cursor on edges ──────────────────────────────

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || resizeRef.current.active) return;
    const dir = getResizeDir(e, ref.current);
    (e.target as HTMLElement).style.cursor = dir ? cursorForDir(dir) : 'auto';
  }, []);

  // ── Content ────────────────────────────────────────────

  const content = fp.panelType === 'chat'
    ? <ChatPanel node={{ id: fp.id, type: 'leaf', panelType: 'chat', title: fp.title }} getDocumentContent={getDocContent} />
    : <EditorPanel node={{ id: fp.id, type: 'leaf', panelType: 'editor', title: fp.title }}>{editorChildren}</EditorPanel>;

  return (
    <div
      ref={ref}
      className="fp-window"
      style={{
        position: 'fixed', zIndex: fp.zIndex,
        left: fp.x, top: fp.y, width: fp.width, height: fp.height,
      }}
      onMouseMove={onMouseMove}
      onMouseDown={() => dispatch(focusFloating(fp.id))}
    >
      <div className="fp-window__inner">
        {/* Titlebar */}
        <div className="fp-window__titlebar" onMouseDown={onTitleDown}>
          <span className="fp-window__title">{fp.title}</span>
          <button className="fp-window__close" onClick={(e) => { e.stopPropagation(); dispatch(closeFloating(fp.id)); }}>&times;</button>
        </div>
        {/* Body */}
        <div className="fp-window__body">
          {content}
        </div>
      </div>
    </div>
  );
};

export default React.memo(FloatingPanel);
