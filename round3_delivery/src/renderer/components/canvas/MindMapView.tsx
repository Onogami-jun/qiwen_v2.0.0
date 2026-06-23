import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ipc } from '../../utils/ipc';
import { AppDispatch } from '../../store';
import { createDocument, updateDocument } from '../../store/slices/documentsSlice';
import { openTab, setView } from '../../store/slices/appSlice';
import { createPresentation, saveAllSlides } from '../../store/slices/presentationsSlice';
import { RootState } from '../../store';
import { MindMapAiEditPanel } from './MindMapAiEditPanel';



// ── Types ──────────────────────────────────────────────────
interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  children: string[];
  collapsed?: boolean;
}
interface MindData { nodes: Record<string, MindNode>; rootId: string; viewport?: { x: number; y: number; zoom: number }; }
interface CanvasMeta { id: string; workspaceId: string; title: string; type: string; createdAt: number; updatedAt: number; }
interface Vp { x: number; y: number; zoom: number; }

const uid = () => Math.random().toString(36).slice(2, 10);
const NODE_W = 136; const NODE_H = 38; const H_GAP = 72; const V_GAP = 10;
const PALETTE = ['var(--accent)','#7acfe8','#7ae8a0','var(--color-danger)','#e8c87a','#b07ae8','#e87abf'];

function layoutTree(nodes: Record<string, MindNode>, rootId: string): Record<string, MindNode> {
  const r = { ...nodes };
  function height(id: string): number {
    const n = r[id]; if (!n) return NODE_H;
    if (n.collapsed || !n.children.length) return NODE_H;
    return Math.max(NODE_H, n.children.reduce((s, c) => s + height(c) + V_GAP, -V_GAP));
  }
  function place(id: string, x: number, y: number) {
    const n = r[id]; if (!n) return;
    r[id] = { ...n, x, y };
    if (n.collapsed || !n.children.length) return;
    let cy = y - height(id) / 2;
    for (const c of n.children) { const ch = height(c); place(c, x + NODE_W + H_GAP, cy + ch / 2); cy += ch + V_GAP; }
  }
  place(rootId, 0, 0);
  return r;
}

// ── Editor ─────────────────────────────────────────────────
// ── 辅助：思维导图节点树 → Markdown 文本 ─────────────────
function mindToMarkdown(nodes: Record<string, any>, rootId: string, level = 1): string {
  const node = nodes[rootId];
  if (!node) return '';
  const prefix = level === 1 ? '# ' : level === 2 ? '## ' : level === 3 ? '### ' : '- ';
  let md = prefix + node.text + '\n';
  if (!node.collapsed) {
    for (const cid of (node.children || [])) {
      md += mindToMarkdown(nodes, cid, level + 1);
    }
  }
  return md;
}

// ── 辅助：节点树 → 幻灯片数组 ────────────────────────────
function mindToSlides(nodes: Record<string, any>, rootId: string, presId: string) {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  const slides: any[] = [];
  // 标题页
  const root = nodes[rootId];
  slides.push({ id: uid(), presentationId: presId, sortOrder: 0, layout: 'title', content: { title: root?.text || '演示', subtitle: '' }, notes: '', createdAt: now, updatedAt: now });
  // 每个一级子节点 → 一张幻灯片
  for (const cid of (root?.children || [])) {
    const child = nodes[cid];
    if (!child) continue;
    const bullets = (child.children || []).map((gcid: string) => '• ' + (nodes[gcid]?.text || '')).join('\n');
    slides.push({ id: uid(), presentationId: presId, sortOrder: slides.length, layout: 'content', content: { title: child.text, body: bullets }, notes: '', createdAt: now, updatedAt: now });
  }
  return slides;
}

const MindMapEditor: React.FC<{ canvasId: string; title: string; onBack: () => void }> = ({ canvasId, title, onBack }) => {
  const dispatch = useDispatch<AppDispatch>();
  const activeWorkspaceId = useSelector((s: any) => s.app.activeWorkspaceId);
  const [map, setMap] = useState<MindData>({ nodes: {}, rootId: 'root' });
  const [vp, setVp] = useState<Vp>({ x: 0, y: 0, zoom: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [showAiEdit, setShowAiEdit] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const isPan = useRef(false);

  useEffect(() => {
    ipc.invoke('canvases:get', { id: canvasId }).then((d: any) => {
      if (!d) return;
      try {
        const p: MindData = JSON.parse(d.data);
        const root = p.rootId || 'root';
        if (!p.nodes[root]) p.nodes[root] = { id: root, text: title || '中心主题', x: 0, y: 0, children: [], color: 'var(--accent)' };
        const laid = layoutTree(p.nodes, root);
        setMap({ nodes: laid, rootId: root });
        const svgEl = svgRef.current;
        const W = svgEl?.clientWidth || 800;
        const H = svgEl?.clientHeight || 500;
        setVp(p.viewport || { x: W / 2, y: H / 2, zoom: 1 });
      } catch {
        const root = 'root';
        setMap({ nodes: { [root]: { id: root, text: title || '中心主题', x: 0, y: 0, children: [], color: 'var(--accent)' } }, rootId: root });
        const svgEl = svgRef.current;
        setVp({ x: (svgEl?.clientWidth || 800) / 2, y: (svgEl?.clientHeight || 500) / 2, zoom: 1 });
      }
    }).catch(() => {});
  }, [canvasId]);

  const save = useCallback((m: MindData, v: Vp) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      ipc.invoke('canvases:save', { id: canvasId, data: JSON.stringify({ ...m, viewport: v }) }).catch(() => {});
    }, 600);
  }, [canvasId]);

  const update = (newNodes: Record<string, MindNode>) => {
    const laid = layoutTree(newNodes, map.rootId);
    const m = { ...map, nodes: laid };
    setMap(m); save(m, vp);
  };

  const addChild = (parentId: string) => {
    const parent = map.nodes[parentId]; if (!parent) return;
    const childId = uid();
    const color = parentId === map.rootId ? PALETTE[parent.children.length % PALETTE.length] : (parent.color || 'var(--accent)');
    const newNodes = { ...map.nodes, [parentId]: { ...parent, children: [...parent.children, childId], collapsed: false }, [childId]: { id: childId, text: '新想法', x: 0, y: 0, children: [], color } };
    update(newNodes);
    setSelectedId(childId);
    setTimeout(() => { setEditingId(childId); setEditVal('新想法'); }, 30);
  };

  const addSibling = (nodeId: string) => {
    const parentId = Object.keys(map.nodes).find(k => map.nodes[k].children.includes(nodeId));
    if (parentId) addChild(parentId);
  };

  const deleteNode = (nodeId: string) => {
    if (nodeId === map.rootId) return;
    const parentId = Object.keys(map.nodes).find(k => map.nodes[k].children.includes(nodeId));
    if (!parentId) return;
    const collect = (id: string): string[] => [id, ...((map.nodes[id]?.children || []).flatMap(collect))];
    const ids = collect(nodeId);
    const newNodes = { ...map.nodes };
    ids.forEach(id => delete newNodes[id]);
    newNodes[parentId] = { ...newNodes[parentId], children: newNodes[parentId].children.filter(c => c !== nodeId) };
    update(newNodes); setSelectedId(null);
  };

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const node = map.nodes[editingId]; if (!node) { setEditingId(null); return; }
    const newNodes = { ...map.nodes, [editingId]: { ...node, text: editVal.trim() || '...' } };
    update(newNodes); setEditingId(null);
  }, [editingId, editVal, map]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingId) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setEditingId(null); return; }
      if (!selectedId) return;
      if (e.key === 'Tab') { e.preventDefault(); addChild(selectedId); }
      if (e.key === 'Enter') { e.preventDefault(); addSibling(selectedId); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteNode(selectedId); }
      if (e.key === 'F2') { setEditingId(selectedId); setEditVal(map.nodes[selectedId]?.text || ''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingId, editVal, map, commitEdit]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.12 : 0.9;
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    setVp(v => { const nz = Math.min(Math.max(v.zoom * f, 0.15), 4); const nv = { x: mx - (mx - v.x) * (nz / v.zoom), y: my - (my - v.y) * (nz / v.zoom), zoom: nz }; save(map, nv); return nv; });
  };
  const onMouseDown = (e: React.MouseEvent) => { if (e.button === 1 || (e.button === 0 && e.altKey)) { isPan.current = true; panRef.current = { x: e.clientX, y: e.clientY }; } };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPan.current || !panRef.current) return;
    setVp(v => { const nv = { ...v, x: v.x + e.clientX - panRef.current!.x, y: v.y + e.clientY - panRef.current!.y }; panRef.current = { x: e.clientX, y: e.clientY }; save(map, nv); return nv; });
  };
  const onMouseUp = () => { isPan.current = false; panRef.current = null; };

  const resetView = () => {
    const svgEl = svgRef.current;
    const nv = { x: (svgEl?.clientWidth || 800) / 2, y: (svgEl?.clientHeight || 500) / 2, zoom: 1 };
    setVp(nv); save(map, nv);
  };

  const edges: React.ReactNode[] = [];
  Object.values(map.nodes).forEach(n => {
    if (n.collapsed) return;
    n.children.forEach(cid => {
      const c = map.nodes[cid]; if (!c) return;
      const px = n.x + NODE_W; const py = n.y + NODE_H / 2;
      const cx = c.x; const cy = c.y + NODE_H / 2;
      const mx2 = px + (cx - px) * 0.5;
      edges.push(<path key={`${n.id}-${cid}`} d={`M${px},${py} C${mx2},${py} ${mx2},${cy} ${cx},${cy}`} fill="none" stroke={c.color || 'var(--accent)'} strokeWidth={1.5} opacity={0.5} />);
    });
  });

  const nodeEls = Object.values(map.nodes).map(node => {
    const isRoot = node.id === map.rootId;
    const isSel = selectedId === node.id;
    const isEdit = editingId === node.id;
    return (
      <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ cursor: 'pointer' }}>
        <rect width={NODE_W} height={NODE_H} rx={isRoot ? 12 : 8}
          fill={isRoot ? (node.color || 'var(--accent)') : 'rgba(255,255,255,0.04)'}
          stroke={isSel ? 'rgba(100,180,255,0.8)' : (isRoot ? 'transparent' : (node.color || 'rgba(255,255,255,0.1)'))}
          strokeWidth={isSel ? 2 : 1}
          style={{ filter: isSel ? 'drop-shadow(0 0 8px rgba(100,180,255,0.35))' : isRoot ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' : 'none' }}
          onClick={() => { setSelectedId(node.id); if (editingId) commitEdit(); }}
          onDoubleClick={() => { setEditingId(node.id); setEditVal(node.text); }}
        />
        {isEdit ? (
          <foreignObject x={4} y={3} width={NODE_W - 8} height={NODE_H - 6}>
            <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setEditingId(null); }}
              style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', color: isRoot ? '#1a1408' : 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', textAlign: 'center', padding: 0 }} />
          </foreignObject>
        ) : (
          <text x={NODE_W / 2} y={NODE_H / 2 + 5} textAnchor="middle" fontSize={isRoot ? 14 : 13} fontWeight={isRoot ? 600 : 400}
            fill={isRoot ? '#1a1408' : 'var(--text-primary)'} fontFamily="inherit" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {node.text.length > 13 ? node.text.slice(0, 12) + '…' : node.text}
          </text>
        )}
        {/* Collapse dot */}
        {node.children.length > 0 && (
          <g onClick={e => { e.stopPropagation(); const n2 = map.nodes[node.id]; if (n2) { const nn = { ...map.nodes, [node.id]: { ...n2, collapsed: !n2.collapsed } }; update(nn); } }} style={{ cursor: 'pointer' }}>
            <circle cx={NODE_W + 1} cy={NODE_H / 2} r={7} fill={node.color || 'var(--accent)'} stroke="var(--bg-editor)" strokeWidth={1.5} />
            <text x={NODE_W + 1} y={NODE_H / 2 + 4.5} textAnchor="middle" fontSize={node.collapsed ? 10 : 11} fill={isRoot ? '#fff' : '#1a1408'} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {node.collapsed ? node.children.length : '−'}
            </text>
          </g>
        )}
        {/* Add child btn */}
        {isSel && !isEdit && (
          <g onClick={e => { e.stopPropagation(); addChild(node.id); }} style={{ cursor: 'pointer' }}>
            <circle cx={NODE_W + 22} cy={NODE_H / 2} r={10} fill={node.color || 'var(--accent)'} opacity={0.9} />
            <text x={NODE_W + 22} y={NODE_H / 2 + 5} textAnchor="middle" fontSize={17} fill="#1a1408" style={{ pointerEvents: 'none', userSelect: 'none' }}>+</text>
          </g>
        )}
      </g>
    );
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 48, borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, background: 'var(--bg-surface)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          返回
        </button>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', background: 'var(--bg-surface3)', padding: '3px 10px', borderRadius: 'var(--radius-md)' }}>Tab 添加子节点 · Enter 添加兄弟 · Del 删除 · 双击编辑</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{Math.round(vp.zoom * 100)}%</span>
        <button onClick={resetView} style={{ padding: '4px 10px', height: 28, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>重置视图</button>
        <button onClick={() => setShowAiEdit(v => !v)} style={{ padding: '4px 10px', height: 28, border: `0.5px solid ${showAiEdit ? 'rgba(var(--accent-rgb), 0.4)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', background: showAiEdit ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent', color: showAiEdit ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>✎ AI 编辑</button>
        {selectedId && selectedId !== map.rootId && (
          <button onClick={() => deleteNode(selectedId)} style={{ padding: '4px 10px', height: 28, border: '0.5px solid rgba(255,100,100,0.35)', borderRadius: 'var(--radius-md)', background: 'rgba(255,100,100,0.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>删除节点</button>
        )}
        {selectedId && (
          <button onClick={() => addChild(selectedId)} style={{ padding: '4px 12px', height: 28, border: 'none', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg,var(--accent),#9a7040)', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 500 }}>+ 子节点</button>
        )}
          <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
          {/* 转为文档 */}
          <button onClick={async () => {
            if (!activeWorkspaceId) return;
            const md = mindToMarkdown(map.nodes, map.rootId);
            const html = '<p>' + md.split('\n').map((line: string) => {
              if (line.startsWith('# ')) return `</p><h1>${line.slice(2)}</h1><p>`;
              if (line.startsWith('## ')) return `</p><h2>${line.slice(3)}</h2><p>`;
              if (line.startsWith('### ')) return `</p><h3>${line.slice(4)}</h3><p>`;
              if (line.startsWith('#### ')) return `</p><h4>${line.slice(5)}</h4><p>`;
              if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
              return line;
            }).join('') + '</p>';
            const docTitle = title + ' - 文档版';
            const doc = await (dispatch as any)(createDocument({ workspaceId: activeWorkspaceId, title: docTitle })).unwrap();
            if (doc?.id) {
              await (dispatch as any)(updateDocument({ id: doc.id, content: html }));
              dispatch(openTab({ documentId: doc.id, title: docTitle }));
              dispatch(setView('workbench'));
            }
          }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', height: 28, border: '0.5px solid rgba(var(--accent-rgb), 0.3)', borderRadius: 'var(--radius-md)', background: 'rgba(var(--accent-rgb), 0.08)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            转为文档
          </button>
          {/* 转为 PPT */}
          <button onClick={async () => {
            if (!activeWorkspaceId) return;
            const pres = await (dispatch as any)(createPresentation({ workspaceId: activeWorkspaceId, title: title + ' - PPT 版', theme: 'dark' })).unwrap();
            if (!pres?.id) return;
            const slides = mindToSlides(map.nodes, map.rootId, pres.id);
            await (dispatch as any)(saveAllSlides({ presentationId: pres.id, slides }));
            dispatch(setView('slides'));
          }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', height: 28, border: '0.5px solid rgba(100,180,255,0.3)', borderRadius: 'var(--radius-md)', background: 'rgba(100,180,255,0.08)', color: '#64b4ff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            转为 PPT
          </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-editor)', position: 'relative' }}>
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.07 }} width="100%" height="100%">
          <defs><pattern id="mmdot" width={28 * vp.zoom} height={28 * vp.zoom} patternUnits="userSpaceOnUse" x={vp.x % (28 * vp.zoom)} y={vp.y % (28 * vp.zoom)}><circle cx={14 * vp.zoom} cy={14 * vp.zoom} r="1" fill="rgba(var(--accent-rgb), 1)" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#mmdot)" />
        </svg>
        <svg ref={svgRef} width="100%" height="100%" style={{ userSelect: 'none', cursor: isPan.current ? 'grabbing' : 'default' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
          onClick={e => { if ((e.target as SVGElement).tagName === 'svg') { setSelectedId(null); if (editingId) commitEdit(); } }}>
          <g transform={`translate(${vp.x},${vp.y}) scale(${vp.zoom})`}>
            {edges}
            {nodeEls}
          </g>
        </svg>
        <div style={{ position: 'absolute', bottom: 14, right: 18, fontSize: 11, color: 'rgba(var(--accent-rgb), 0.3)', pointerEvents: 'none' }}>
          滚轮缩放 · Alt + 拖拽平移
        </div>
      </div>

      {showAiEdit && (
        <MindMapAiEditPanel
          nodes={map.nodes}
          rootId={map.rootId}
          onApply={(newNodes) => update(newNodes)}
          onClose={() => setShowAiEdit(false)}
        />
      )}
    </div>
  );
};

// ── List view ──────────────────────────────────────────────
export const MindMapView: React.FC = () => {
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
    const list = await ipc.invoke('canvases:list', { workspaceId: activeWorkspaceId, type: 'mindmap' }).catch((e: any) => { console.error('[MindMap] canvases:list failed:', e); return []; });
    setCanvases(list || []);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!activeWorkspaceId) return;
    const t = newTitle.trim() || '新思维导图';
    const res = await ipc.invoke('canvases:create', { workspaceId: activeWorkspaceId, title: t, type: 'mindmap' }).catch((e: any) => { console.error('[MindMap] canvases:create failed:', e); return null; });
    if (res) { setNewTitle(''); setShowNew(false); setActiveId(res.id); setActiveTitle(res.title); }
  };

  const del = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('确定删除这个思维导图？')) return;
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
      <MindMapEditor canvasId={activeId} title={activeTitle} onBack={() => { setActiveId(null); load(); }} />
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-editor)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '28px 36px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>思维导图</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{canvases.length} 个导图</div>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'linear-gradient(135deg,var(--accent),#9a7040)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建导图
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 36px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : canvases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 52, opacity: 0.12, marginBottom: 16 }}>🕸</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 6 }}>还没有思维导图</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>点击「新建导图」开始创作</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {canvases.map(c => (
              <div key={c.id} onClick={() => { setActiveId(c.id); setActiveTitle(c.title); }}
                style={{ cursor: 'pointer', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-surface2)', transition: 'all 0.15s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(var(--accent-rgb), 0.4)'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.transform = 'none'; el.style.boxShadow = 'none'; }}>
                {/* Preview area */}
                <div style={{ height: 110, background: 'var(--bg-editor)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {/* Static preview decoration */}
                  <svg width="180" height="90" viewBox="-20 -40 200 90" style={{ opacity: 0.6 }}>
                    <rect x="0" y="-8" width="80" height="26" rx="8" fill="var(--accent)" />
                    <text x="40" y="9" textAnchor="middle" fontSize="11" fill="#1a1408" fontFamily="inherit">{c.title.length > 8 ? c.title.slice(0, 7) + '…' : c.title}</text>
                    {[[-25, -28], [-25, 2], [-25, 32]].map(([dy], i) => (
                      <g key={i}>
                        <path d={`M80,2 C120,2 120,${dy! + 13} 140,${dy! + 13}`} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="1.5" opacity="0.5" />
                        <rect x="140" y={dy!} width="50" height="26" rx="6" fill="rgba(255,255,255,0.05)" stroke={PALETTE[i % PALETTE.length]} strokeWidth="1" />
                      </g>
                    ))}
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
          <div onClick={e => e.stopPropagation()} style={{ width: 360, background: 'var(--bg-surface)', border: '0.5px solid var(--border-md)', borderRadius: 'var(--radius-2xl)', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>新建思维导图</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 18 }}>输入主题，开始梳理你的想法</div>
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setShowNew(false); }}
              placeholder="思维导图主题（如：产品规划）"
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
