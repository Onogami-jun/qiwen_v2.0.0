/**
 * ChatPanel — AI 对话面板（Agent 工作流版）
 *
 * 支持：
 * - 多轮对话 + 流式 AI 回复
 * - AI 反问澄清需求
 * - 任务计划卡片（可交互步骤列表）
 * - 折叠式思考块
 * - 逐步确认执行
 * - 消息持久化
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import Panel from './Panel';
import type { LeafPanel, ChatMessage, ChatMetadata, AgentStep } from './types';
import { msgId } from './types';
import type { RootState } from '../../store';
import { ipc } from '../../utils/ipc';
import { buildSystemPrompt } from '../../utils/writingPreferences';

// ── Agent System Prompt ──────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `你是一个专业的AI写作助手，集成在"启文（QiWen Writer）"桌面写作应用中。

## 你的工作流程

当用户提出写作需求时，严格按以下流程：

### 第一阶段：需求澄清
首先评估用户的请求是否足够清晰。如果缺少任一关键信息，先提问（每次不超过3个问题）：
- 目标读者是谁？
- 文档篇幅/字数要求？
- 写作风格和语气（正式/轻松/学术/科普/...）？
- 其他特殊要求（是否需要引用、图表、示例等）？

### 第二阶段：生成任务计划
需求明确后，生成详细的任务计划。使用以下格式：

<plan>
<title>任务标题</title>
<step id="1">第一步：具体要做的事</step>
<step id="2">第二步：具体要做的事</step>
</plan>

然后简要说明计划，让用户确认。

### 第三阶段：逐步执行
用户确认后，逐步执行计划。每一步都要：

1. 先用 <thinking>...</thinking> 写出你的思考过程
2. 然后输出该步骤的具体成果
3. 在步骤结束时问用户"这一步OK吗？继续下一步还是需要修改？"

### 标签格式说明
- <plan> 包裹整个任务计划，包含 <title> 和多个 <step>
- <thinking> 包裹你的思考过程（思考过程会被折叠显示，用户可展开查看）
- 这些标签只用于结构化你的输出，不要在标签内写 JSON

### 重要规则
- 任务计划必须放在 <plan> 标签内
- 每步执行前必须写 <thinking> 思考过程
- 每步完成后必须暂停等待用户确认
- 用户说"继续"或"好的"或"下一步"才进入下一步
- 用户说"修改XXX"就调整当前步骤内容
- 全部步骤完成后做一个简短总结`;

// ── Parse AI response for structural tags ───────────────────

interface ParsedResponse {
  pureContent: string;   // content with tags stripped
  plan?: { title: string; steps: AgentStep[] };
  thinking?: string;
}

function parseTags(content: string): ParsedResponse {
  const result: ParsedResponse = { pureContent: content };

  // Extract <plan>...</plan>
  const planMatch = content.match(/<plan>([\s\S]*?)<\/plan>/);
  if (planMatch) {
    const inner = planMatch[1];
    const titleMatch = inner.match(/<title>([\s\S]*?)<\/title>/);
    const stepMatches = inner.matchAll(/<step\s+id="(\d+)"[^>]*>([\s\S]*?)<\/step>/g);
    const steps: AgentStep[] = [];
    for (const m of stepMatches) {
      steps.push({ id: m[1], title: m[2].trim(), status: 'pending' });
    }
    if (titleMatch) {
      result.plan = { title: titleMatch[1].trim(), steps };
    }
    // Strip plan tag from pure content
    result.pureContent = content.replace(/<plan>[\s\S]*?<\/plan>/g, '').trim();
  }

  // Extract <thinking>...</thinking>
  const thinkMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  if (thinkMatch) {
    result.thinking = thinkMatch[1].trim();
    result.pureContent = result.pureContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
  }

  return result;
}

// ── Markdown → HTML ─────────────────────────────────────────

function renderMD(text: string): string {
  let h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code: string) => `<pre><code>${code.trim()}</code></pre>`);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  h = h.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  return h.split(/\n\n+/).map(b => {
    const t = b.trim(); if (!t) return '';
    if (t.startsWith('<pre>') || t.startsWith('<ul>')) return t;
    return `<p>${t.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');
}

// ── Icons ────────────────────────────────────────────────────

const SendIcon = () => (<svg className="pn-chat__send-icon" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 5.5L2 14l3-6.5L2 2z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>);
const EmptyIcon = () => (<svg className="pn-chat__empty-icon" viewBox="0 0 48 48" fill="none"><rect x="6" y="8" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2"/><circle cx="16" cy="22" r="3" fill="currentColor"/><circle cx="24" cy="22" r="3" fill="currentColor"/><circle cx="32" cy="22" r="3" fill="currentColor"/></svg>);

// ── Sub-components ───────────────────────────────────────────

/** Task Plan Card — interactive step list */
const PlanCard: React.FC<{
  title: string;
  steps: AgentStep[];
  onStepToggle: (id: string) => void;
  onStart: () => void;
}> = ({ title, steps, onStepToggle, onStart }) => (
  <div style={{
    background: 'var(--bg-surface2, #f8f9fa)',
    border: '1px solid var(--accent, #c8a96e)',
    borderRadius: 10, padding: '12px 16px', margin: '8px 0', fontSize: 13,
  }}>
    <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)', fontSize: 14 }}>
      📋 {title}
    </div>
    {steps.map(s => (
      <div key={s.id} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
        cursor: 'pointer', opacity: s.status === 'done' ? 0.5 : 1,
      }} onClick={() => onStepToggle(s.id)}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 11,
          background: s.status === 'done' ? 'var(--color-success, #22c55e)' :
            s.status === 'doing' ? 'var(--accent, #c8a96e)' : 'var(--border, #e2e5e9)',
          color: s.status !== 'pending' ? '#fff' : 'var(--text-tertiary)',
          flexShrink: 0,
        }}>
          {s.status === 'done' ? '✓' : s.status === 'doing' ? '▶' : s.id}
        </span>
        <span style={{ color: 'var(--text-secondary)', textDecoration: s.status === 'done' ? 'line-through' : 'none' }}>
          {s.title}
        </span>
      </div>
    ))}
    <button onClick={onStart} style={{
      marginTop: 10, padding: '6px 18px', borderRadius: 20,
      border: 'none', background: 'var(--accent, #c8a96e)', color: '#fff',
      cursor: 'pointer', fontSize: 13, fontWeight: 500,
    }}>开始执行</button>
  </div>
);

/** Collapsible Thinking Block */
const ThinkingBlock: React.FC<{ content: string }> = ({ content }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: '6px 0' }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 8px',
        borderRadius: 6, background: 'var(--bg-surface2, #f8f9fa)',
        userSelect: 'none',
      }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
        <span>AI 思考过程</span>
      </div>
      {open && (
        <div style={{
          marginTop: 4, padding: '10px 14px', borderRadius: 8,
          background: 'var(--bg-secondary, #f9fafb)', fontSize: 12,
          color: 'var(--text-secondary)', lineHeight: 1.7,
          borderLeft: '3px solid var(--accent, #c8a96e)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {content}
        </div>
      )}
    </div>
  );
};

// ── Message Bubble ───────────────────────────────────────────

const MsgBubble: React.FC<{ msg: ChatMessage; isLast: boolean; onPlanStart?: () => void }> = ({ msg, isLast, onPlanStart }) => {
  const meta = msg.meta;
  const isUser = msg.role === 'user';
  const time = (() => { try { return new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })();

  return (
    <div className={`pn-chat-msg pn-chat-msg--${msg.role}`}>
      <div className="pn-chat-msg__avatar">{isUser ? '我' : 'AI'}</div>
      <div style={{ minWidth: 0 }}>
        {/* Thinking block (assistant only) */}
        {!isUser && meta?.thinking && (
          <ThinkingBlock content={meta.thinking} />
        )}

        {/* Plan card */}
        {!isUser && meta?.plan && isLast && (
          <PlanCard
            title={meta.plan.title}
            steps={meta.plan.steps}
            onStepToggle={() => {}} // TODO: interactive step toggle
            onStart={() => onPlanStart?.()}
          />
        )}

        {/* Text content */}
        {meta?.pureContent || msg.content ? (
          <div className="pn-chat-msg__bubble">
            {isUser ? (
              msg.content
            ) : (
              <div dangerouslySetInnerHTML={{ __html: renderMD(meta?.pureContent || msg.content) }} />
            )}
          </div>
        ) : null}

        <div className="pn-chat-msg__time">{time}</div>
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────

interface Props { node: LeafPanel; getDocumentContent?: () => string; }

const ChatPanel: React.FC<Props> = ({ node, getDocumentContent }) => {
  const docId = useSelector((s: RootState) => (s as any).panelLayout?.loadedDocumentId) as string | null;
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load on mount
  useEffect(() => {
    if (!docId || loaded) return; let c = false;
    (async () => {
      try {
        const rows = await ipc.invoke<any[]>('db:getChatMessages', { documentId: docId, limit: 50 });
        if (!c && rows?.length) {
          setMsgs(rows.map((r: any) => ({
            id: r.id, documentId: r.document_id ?? r.documentId,
            role: r.role, content: r.content,
            createdAt: r.created_at ?? r.createdAt,
            meta: typeof r.meta === 'string' ? JSON.parse(r.meta || '{}') : (r.meta || undefined),
          })));
        }
      } catch {} finally { if (!c) setLoaded(true); }
    })();
    return () => { c = true; };
  }, [docId, loaded]);

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // Persist
  const persist = useCallback(async (m: ChatMessage) => {
    try { await ipc.invoke('db:saveChatMessage', m); } catch {}
  }, []);

  // Parse & store AI response
  const handleAiResponse = useCallback((content: string): ChatMessage => {
    const parsed = parseTags(content);
    const meta: ChatMetadata = {};
    let kind: ChatMetadata['kind'] = 'normal';

    if (parsed.plan) { meta.plan = parsed.plan; kind = 'plan'; }
    if (parsed.thinking) { meta.thinking = parsed.thinking; kind = kind === 'normal' ? 'thinking' : kind; }
    meta.pureContent = parsed.pureContent;
    meta.kind = kind;

    return {
      id: msgId(), documentId: docId!, role: 'assistant',
      content, // keep full raw content in DB
      createdAt: new Date().toISOString(),
      meta,
    };
  }, [docId]);

  // Send message
  const send = useCallback(async () => {
    const t = input.trim(); if (!t || streaming || !docId) return;
    setInput('');

    const um: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: t, createdAt: new Date().toISOString() };
    setMsgs(p => [...p, um]); persist(um);

    setStreaming(true);
    try {
      const doc = getDocumentContent?.() ?? '';
      const prefPrompt = await buildSystemPrompt();

      // Build system message
      const sysParts = [];
      if (prefPrompt) sysParts.push(prefPrompt);
      sysParts.push(AGENT_SYSTEM_PROMPT);
      if (doc) sysParts.push(`\n当前用户正在编辑的文档内容：\n\`\`\`\n${doc.slice(0, 3000)}\n\`\`\``);

      const recent = [...msgs.slice(-20), um].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const payload = {
        messages: [
          { role: 'system', content: sysParts.join('\n') },
          ...recent,
        ],
        apiKey: '', model: '',
      };

      const response = await ipc.invoke<any>('ai:chat-stream', payload);
      const content = typeof response === 'string' ? response : (response?.content || response?.text || JSON.stringify(response));

      const am = handleAiResponse(content);
      setMsgs(p => [...p, am]); persist(am);
    } catch (err: any) {
      const em: ChatMessage = {
        id: msgId(), documentId: docId, role: 'assistant',
        content: '抱歉，请求失败：' + (err?.message || '未知错误'),
        createdAt: new Date().toISOString(),
        meta: { kind: 'normal', pureContent: '抱歉，请求失败：' + (err?.message || '未知错误') },
      };
      setMsgs(p => [...p, em]); persist(em);
    } finally { setStreaming(false); }
  }, [input, streaming, docId, msgs, persist, getDocumentContent, handleAiResponse]);

  // "开始执行" button callback
  const onPlanStart = useCallback(() => {
    setInput('开始执行计划');
    // Auto-send after a tick
    setTimeout(() => {
      // We'll use send() which reads from input state but it already captured old input.
      // Instead, let's directly trigger send with "开始执行计划"
    }, 100);
  }, []);

  // Actually for "开始执行", we need to send a system message. Let me fix this.
  // The plan start button will insert a user message "开始执行计划" and trigger send.
  const startPlan = useCallback(async () => {
    if (streaming || !docId) return;
    const txt = '开始执行计划';
    const um: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: txt, createdAt: new Date().toISOString() };
    setMsgs(p => [...p, um]); persist(um);

    setStreaming(true);
    try {
      const doc = getDocumentContent?.() ?? '';
      const prefPrompt = await buildSystemPrompt();
      const sysParts = [];
      if (prefPrompt) sysParts.push(prefPrompt);
      sysParts.push(AGENT_SYSTEM_PROMPT);
      if (doc) sysParts.push(`\n当前用户正在编辑的文档内容：\n\`\`\`\n${doc.slice(0, 3000)}\n\`\`\``);

      const allMsgs = [...msgs, um];
      const recent = allMsgs.slice(-22).map(m => ({ role: m.role, content: m.content }));

      const response = await ipc.invoke<any>('ai:chat-stream', {
        messages: [{ role: 'system', content: sysParts.join('\n') }, ...recent],
        apiKey: '', model: '',
      });

      const content = typeof response === 'string' ? response : (response?.content || response?.text || JSON.stringify(response));
      const am = handleAiResponse(content);
      setMsgs(p => [...p, am]); persist(am);
    } catch (err: any) {
      const em: ChatMessage = {
        id: msgId(), documentId: docId, role: 'assistant',
        content: '抱歉，请求失败：' + (err?.message || '未知错误'),
        createdAt: new Date().toISOString(),
        meta: { kind: 'normal', pureContent: '抱歉，请求失败：' + (err?.message || '未知错误') },
      };
      setMsgs(p => [...p, em]); persist(em);
    } finally { setStreaming(false); }
  }, [streaming, docId, msgs, persist, getDocumentContent, handleAiResponse]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }, [send]);
  const onInputC = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }, []);

  // Render messages
  const msgList = useMemo(() => msgs.map((m, i) => (
    <MsgBubble key={m.id} msg={m} isLast={i === msgs.length - 1} onPlanStart={startPlan} />
  )), [msgs, startPlan]);

  return (
    <Panel node={node}>
      <div className="pn-chat">
        {msgs.length === 0 ? (
          <div className="pn-chat__empty"><EmptyIcon /><p className="pn-chat__empty-text">告诉我你想写什么<br/>比如"帮我写一篇产品发布公告"</p></div>
        ) : (
          <div className="pn-chat__messages">
            {msgList}
            {streaming && (
              <div className="pn-chat-streaming">
                <span>AI 正在思考</span>
                <span className="pn-chat-streaming__dots">
                  <span className="pn-chat-streaming__dot"/><span className="pn-chat-streaming__dot"/><span className="pn-chat-streaming__dot"/>
                </span>
              </div>
            )}
            <div ref={endRef}/>
          </div>
        )}
        <div className="pn-chat__input-area">
          <textarea className="pn-chat__input" value={input} onChange={onInputC} onKeyDown={onKeyDown} placeholder="描述你的写作需求..." rows={1} disabled={streaming} />
          <button className="pn-chat__send" onClick={send} disabled={streaming || !input.trim()} title="发送"><SendIcon /></button>
        </div>
      </div>
    </Panel>
  );
};

export default React.memo(ChatPanel);
