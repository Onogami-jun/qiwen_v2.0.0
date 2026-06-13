import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { ipc } from '../../utils/ipc';
import { openTab, setView } from '../../store/slices/appSlice';

interface GraphNode { id: string; title: string; wordCount: number; x: number; y: number; vx: number; vy: number; }
interface GraphEdge { source: string; target: string; }

// ── Force-directed layout (simple) ────────────────────────
function runForce(nodes: GraphNode[], edges: GraphEdge[], iterations = 80) {
  const nodeMap: Record<string, GraphNode> = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 0.3 * (1 - iter / iterations);

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]; const b = nodes[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (120 * 120) / (dist * dist) * alpha;
        const fx = (dx / dist) * force; const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }

    // Attraction along edges
    edges.forEach(e => {
      const a = nodeMap[e.source]; const b = nodeMap[e.target];
      if (!a || !b) return;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 160;
      const force = (dist - target) * 0.08 * alpha;
      const fx = (dx / dist) * force; const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    });

    // Center gravity
    nodes.forEach(n => {
      n.vx -= n.x * 0.02 * alpha;
      n.vy -= n.y * 0.02 * alpha;
    });

    // Integrate
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      n.vx *= 0.6; n.vy *= 0.6;
    });
  }
  return nodes;
}

export const DocumentGraphView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const docs = useSelector((s: RootState) => s.documents.tree) as any[];

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [vp, setVp] = useState({ x: 0, y: 0, zoom: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const isPan = useRef(false);

  const build = useCallback(async () => {
    if (!activeWorkspaceId || docs.length === 0) { setLoading(false); return; }
    setLoading(true);

    const allDocs = docs.filter((d: any) => !d.isFolder);
    // Sample max 60 nodes to keep graph readable
    const sample = allDocs.slice(0, 60);

    // Fetch outlinks for each doc in parallel (batch of 10)
    const allEdges: GraphEdge[] = [];
    for (let i = 0; i < sample.length; i += 10) {
      const batch = sample.slice(i, i + 10);
      await Promise.all(batch.map(async (doc: any) => {
        const links = await ipc.invoke('documents:outlinks', { documentId: doc.id, workspaceId: activeWorkspaceId }).catch(() => []);
        (links || []).forEach((link: any) => {
          if (sample.find((d: any) => d.id === link.id)) {
            allEdges.push({ source: doc.id, target: link.id });
          }
        });
      }));
    }

    // Init node positions randomly around center
    const W = svgRef.current?.clientWidth || 800;
    const H = svgRef.current?.clientHeight || 600;
    const initNodes: GraphNode[] = sample.map((doc: any) => ({
      id: doc.id,
      title: doc.title || '无标题',
      wordCount: doc.wordCount || 0,
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.5) * 300,
      vx: 0, vy: 0,
    }));

    const laid = runForce(initNodes, allEdges, 120);
    setNodes(laid);
    setEdges(allEdges);
    setVp({ x: W / 2, y: H / 2, zoom: 1 });
    setLoading(false);
  }, [activeWorkspaceId, docs]);

  useEffect(() => { build(); }, [build]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.12 : 0.9;
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left; const my = e.clientY - r.top;
    setVp(v => { const nz = Math.min(Math.max(v.zoom * f, 0.2), 4); return { x: mx - (mx - v.x) * (nz / v.zoom), y: my - (my - v.y) * (nz / v.zoom), zoom: nz }; });
  };
  const onDown = (e: React.MouseEvent) => { isPan.current = true; panRef.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => {
    if (!isPan.current || !panRef.current) return;
    setVp(v => { const nv = { ...v, x: v.x + e.clientX - panRef.current!.x, y: v.y + e.clientY - panRef.current!.y }; panRef.current = { x: e.clientX, y: e.clientY }; return nv; });
  };
  const onUp = () => { isPan.current = false; panRef.current = null; };

  const nodeMap: Record<string, GraphNode> = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  // Node size by word count
  const maxWC = Math.max(...nodes.map(n => n.wordCount), 1);
  const nodeR = (n: GraphNode) => 8 + (n.wordCount / maxWC) * 18;

  // Degree (connection count) for color intensity
  const degree: Record<string, number> = {};
  edges.forEach(e => { degree[e.source] = (degree[e.source] || 0) + 1; degree[e.target] = (degree[e.target] || 0) + 1; });
  const maxDeg = Math.max(...Object.values(degree), 1);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-editor)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 28px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg-surface)' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>文档关系图谱</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{nodes.length} 个节点 · {edges.length} 条引用连接 · 双击节点打开文档</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={build} style={{ padding: '5px 12px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            重新计算
          </button>
          <button onClick={() => { const W = svgRef.current?.clientWidth || 800; const H = svgRef.current?.clientHeight || 600; setVp({ x: W/2, y: H/2, zoom: 1 }); }} style={{ padding: '5px 12px', borderRadius: 7, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            重置视图
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ fontSize: 13 }}>正在分析文档关联...</div>
        </div>
      ) : nodes.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, opacity: 0.15, marginBottom: 16 }}>🕸</div>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 6 }}>暂无文档关系</div>
          <div style={{ fontSize: 13 }}>在文档中使用 [[文档名]] 建立链接后，这里会显示关系图谱</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Legend */}
          <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-tertiary)', border: '0.5px solid var(--border)' }}>
            <div style={{ marginBottom: 4 }}>节点大小 = 字数</div>
            <div>颜色深度 = 被引用次数</div>
          </div>

          {/* Hovered node info */}
          {hovered && nodeMap[hovered] && (
            <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 10, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 14px', border: '0.5px solid rgba(200,169,110,0.3)', maxWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeMap[hovered].title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                {nodeMap[hovered].wordCount.toLocaleString()} 字 · {degree[hovered] || 0} 条连接
              </div>
            </div>
          )}

          <svg ref={svgRef} width="100%" height="100%" style={{ cursor: isPan.current ? 'grabbing' : 'grab', background: 'var(--bg-editor)' }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}>
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgba(200,169,110,0.3)" />
              </marker>
            </defs>
            <g transform={`translate(${vp.x},${vp.y}) scale(${vp.zoom})`}>
              {/* Edges */}
              {edges.map((e, i) => {
                const a = nodeMap[e.source]; const b = nodeMap[e.target];
                if (!a || !b) return null;
                const isHighlighted = hovered === e.source || hovered === e.target;
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={isHighlighted ? 'rgba(200,169,110,0.6)' : 'rgba(200,169,110,0.15)'}
                    strokeWidth={isHighlighted ? 1.5 : 0.8}
                    markerEnd="url(#arrow)" />
                );
              })}
              {/* Nodes */}
              {nodes.map(n => {
                const r = nodeR(n);
                const deg = degree[n.id] || 0;
                const opacity = 0.4 + (deg / maxDeg) * 0.6;
                const isHov = hovered === n.id;
                const isConnected = hovered ? (edges.some(e => e.source === hovered && e.target === n.id) || edges.some(e => e.target === hovered && e.source === n.id)) : false;
                const dim = hovered && !isHov && !isConnected;
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: 'pointer', opacity: dim ? 0.2 : 1, transition: 'opacity 0.2s' }}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    onDoubleClick={() => { dispatch(openTab({ documentId: n.id, title: n.title })); dispatch(setView('workbench')); }}>
                    <circle r={isHov ? r + 3 : r}
                      fill={`rgba(200,169,110,${opacity * 0.25})`}
                      stroke={isHov ? '#c8a96e' : `rgba(200,169,110,${opacity * 0.7})`}
                      strokeWidth={isHov ? 2 : 1}
                      style={{ transition: 'r 0.15s, stroke 0.15s' }} />
                    {(r > 12 || isHov) && (
                      <text textAnchor="middle" dy={r + 13} fontSize={isHov ? 11 : 10}
                        fill={isHov ? 'var(--text-primary)' : 'var(--text-secondary)'}
                        fontFamily="inherit" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {n.title.length > 10 ? n.title.slice(0, 9) + '…' : n.title}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
};
