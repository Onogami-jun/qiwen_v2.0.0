import React, { useMemo } from 'react';
import { AiEditShell } from '../shared/AiEditShell';
import { DiffStatusBadge, WordDiffText } from '../shared/DiffPrimitives';
import { useAiEditSession } from '../../hooks/useAiEditSession';

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
 *
 * 会话状态机（loading/error/diff预览/历史记录/生成-应用-放弃-停止）由 useAiEditSession
 * 统一管理，外壳 UI 由 AiEditShell 统一渲染——这两块原本是四个 AI 编辑面板各自复制的代码。
 */

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

interface PendingData {
  entries: DiffEntry[];
  finalElements: El[];
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
  const session = useAiEditSession<PendingData>({
    buildPrompt: (text) => {
      const editableEls = elements.filter(e => e.type !== 'path') as EditableEl[];

      // 给 AI 一个大致的"当前画面范围"，新增元素时别全堆在 (0,0)
      const xs = editableEls.flatMap((e: any) => [e.x, e.x1, e.x2, e.cx].filter((v) => typeof v === 'number'));
      const ys = editableEls.flatMap((e: any) => [e.y, e.y1, e.y2, e.cy].filter((v) => typeof v === 'number'));
      const bounds = xs.length
        ? `当前内容大致分布在 x: ${Math.min(...xs)}~${Math.max(...xs)}, y: ${Math.min(...ys)}~${Math.max(...ys)}（像素坐标），新增内容请放在这个范围附近，避免完全重叠。`
        : '画面目前是空的，新增内容可以放在 x:100~700, y:100~500 这个范围内。';

      const currentJson = editableEls.map(e => {
        const { id, type, color } = e;
        if (type === 'text') return { id, type, x: e.x, y: e.y, text: e.text, fs: e.fs, color };
        if (type === 'rect') return { id, type, x: e.x, y: e.y, w: e.w, h: e.h, color, fill: e.fill };
        if (type === 'ellipse') return { id, type, cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, color, fill: e.fill };
        return { id, type, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, color };
      });

      return `你是一个白板编辑助手。下面会给你白板上当前的文字和图形元素（JSON 数组，不包含手绘笔迹）和用户希望做的修改。

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
${JSON.stringify(currentJson, null, 2)}

用户的修改要求：${text}`;
    },

    parseResponse: (result) => {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI 返回格式异常，请重试');
      const raw = JSON.parse(jsonMatch[0]) as any[];

      const editableEls = elements.filter(e => e.type !== 'path') as EditableEl[];
      const pathEls = elements.filter(e => e.type === 'path') as PathEl[];

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
      return { entries, finalElements };
    },

    onApply: (pending) => {
      onApply(pending.finalElements);
    },
  });

  const visibleEntries = useMemo(
    () => session.pendingData?.entries.filter(e => e.status !== 'unchanged') ?? [],
    [session.pendingData]
  );

  return (
    <AiEditShell
      variant="floating"
      hint="只对文字和图形（矩形/椭圆/箭头）生效，手绘笔迹不受影响"
      onClose={onClose}
      instruction={session.instruction}
      onInstructionChange={session.setInstruction}
      onGenerate={session.generate}
      onStop={session.stop}
      loading={session.loading}
      error={session.error}
      emptyLine1="描述你想在白板上做的修改"
      emptyLine2='比如"用三个方框和箭头画一个登录流程"'
      hasPendingDiff={session.hasPendingDiff}
      pendingInstruction={session.pendingInstruction}
      onApply={session.apply}
      onDiscard={session.discard}
      history={session.history}
    >
      {visibleEntries.map((entry, i) => (
        <div
          key={i}
          style={{
            padding: '8px 10px',
            background: 'var(--bg-surface2)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: entry.status === 'modified' && entry.oldEl?.type === 'text' ? 6 : 0,
            }}
          >
            <DiffStatusBadge status={entry.status} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {entry.status === 'removed' ? summarize(entry.oldEl) : summarize(entry.newEl)}
            </span>
          </div>
          {entry.status === 'modified' && entry.oldEl?.type === 'text' && entry.newEl?.type === 'text' && entry.oldEl.text !== entry.newEl.text && (
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              <WordDiffText oldText={entry.oldEl.text || ''} newText={entry.newEl.text || ''} />
            </div>
          )}
        </div>
      ))}
      {session.pendingData?.entries.every(e => e.status === 'unchanged') && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>这次没有实质性改动</div>
      )}
    </AiEditShell>
  );
};

export default WhiteboardAiEditPanel;
