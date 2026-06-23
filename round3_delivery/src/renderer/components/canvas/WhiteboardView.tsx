import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ipc } from '../../utils/ipc';
import { RootState } from '../../store';
import { WhiteboardAiEditPanel } from './WhiteboardAiEditPanel';



type Tool = 'select' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'eraser';
interface Pt { x: number; y: number; }
interface BaseEl { id: string; color: string; sw: number; }
interface PathEl   extends BaseEl { type: 'path';    pts: Pt[]; }
interface RectEl   extends BaseEl { type: 'rect';    x: number; y: number; w: number; h: number; fill: string; }
interface EllEl    extends BaseEl { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; }
interface ArrowEl  extends BaseEl { type: 'arrow';   x1: number; y1: number; x2: number; y2: number; }
interface TextEl   extends BaseEl { type: 'text';    x: number; y: number; text: string; fs: number; }
type El = PathEl | RectEl | EllEl | ArrowEl | TextEl;
interface Vp { x: number; y: number; zoom: number; }
interface CanvasMeta { id: string; workspaceId: string; title: string; type: string; createdAt: number; updatedAt: number; }

const uid = () => Math.random().toString(36).slice(2, 10);
const PALETTE = ['#e2e0da','var(--accent)','#7acfe8','#7ae8a0','var(--color-danger)','#e8c87a','#b07ae8','#e87abf','#52504e'];
const SW_LIST = [1, 2, 4, 8];

// ── Board Editor ────────────────────────────────────────────
const BoardEditor: React.FC<{ canvasId: string; title: string; onBack: () => void }> = ({ canvasId, title, onBack }) => {
  const [els, setEls] = useState<El[]>([]);
  const [vp, setVp] = useState<Vp>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#e2e0da');
  const [sw, setSw] = useState(2);
  const [fill, setFill] = useState('transparent');
  const [drawing, setDrawing] = useState(false);
  const [cur, setCur] = useState<El | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAiEdit, setShowAiEdit] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panRef = useRef<Pt | null>(null);
  const isPan = useRef(false);

  useEffect(() => {
    ipc.invoke('canvases:get', { id: canvasId }).then((d: any) => {
      if (!d) return;
      try { const p = JSON.parse(d.data); setEls(p.elements || []); setVp(p.viewport || { x: 0, y: 0, zoom: 1 }); } catch {}
    }).catch(() => {});
  }, [canvasId]);

  const save = useCallback((e: El[], v: Vp) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      ipc.invoke('canvases:save', { id: canvasId, data: JSON.stringify({ elements: e, viewport: v }) }).catch(() => {});
    }, 600);
  }, [canvasId]);

  const upd = (newEls: El[]) => { setEls(newEls); save(newEls, vp); };

  const toSvg = (e: React.MouseEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - vp.x) / vp.zoom, y: (e.clientY - r.top - vp.y) / vp.zoom };
  };

  const onDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { isPan.current = true; panRef.current = { x: e.clientX, y: e.clientY }; return; }
    if (tool === 'select' || tool === 'eraser') { setSel(null); return; }
    const pt = toSvg(e);
    if (tool === 'text') {
      const el: TextEl = { id: uid(), type: 'text', x: pt.x, y: pt.y, text: '', color, sw, fs: 18 };
      setEls(p => [...p, el]); setEditId(el.id); return;
    }
    setDrawing(true);
    if (tool === 'pen') setCur({ id: uid(), type: 'path', pts: [pt], color, sw });
    else if (tool === 'rect') setCur({ id: uid(), type: 'rect', x: pt.x, y: pt.y, w: 0, h: 0, color, sw, fill });
    else if (tool === 'ellipse') setCur({ id: uid(), type: 'ellipse', cx: pt.x, cy: pt.y, rx: 0, ry: 0, color, sw, fill });
    else if (tool === 'arrow') setCur({ id: uid(), type: 'arrow', x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color, sw });
  };

  const onMove = (e: React.MouseEvent) => {
    if (isPan.current && panRef.current) {
      setVp(v => { const nv = { ...v, x: v.x + e.clientX - panRef.current!.x, y: v.y + e.clientY - panRef.current!.y }; panRef.current = { x: e.clientX, y: e.clientY }; save(els, nv); return nv; });
      return;
    }
    if (!drawing || !cur) return;
    const pt = toSvg(e);
    if (cur.type === 'path') setCur(c => c ? { ...c, pts: [...(c as PathEl).pts, pt] } as PathEl : c);
    else if (cur.type === 'rect') setCur(c => c ? { ...c, w: pt.x - (c as RectEl).x, h: pt.y - (c as RectEl).y } as RectEl : c);
    else if (cur.type === 'ellipse') setCur(c => c ? { ...c, rx: Math.abs(pt.x - (c as EllEl).cx), ry: Math.abs(pt.y - (c as EllEl).cy) } as EllEl : c);
    else if (cur.type === 'arrow') setCur(c => c ? { ...c, x2: pt.x, y2: pt.y } as ArrowEl : c);
  };

  const onUp = () => {
    isPan.current = false; panRef.current = null;
    if (!drawing || !cur) { setDrawing(false); return; }
    setDrawing(false); upd([...els, cur]); setCur(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left; const my = e.clientY - r.top;
    setVp(v => { const nz = Math.min(Math.max(v.zoom * f, 0.05), 10); const nv = { x: mx - (mx - v.x) * (nz / v.zoom), y: my - (my - v.y) * (nz / v.zoom), zoom: nz }; save(els, nv); return nv; });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editId) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { upd(els.filter(el => el.id !== sel)); setSel(null); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { setEls(p => { const n = p.slice(0, -1); save(n, vp); return n; }); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel, editId, els, vp]);

  const renderEl = (el: El, preview = false) => {
    const k = preview ? 'preview' : el.id;
    const isSel = sel === el.id;
    const sf = isSel ? { filter: 'drop-shadow(0 0 5px rgba(100,160,255,0.7))' } : {};
    const cp = !preview ? {
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); if (tool === 'select') setSel(el.id); else if (tool === 'eraser') upd(els.filter(x => x.id !== el.id)); },
      style: { cursor: tool === 'select' ? 'pointer' : tool === 'eraser' ? 'cell' : 'crosshair', ...sf } as React.CSSProperties,
    } : { style: sf as React.CSSProperties };

    if (el.type === 'path') {
      const d = el.pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      return <path key={k} d={d} stroke={el.color} strokeWidth={el.sw} fill="none" strokeLinecap="round" strokeLinejoin="round" {...cp} />;
    }
    if (el.type === 'rect') {
      const x = el.w < 0 ? el.x + el.w : el.x; const y = el.h < 0 ? el.y + el.h : el.y;
      return <rect key={k} x={x} y={y} width={Math.abs(el.w)} height={Math.abs(el.h)} stroke={el.color} strokeWidth={el.sw} fill={el.fill === 'transparent' ? 'none' : el.fill} {...cp} />;
    }
    if (el.type === 'ellipse') return <ellipse key={k} cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} stroke={el.color} strokeWidth={el.sw} fill={el.fill === 'transparent' ? 'none' : el.fill} {...cp} />;
    if (el.type === 'arrow') {
      const dx = el.x2 - el.x1; const dy = el.y2 - el.y1; const len = Math.sqrt(dx*dx+dy*dy)||1;
      const ux = dx/len; const uy = dy/len; const aw = 12; const ah = 6;
      return (
        <g key={k} {...cp}>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.color} strokeWidth={el.sw} />
          <polygon points={`${el.x2},${el.y2} ${el.x2-ux*aw-uy*ah},${el.y2-uy*aw+ux*ah} ${el.x2-ux*aw+uy*ah},${el.y2-uy*aw-ux*ah}`} fill={el.color} />
        </g>
      );
    }
    if (el.type === 'text') {
      if (editId === el.id) return (
        <foreignObject key={k} x={el.x} y={el.y - el.fs} width={280} height={160}>
          <textarea autoFocus value={el.text}
            onChange={ev => setEls(p => p.map(x => x.id === el.id ? { ...x, text: ev.target.value } as TextEl : x))}
            onBlur={() => { setEditId(null); save(els, vp); }}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(var(--accent-rgb), 0.5)', outline: 'none', resize: 'none', color: el.color, fontSize: el.fs, fontFamily: 'inherit', padding: 4, minWidth: 60, minHeight: 32, borderRadius: 'var(--radius-sm)' }} />
        </foreignObject>
      );
      return <text key={k} x={el.x} y={el.y} fill={el.color} fontSize={el.fs} fontFamily="inherit" onDoubleClick={() => setEditId(el.id)} style={{ cursor: 'text', ...sf }} {...(!preview ? { onClick: (ev: React.MouseEvent) => { ev.stopPropagation(); if (tool === 'select') setSel(el.id); } } : {})}>{el.text || '双击编辑'}</text>;
    }
    return null;
  };

  const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: '选择', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4l6 16 3-7 7-3z"/></svg> },
    { id: 'pen', label: '画笔', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/></svg> },
    { id: 'rect', label: '矩形', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
    { id: 'ellipse', label: '椭圆', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg> },
    { id: 'arrow', label: '箭头', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> },
    { id: 'text', label: '文字', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
    { id: 'eraser', label: '橡皮', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16l10-10 7 7-3 3"/></svg> },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 48, borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6, background: 'var(--bg-surface)', flexShrink: 0, overflowX: 'auto' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>返回
        </button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

        {/* Tools */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {TOOLS.map(t => (
            <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
              style={{ width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-md)', background: tool === t.id ? 'rgba(var(--accent-rgb), 0.18)' : 'transparent', color: tool === t.id ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: tool === t.id ? 'inset 0 0 0 1px rgba(var(--accent-rgb), 0.4)' : 'none', flexShrink: 0 }}>
              {t.icon}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

        {/* Color palette */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {PALETTE.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{ width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? `2px solid rgba(255,255,255,0.8)` : '2px solid transparent', boxSizing: 'border-box', flexShrink: 0 }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} title="自定义颜色" style={{ width: 20, height: 20, border: 'none', padding: 0, background: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

        {/* Stroke width */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
          {SW_LIST.map(w => (
            <div key={w} onClick={() => setSw(w)} title={`${w}px`} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 'var(--radius-sm)', background: sw === w ? 'var(--bg-surface3)' : 'transparent', border: sw === w ? '0.5px solid var(--border-md)' : 'none' }}>
              <div style={{ width: Math.min(w * 3, 18), height: w, background: 'var(--text-secondary)', borderRadius: 1 }} />
            </div>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

        {/* Fill */}
        <button onClick={() => setFill(f => f === 'transparent' ? color : 'transparent')} title="切换填充" style={{ padding: '3px 8px', height: 26, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: fill !== 'transparent' ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent', color: fill !== 'transparent' ? 'var(--accent)' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', flexShrink: 0 }}>
          {fill !== 'transparent' ? '有填充' : '无填充'}
        </button>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{Math.round(vp.zoom * 100)}%</span>
        <button onClick={() => { const nv = { x: 0, y: 0, zoom: 1 }; setVp(nv); save(els, nv); }} style={{ padding: '3px 8px', height: 26, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', flexShrink: 0 }}>重置</button>
        <button onClick={() => setShowAiEdit(v => !v)} style={{ padding: '3px 8px', height: 26, border: `0.5px solid ${showAiEdit ? 'rgba(var(--accent-rgb), 0.4)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', background: showAiEdit ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent', color: showAiEdit ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', flexShrink: 0 }}>✎ AI 编辑</button>
        {sel && <button onClick={() => { upd(els.filter(e => e.id !== sel)); setSel(null); }} style={{ padding: '3px 8px', height: 26, border: '0.5px solid rgba(255,100,100,0.3)', borderRadius: 'var(--radius-md)', background: 'rgba(255,100,100,0.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', flexShrink: 0 }}>删除</button>}
        <button onClick={() => { upd([]); }} style={{ padding: '3px 8px', height: 26, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', flexShrink: 0 }}>清空</button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-editor)', position: 'relative' }}>
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.06 }} width="100%" height="100%">
          <defs><pattern id="wbdot" width={22 * vp.zoom} height={22 * vp.zoom} patternUnits="userSpaceOnUse" x={vp.x % (22 * vp.zoom)} y={vp.y % (22 * vp.zoom)}><circle cx={11 * vp.zoom} cy={11 * vp.zoom} r="1" fill="rgba(var(--accent-rgb), 1)" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#wbdot)" />
        </svg>
        <svg ref={svgRef} width="100%" height="100%"
          style={{ cursor: drawing ? 'crosshair' : isPan.current ? 'grabbing' : tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair', userSelect: 'none' }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}
          onClick={e => { if ((e.target as SVGElement).tagName === 'svg') setSel(null); }}>
          <g transform={`translate(${vp.x},${vp.y}) scale(${vp.zoom})`}>
            {els.map(el => renderEl(el))}
            {cur && renderEl(cur, true)}
          </g>
        </svg>
        <div style={{ position: 'absolute', bottom: 14, right: 18, fontSize: 11, color: 'rgba(var(--accent-rgb), 0.28)', pointerEvents: 'none' }}>
          滚轮缩放 · Alt + 拖拽平移 · Del 删除选中 · Ctrl+Z 撤销
        </div>
      </div>

      {showAiEdit && (
        <WhiteboardAiEditPanel
          elements={els}
          onApply={(newEls) => upd(newEls)}
          onClose={() => setShowAiEdit(false)}
        />
      )}
    </div>
  );
};

// ── List view ──────────────────────────────────────────────
export const WhiteboardView: React.FC = () => {
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const list = await ipc.invoke('canvases:list', { workspaceId: activeWorkspaceId, type: 'whiteboard' }).catch((e: any) => { console.error('[Whiteboard] canvases:list failed:', e); return []; });
    setCanvases(list || []);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!activeWorkspaceId) return;
    const t = newTitle.trim() || '新白板';
    const res = await ipc.invoke('canvases:create', { workspaceId: activeWorkspaceId, title: t, type: 'whiteboard' }).catch((e: any) => { console.error('[Whiteboard] canvases:create failed:', e); return null; });
    if (res) { setNewTitle(''); setShowNew(false); setActiveId(res.id); setActiveTitle(res.title); }
  };

  const del = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('确定删除这个白板？')) return;
    await ipc.invoke('canvases:delete', { id }).catch(() => {});
    setCanvases(prev => prev.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setActiveTitle(''); }
  };

  const fmt = (ts: number) => {
    const d = Date.now() - ts;
    if (d < 60000) return '刚刚';
    if (d < 3600000) return `${Math.floor(d / 60000)} 分钟前`;
    if (d < 86400000) return '今天';
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (activeId) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-editor)' }}>
      <BoardEditor canvasId={activeId} title={activeTitle} onBack={() => { setActiveId(null); load(); }} />
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-editor)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '28px 36px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>白板</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{canvases.length} 个白板</div>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'linear-gradient(135deg,var(--accent),#9a7040)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建白板
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 36px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : canvases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 52, opacity: 0.12, marginBottom: 16 }}>🖊</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 6 }}>还没有白板</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>点击「新建白板」开始绘制</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {canvases.map(c => (
              <div key={c.id} onClick={() => { setActiveId(c.id); setActiveTitle(c.title); }}
                style={{ cursor: 'pointer', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-surface2)', transition: 'all 0.15s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(var(--accent-rgb), 0.4)'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.transform = 'none'; el.style.boxShadow = 'none'; }}>
                {/* Preview */}
                <div style={{ height: 110, background: 'var(--bg-editor)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <svg width="160" height="90" viewBox="0 0 160 90" style={{ opacity: 0.5 }}>
                    <path d="M20,70 Q40,20 80,45 T140,30" stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
                    <rect x="30" y="15" width="40" height="25" rx="4" stroke="#7acfe8" strokeWidth="1.5" fill="none" />
                    <ellipse cx="120" cy="65" rx="18" ry="12" stroke="#7ae8a0" strokeWidth="1.5" fill="none" />
                    <line x1="45" y1="55" x2="100" y2="30" stroke="#e8c87a" strokeWidth="1.5" />
                    <polygon points="100,30 94,35 96,24" fill="#e8c87a" />
                  </svg>
                </div>
                {/* Footer */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{c.title}</div>
                    <button onClick={e => del(e, c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 15, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                      onMouseOver={e => (e.currentTarget.style.color = '#ff6b6b')} onMouseOut={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>×</button>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{fmt(c.updatedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New modal */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 360, background: 'var(--bg-surface)', border: '0.5px solid var(--border-md)', borderRadius: 'var(--radius-2xl)', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>新建白板</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 18 }}>自由绘制，记录你的灵感</div>
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setShowNew(false); }}
              placeholder="白板名称（如：头脑风暴）"
              style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface3)', border: '0.5px solid var(--border-md)', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>取消</button>
              <button onClick={create} style={{ height: 34, padding: '0 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'linear-gradient(135deg,var(--accent),#9a7040)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500 }}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
