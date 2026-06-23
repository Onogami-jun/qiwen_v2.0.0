import React, { useState, useCallback, useRef } from 'react';
import { diffWords } from 'diff';

/**
 * MindMapAiEditPanel —— 思维导图的对话式 AI 编辑面板。
 *
 * 跟 PPT 那边的 AiEditChatPanel 是同一套交互模型（先看 diff 再确认应用），
 * 但思维导图的结构是一棵树，不是一个扁平数组，所以 diff 和 schema 都是递归的：
 * 把 { nodes: Record<id, Node>, rootId } 转成嵌套 JSON 喂给 AI，
 * AI 返回的也是嵌套 JSON（保留 id 的节点=保留，没 id 的=新增，原来存在但这次没出现的=删除），
 * 解析时按 id 递归比对，重建出新的 nodes Record。
 *
 * 新节点不需要算坐标——MindMapView.tsx 里的 layoutTree() 本来就会在每次渲染前
 * 根据树结构重新计算所有节点位置，这里随便给个占位坐标即可，跟现有的 addChild() 一样。
 */

const BUILTIN_KEY = 'ark-0f0fd51c-1395-45bd-9df0-29a195257d96-5ab55';
const BUILTIN_MODEL = 'doubao-seed-2-0-pro-260215';
const getApiKey = () => { try { return localStorage.getItem('qiwen_doubao_apikey') || BUILTIN_KEY; } catch { return BUILTIN_KEY; } };
const getModel = () => { try { return localStorage.getItem('qiwen_doubao_model') || BUILTIN_MODEL; } catch { return BUILTIN_MODEL; } };

interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  children: string[];
  collapsed?: boolean;
}

interface NestedNode {
  id?: string;
  text: string;
  children?: NestedNode[];
}

interface DiffRow {
  depth: number;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  oldText?: string;
  newText?: string;
}

function toNested(nodes: Record<string, MindNode>, id: string): NestedNode {
  const n = nodes[id];
  return {
    id: n.id,
    text: n.text,
    children: (n.children || []).map(cid => toNested(nodes, cid)),
  };
}

export const MindMapAiEditPanel: React.FC<{
  nodes: Record<string, MindNode>;
  rootId: string;
  onApply: (newNodes: Record<string, MindNode>) => void;
  onClose: () => void;
}> = ({ nodes, rootId, onApply, onClose }) => {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDiff, setPendingDiff] = useState<{ instruction: string; rows: DiffRow[]; finalNodes: Record<string, MindNode> } | null>(null);
  const [history, setHistory] = useState<{ instruction: string; status: 'applied' | 'discarded' }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const uidCounter = useRef(0);
  const newId = () => `ai_${Date.now()}_${uidCounter.current++}`;

  const handleGenerate = useCallback(async () => {
    const text = instruction.trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setPendingDiff(null);

    const currentTree = toNested(nodes, rootId);

    const systemPrompt = `你是一个思维导图编辑助手。下面会给你当前的完整思维导图结构（嵌套 JSON，每个节点有 id、text、children）和用户希望做的修改。

请输出修改后的完整思维导图结构（同样的嵌套 JSON 格式），规则：
- 保留下来的已有节点（不管文字有没有改），必须原样带上它原来的 "id" 字段
- 新增的节点不要包含 "id" 字段
- 不需要修改的节点，text 原样返回
- 用户要求删除某个节点时，直接不要把它（及其所有子节点）包含在返回结果里
- 根节点必须保留（可以改文字，但结构上必须是返回 JSON 的最顶层）
- 只返回 JSON 本身，不要任何解释文字或代码块包裹符号

当前思维导图结构：
${JSON.stringify(currentTree, null, 2)}`;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const api = (window as any).electronAPI;
      if (!api?.invoke) throw new Error('请在桌面应用中使用 AI 功能');

      const result: string = await api.invoke('ai:chat-stream', {
        messages: [{ role: 'user', content: `${systemPrompt}\n\n用户的修改要求：${text}` }],
        apiKey: getApiKey(),
        model: getModel(),
      });

      if (ctrl.signal.aborted) return;
      if (!result) throw new Error('AI 返回了空响应，请重试');

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 返回格式异常，请重试');
      const newTree = JSON.parse(jsonMatch[0]) as NestedNode;

      const rows: DiffRow[] = [];
      const finalNodes: Record<string, MindNode> = {};
      const usedOldIds = new Set<string>();

      // 递归比对：根节点强制沿用原 rootId，避免根节点被意外当成"新节点"导致整棵树丢失关联
      const walk = (newNode: NestedNode, depth: number, forcedId?: string) => {
        const oldNode = forcedId ? nodes[forcedId] : (newNode.id ? nodes[newNode.id] : undefined);
        const id = forcedId || (oldNode ? oldNode.id : newId());

        if (oldNode) usedOldIds.add(oldNode.id);

        const childIds: string[] = (newNode.children || []).map(child => walk(child, depth + 1));

        const changed = !oldNode || oldNode.text !== newNode.text;
        rows.push({
          depth,
          status: !oldNode ? 'added' : changed ? 'modified' : 'unchanged',
          oldText: oldNode?.text,
          newText: newNode.text,
        });

        finalNodes[id] = {
          id,
          text: newNode.text,
          x: oldNode?.x ?? 0,
          y: oldNode?.y ?? 0,
          color: oldNode?.color,
          children: childIds,
          collapsed: oldNode?.collapsed,
        };
        return id;
      };

      walk(newTree, 0, rootId);

      // 原树里没被走到的节点 = 被删除（按深度找一下原来的层级用于展示，找不到就归到顶层）
      Object.values(nodes).forEach(n => {
        if (!usedOldIds.has(n.id)) {
          rows.push({ depth: 0, status: 'removed', oldText: n.text });
        }
      });

      setPendingDiff({ instruction: text, rows, finalNodes });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'AI 生成修改失败，请重试');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [instruction, loading, nodes, rootId]);

  const handleApply = useCallback(() => {
    if (!pendingDiff) return;
    onApply(pendingDiff.finalNodes);
    setHistory(h => [...h, { instruction: pendingDiff.instruction, status: 'applied' }]);
    setPendingDiff(null);
    setInstruction('');
  }, [pendingDiff, onApply]);

  const handleDiscard = useCallback(() => {
    if (!pendingDiff) return;
    setHistory(h => [...h, { instruction: pendingDiff.instruction, status: 'discarded' }]);
    setPendingDiff(null);
  }, [pendingDiff]);

  const stop = useCallback(() => { abortRef.current?.abort(); setLoading(false); }, []);

  const badge = (status: DiffRow['status']) => ({
    added: ['新增', 'var(--color-success)', 'rgba(var(--color-success-rgb), 0.15)'],
    removed: ['删除', 'var(--color-danger)', 'rgba(var(--color-danger-rgb), 0.15)'],
    modified: ['已修改', 'var(--accent)', 'rgba(var(--accent-rgb), 0.15)'],
    unchanged: ['不变', 'var(--text-tertiary)', 'rgba(255,255,255,0.05)'],
  }[status]);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 200,
      background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border-md)',
      boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 12px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>✎ AI 编辑</div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {!pendingDiff && !loading && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 12.5 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✎</div>
            <div>描述你想对这张思维导图做的修改</div>
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>比如"给XX节点下面加3个子节点"或"把右边那枝删掉"</div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin .7s linear infinite' }} />
            正在生成修改…
            <button onClick={stop} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(var(--color-danger-rgb), 0.4)', background: 'rgba(var(--color-danger-rgb), 0.08)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' }}>停止</button>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12.5, color: 'var(--color-danger)', padding: '8px 12px', background: 'rgba(var(--color-danger-rgb), 0.08)', borderRadius: 8, marginBottom: 10 }}>{error}</div>
        )}

        {pendingDiff && !loading && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginBottom: 8 }}>
              「{pendingDiff.instruction}」的修改预览
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-surface2)', border: '0.5px solid var(--border)', borderRadius: 9, marginBottom: 10 }}>
              {pendingDiff.rows.map((row, i) => {
                const b = badge(row.status);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', paddingLeft: row.depth * 14, fontSize: 12 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: b[2], color: b[1], flexShrink: 0, marginTop: 1 }}>{b[0]}</span>
                    {row.status === 'modified' ? (
                      <span style={{ lineHeight: 1.6 }}>
                        {diffWords(row.oldText || '', row.newText || '').map((part, j) => {
                          if (part.added) return <span key={j} style={{ background: 'rgba(var(--color-success-rgb), 0.18)', color: 'var(--color-success)' }}>{part.value}</span>;
                          if (part.removed) return <span key={j} style={{ background: 'rgba(var(--color-danger-rgb), 0.14)', color: 'var(--color-danger)', textDecoration: 'line-through' }}>{part.value}</span>;
                          return <span key={j}>{part.value}</span>;
                        })}
                      </span>
                    ) : (
                      <span style={{ color: row.status === 'removed' ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: row.status === 'removed' ? 'line-through' : 'none' }}>
                        {row.status === 'removed' ? row.oldText : row.newText}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleApply} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,var(--accent),#9a7040)', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit' }}>
                ✓ 应用修改
              </button>
              <button onClick={handleGenerate} style={{ padding: '8px 12px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
                重新生成
              </button>
              <button onClick={handleDiscard} style={{ padding: '8px 12px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
                放弃
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>本次会话的修改记录</div>
            {history.slice().reverse().map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 0', color: 'var(--text-secondary)' }}>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                  background: h.status === 'applied' ? 'rgba(var(--color-success-rgb), 0.15)' : 'rgba(255,255,255,0.06)',
                  color: h.status === 'applied' ? 'var(--color-success)' : 'var(--text-tertiary)',
                }}>
                  {h.status === 'applied' ? '已应用' : '已放弃'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.instruction}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 12px 10px', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
            disabled={loading}
            placeholder="描述要做的修改... (Enter 发送)"
            rows={2}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 9, background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5 }}
          />
          <button onClick={handleGenerate} disabled={!instruction.trim() || loading}
            style={{ width: 34, height: 34, borderRadius: 9, border: 'none', flexShrink: 0, background: instruction.trim() && !loading ? 'linear-gradient(135deg,var(--accent),#9a7040)' : 'var(--bg-surface3)', color: instruction.trim() && !loading ? '#fff' : 'var(--text-tertiary)', cursor: instruction.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--dur-fast) var(--ease-smooth)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MindMapAiEditPanel;
