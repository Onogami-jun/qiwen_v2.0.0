import React from 'react';
import { useDispatch } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import { AppDispatch } from '../../store';
import { Slide, SlideContent, SlideLayout, Presentation, setAllSlidesLocal, saveAllSlides } from '../../store/slices/presentationsSlice';
import { AiEditShell } from '../shared/AiEditShell';
import { DiffStatusBadge, WordDiffText } from '../shared/DiffPrimitives';
import { useAiEditSession } from '../../hooks/useAiEditSession';

/**
 * AiEditChatPanel —— PPT 编辑器的对话式 AI 编辑面板。
 *
 * 跟文档编辑器那边（AIPanel.tsx 的"AI 编辑"tab）是同一套交互模型：
 * 描述要做的修改 → AI 生成结果 → 先看对比再确认应用，不直接动手改。
 * 但落地机制不同——文档是整段 markdown 文本 diff，PPT 这边幻灯片本身就是结构化数据
 * （layout + content 字段），所以走的是"按 id 比对每张幻灯片"的结构化 diff，
 * 而不是把整个 JSON 当文本比较，这样能清楚说出"第 3 张改了标题"而不是一坨面目全非的文本差异。
 *
 * 复用了 SlidesView.tsx 里 AiGeneratePanel 已经验证过的"JSON schema + 解析"模式，
 * 只是额外要求模型对保留下来的幻灯片原样带上 id，新增的不带 id——这是识别"改了/删了/加了"
 * 哪张幻灯片的关键，所以 prompt 里这条规则写得比较重。
 *
 * 会话状态机和外壳 UI 复用 useAiEditSession / AiEditShell（四个 AI 编辑面板共用）。
 */

const CONTENT_TEXT_FIELDS: (keyof SlideContent)[] = ['title', 'subtitle', 'body', 'leftBody', 'rightBody', 'sectionLabel'];
const FIELD_LABEL: Record<string, string> = {
  title: '标题', subtitle: '副标题', body: '正文', leftBody: '左栏', rightBody: '右栏', sectionLabel: '章节标签',
};

interface DiffEntry {
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  oldSlide?: Slide;
  newContent?: SlideContent;
  newLayout?: SlideLayout;
}

interface PendingData {
  entries: DiffEntry[];
  finalSlides: Slide[];
}

function summarize(content?: SlideContent): string {
  if (!content) return '(空)';
  return content.title || content.sectionLabel || (content.body || '').slice(0, 30) || '(无标题)';
}

const DiffCard: React.FC<{ entry: DiffEntry; index: number }> = ({ entry, index }) => {
  if (entry.status === 'unchanged') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
        <DiffStatusBadge status="unchanged" />
        幻灯片 {index + 1} · {summarize(entry.oldSlide?.content)}
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-surface2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: entry.status === 'modified' ? 8 : 0 }}>
        <DiffStatusBadge status={entry.status} />
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>幻灯片 {index + 1}</span>
      </div>

      {entry.status === 'added' && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{summarize(entry.newContent)}</div>
      )}
      {entry.status === 'removed' && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, textDecoration: 'line-through' }}>{summarize(entry.oldSlide?.content)}</div>
      )}
      {entry.status === 'modified' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {CONTENT_TEXT_FIELDS.map(field => {
            const oldVal = entry.oldSlide?.content?.[field] as string | undefined;
            const newVal = entry.newContent?.[field] as string | undefined;
            if ((oldVal || '') === (newVal || '')) return null;
            return (
              <div key={field} style={{ fontSize: 12, lineHeight: 1.7 }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5, marginRight: 4 }}>{FIELD_LABEL[field]}</span>
                <WordDiffText oldText={oldVal || ''} newText={newVal || ''} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AiEditChatPanel: React.FC<{ presentation: Presentation; onClose: () => void }> = ({ presentation, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();

  const session = useAiEditSession<PendingData>({
    buildPrompt: (text) => {
      const currentJson = presentation.slides.map(s => ({ id: s.id, layout: s.layout, content: s.content, notes: s.notes }));

      return `你是一个演示文稿编辑助手。下面会给你当前的完整幻灯片数据（JSON 数组）和用户希望做的修改。

请输出修改后的完整幻灯片 JSON 数组，规则：
- 对于保留下来的已有幻灯片（不管有没有修改内容），必须原样带上它原来的 "id" 字段，一个字都不要改
- 新增的幻灯片不要包含 "id" 字段
- 不需要修改的幻灯片，内容原样返回，不要无关改写
- 用户要求删除某张幻灯片时，直接不要把它包含在返回结果里
- layout 只能是: title, content, two-col, section, image, blank
- 只返回 JSON 数组本身，不要任何解释文字或代码块包裹符号

当前幻灯片数据：
${JSON.stringify(currentJson, null, 2)}

用户的修改要求：${text}`;
    },

    parseResponse: (result) => {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI 返回格式异常，请重试');
      const raw = JSON.parse(jsonMatch[0]) as any[];

      const now = Date.now();
      const oldById = new Map(presentation.slides.map(s => [s.id, s]));
      const usedOldIds = new Set<string>();
      const entries: DiffEntry[] = [];
      const finalSlides: Slide[] = [];

      raw.forEach((item, i) => {
        const oldSlide = item.id ? oldById.get(item.id) : undefined;
        if (oldSlide) {
          usedOldIds.add(oldSlide.id);
          const changed = JSON.stringify(oldSlide.content) !== JSON.stringify(item.content || {}) || oldSlide.layout !== item.layout;
          entries.push({ status: changed ? 'modified' : 'unchanged', oldSlide, newContent: item.content, newLayout: item.layout });
          finalSlides.push({
            ...oldSlide,
            layout: item.layout || oldSlide.layout,
            content: item.content || oldSlide.content,
            notes: item.notes ?? oldSlide.notes,
            sortOrder: i,
            updatedAt: changed ? now : oldSlide.updatedAt,
          });
        } else {
          entries.push({ status: 'added', newContent: item.content, newLayout: item.layout });
          finalSlides.push({
            id: uuidv4(),
            presentationId: presentation.id,
            sortOrder: i,
            layout: item.layout || 'content',
            content: item.content || {},
            notes: item.notes || '',
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      presentation.slides.forEach(s => {
        if (!usedOldIds.has(s.id)) entries.push({ status: 'removed', oldSlide: s });
      });

      if (finalSlides.length === 0) throw new Error('修改结果不能清空所有幻灯片，请换个说法重试');

      return { entries, finalSlides };
    },

    onApply: (pending) => {
      dispatch(setAllSlidesLocal(pending.finalSlides));
      dispatch(saveAllSlides({ presentationId: presentation.id, slides: pending.finalSlides }));
    },
  });

  return (
    <AiEditShell
      variant="floating"
      onClose={onClose}
      instruction={session.instruction}
      onInstructionChange={session.setInstruction}
      onGenerate={session.generate}
      onStop={session.stop}
      loading={session.loading}
      error={session.error}
      emptyLine1="描述你想对这份演示文稿做的修改"
      emptyLine2='比如"把第3张的标题改得更简洁"或"加一张总结页"'
      hasPendingDiff={session.hasPendingDiff}
      pendingInstruction={session.pendingInstruction}
      onApply={session.apply}
      onDiscard={session.discard}
      history={session.history}
    >
      {session.pendingData?.entries.map((entry, i) => <DiffCard key={i} entry={entry} index={i} />)}
    </AiEditShell>
  );
};

export default AiEditChatPanel;
