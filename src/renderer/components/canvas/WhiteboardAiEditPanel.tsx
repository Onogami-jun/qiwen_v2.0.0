import React, { useState, useCallback, useRef } from 'react';
import { diffWords } from 'diff';

/**
 * WhiteboardAiEditPanel —— 白板的对话式 AI 编辑面板。
 *
 * 跟 PPT/思维导图那两个不一样的地方：白板里的"path"元素是手绘笔迹（一串坐标点），
 * 没有语义内容，AI 没法、也不应该去"理解"或"修改"一条手画的线——所以这个面板
 * 只把 text / rect / ellipse / arrow 这几种有结构、有意义的元素喂给 AI，
 * 手绘笔迹永远原样保留，完全不出现在 AI 看到的上下文里，也不会被 AI 的结果覆盖掉。
 *
 * 适合的场景是"用方框和箭头画一个流程图""加一个标题文字"这类有结构的内容，
 * 不是用来让 AI 帮你画画的。
 */

const BUILTIN_KEY = 'ark-0f0fd51c-1395-45bd-9df0-29a195257d96-5ab55';
const BUILTIN_MODEL = 'doubao-seed-2-0-pro-260215';
const getApiKey = () => { try { return localStorage.getItem('qiwen_doubao_apikey') || BUILTIN_KEY; } catch { return BUILTIN_KEY; } };
const getModel = () => { try { return localStorage.getItem('qiwen_doubao_model') || BUILTIN_MODEL; } catch { return BUILTIN_MODEL; } };

interface Pt { x: number; y: number; }
interface BaseEl { id: string; color: string; sw: number; }
interface PathEl extends BaseEl { type: 'path'; pts: Pt[]; }
interface RectEl extends BaseEl { type: 'rect'; x: number; y: number; w: number; h: number; fill: string; }
interface EllEl extends BaseEl { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; }
interface ArrowEl extends BaseEl { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; }
interface TextEl extends BaseEl { type: 'text'; x: number; y: number; text: string; fs: number; }
type El = PathEl | RectEl | EllEl | ArrowEl | TextEl;
type EditableEl = RectEl | EllEl | ArrowEl | TextEl;

const uid = () => Math.random().toString(36).slice(2, 10);

interface DiffEntry {
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  oldEl?: EditableEl;
  newEl?: any;
}

function summarize(el?: any): string {
  if (!el) return '(空)';
  if (el.type === 'text') return el.text || '(空文字)';
  if (el.type === 'rect') return `矩形 ${Math.round(el.w || 0)}×${Math.round(el.h || 0)}`;
  if (el.type === 'ellipse') return `椭圆`;
  if (el.type === 'arrow') return `箭头`;
  return el.type || '(未知)';
}

export const WhiteboardAiEditPanel: React.FC<{
  elements: El[];
  onApply: (newElements: El[]) => void;
  onClose: () => void;
}> = ({ elements, onApply, onClose }) => {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDiff, setPendingDiff] = useState<{ instruction: string; entries: DiffEntry[]; finalElements: El[] } | null>(null);
  const [history, setHistory] = useState<{ instruction: string; status: 'applied' | 'discarded' }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    const text = instruction.trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setPendingDiff(null);

    const pathEls = elements.filter(e => e.type === 'path') as PathEl[];
    const editableEls = elements.filter(e => e.type !== 'path') as EditableEl[];

    // 给 AI 一个大致的"当前画面范围"，新增元素时别全堆在 (0,0)
    const xs = editableEls.flatMap((e: any) => [e.x, e.x1, e.x2, e.cx].filter((v) => typeof v === 'number'));
    const ys = editableEls.flatMap((e: any) => [e.y, e.y1, e.y2, e.cy].filter((v) => typeof v === 'number'));
    const bounds = xs.length ? `当前内容大致分布在 x: ${Math.min(...xs)}~${Math.max(...xs)}, y: ${Math.min(...ys)}~${Math.max(...ys)}（像素坐标），新增内容请放在这个范围附近，避免完全重叠。` : '画面目前是空的，新增内容可以放在 x:100~700, y:100~500 这个范围内。';

    const currentJson = editableEls.map(e => {
      const { id, type, color } = e;
      if (type === 'text') return { id, type, x: e.x, y: e.y, text: e.text, fs: e.fs, color };
      if (type === 'rect') return { id, type, x: e.x, y: e.y, w: e.w, h: e.h, color, fill: e.fill };
      if (type === 'ellipse') return { id, type, cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, color, fill: e.fill };
      return { id, type, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, color };
    });

    const systemPrompt = `你是一个白板编辑助手。下面会给你白板上当前的文字和图形元素（JSON 数组，不包含手绘笔迹）和用户希望做的修改。

请输出修改后的完整元素 JSON 数组，规则：
- 保留下来的已有元素（不管有没有修改），必须原样带上它原来的 "id" 字段
- 新增的元素不要包含 "id" 字段
- 用户要求删除某个元素时，直接不要把它包含在返回结果里
- type 只能是: text, rect, ellipse, arrow
- text 元素字段: x, y, text, fs(字号,默认16), color
- rect 元素字段: x, y, w, h, color, fill(填充色,留空或"transparent"表示不填充)
- ellipse 元素字段: cx, cy, rx, ry, color, fill
- arrow 元素字段: x1, y1, x2, y2, color（箭头从起点指向终点）
- color 用十六进制颜色，没有特别要求就用 "#e8e5de"（浅色，适配深色背景）
- ${bounds}
- 只返回 JSON 数组本身，不要任何解释文字或代码块包裹符号

当前元素：
${JSON.stringify(currentJson, null, 2)}`;

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

      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI 返回格式异常，请重试');
      const raw = JSON.parse(jsonMatch[0]) as any[];

      const oldById = new Map(editableEls.map(e => [e.id, e]));
      const usedOldIds = new Set<string>();
      const entries: DiffEntry[] = [];
      const finalEditable: EditableEl[] = [];

      raw.forEach(item => {
        const oldEl = item.id ? oldById.get(item.id) : undefined;
        const sw = oldEl?.sw ?? 2;
        const color = item.color || oldEl?.color || '#e8e5de';

        let built: EditableEl;
        if (item.type === 'text') built = { id: oldEl?.id || uid(), type: 'text', x: item.x ?? 100, y: item.y ?? 100, text: item.text ?? '', fs: item.fs ?? 16, color, sw } as TextEl;
        else if (item.type === 'rect') built = { id: oldEl?.id || uid(), type: 'rect', x: item.x ?? 100, y: item.y ?? 100, w: item.w ?? 160, h: item.h ?? 80, color, sw, fill: item.fill || 'transparent' } as RectEl;
        else if (item.type === 'ellipse') built = { id: oldEl?.id || uid(), type: 'ellipse', cx: item.cx ?? 200, cy: item.cy ?? 200, rx: item.rx ?? 80, ry: item.ry ?? 50, color, sw, fill: item.fill || 'transparent' } as EllEl;
        else built = { id: oldEl?.id || uid(), type: 'arrow', x1: item.x1 ?? 100, y1: item.y1 ?? 100, x2: item.x2 ?? 300, y2: item.y2 ?? 100, color, sw } as ArrowEl;

        if (oldEl) {
          usedOldIds.add(oldEl.id);
          const changed = JSON.stringify(oldEl) !== JSON.stringify(built);
          entries.push({ status: changed ? 'modified' : 'unchanged', oldEl, newEl: built });
        } else {
          entries.push({ status: 'added', newEl: built });
        }
        finalEditable.push(built);
      });

      editableEls.forEach(e => { if (!usedOldIds.has(e.id)) entries.push({ status: 'removed', oldEl: e }); });

      const finalElements: El[] = [...pathEls, ...finalEditable];
      setPendingDiff({ instruction: text, entries, finalElements });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'AI 生成修改失败，请重试');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [instruction, loading, elements]);

  const handleApply = useCallback(() => {
    if (!pendingDiff) return;
    onApply(pendingDiff.finalElements);
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

  const badge = (status: DiffEntry['status']) => ({
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

      <div style={{ padding: '8px 12px 0', fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, lineHeight: 1.6 }}>
        只对文字和图形（矩形/椭圆/箭头）生效，手绘笔迹不受影响
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {!pendingDiff && !loading && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 12.5 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✎</div>
            <div>描述你想在白板上做的修改</div>
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>比如"用三个方框和箭头画一个登录流程"</div>
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
            {pendingDiff.entries.filter(e => e.status !== 'unchanged').map((entry, i) => {
              const b = badge(entry.status);
              return (
                <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-surface2)', border: '0.5px solid var(--border)', borderRadius: 9, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: entry.status === 'modified' && entry.oldEl?.type === 'text' ? 6 : 0 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: b[2], color: b[1], flexShrink: 0 }}>{b[0]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {entry.status === 'removed' ? summarize(entry.oldEl) : summarize(entry.newEl)}
                    </span>
                  </div>
                  {entry.status === 'modified' && entry.oldEl?.type === 'text' && entry.newEl?.type === 'text' && entry.oldEl.text !== entry.newEl.text && (
                    <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                      {diffWords(entry.oldEl.text || '', entry.newEl.text || '').map((part, j) => {
                        if (part.added) return <span key={j} style={{ background: 'rgba(var(--color-success-rgb), 0.18)', color: 'var(--color-success)' }}>{part.value}</span>;
                        if (part.removed) return <span key={j} style={{ background: 'rgba(var(--color-danger-rgb), 0.14)', color: 'var(--color-danger)', textDecoration: 'line-through' }}>{part.value}</span>;
                        return <span key={j}>{part.value}</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {pendingDiff.entries.every(e => e.status === 'unchanged') && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>这次没有实质性改动</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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

export default WhiteboardAiEditPanel;
