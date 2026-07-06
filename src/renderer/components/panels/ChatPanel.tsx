/**
 * ChatPanel — AI Agent v4 (live thinking + Claude animations)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import Panel from './Panel';
import type { LeafPanel, ChatMessage, AgentStep } from './types';
import { msgId } from './types';
import type { RootState } from '../../store';
import { ipc } from '../../utils/ipc';
import { buildSystemPrompt } from '../../utils/writingPreferences';
import { parseActions, stripActions, getSafety, type ParsedAction } from './actionParser';
import * as Bridge from './editorBridge';
import ActionConfirm from './ActionConfirm';
import AgentControlBar, { type ControlBarState } from './AgentControlBar';

const AGENT_PROMPT = [
  '你是启文（QiWen Writer）的内置 AI Agent。你可以直接操作编辑器来完成写作任务。',
  '',
  '## 工作流程',
  '1. 需求不清晰时先提问（最多3个）→ 生成任务计划',
  '2. <thinking>思考</thinking> → 使用 action 标签操作编辑器 → 汇报结果',
  '3. 每步完成后等待用户确认（除非用户开启自动模式）',
  '',
  '## 可用 Action',
  '- <action type="append" title="节标题">内容</action> — 末尾追加（自动）',
  '- <action type="insert">内容</action> — 光标插入（自动）',
  '- <action type="replace" target="原文片段">新内容</action> — 替换（确认）',
  '- <action type="rewrite" target="段落关键词">改写内容</action> — 改写（确认）',
  '- <action type="delete" target="原文片段"></action> — 删除（确认）',
  '',
  '## 任务计划格式',
  '<plan><title>标题</title><step id="1">步骤</step><step id="2">步骤</step></plan>',
  '',
  '## 重要',
  '- 安全操作（append/insert）直接执行',
  '- 修改操作展示 diff 等用户确认',
  '- 用户说"自动模式"→ 全自主执行直到叫停',
  '- 保持 Markdown 格式',
].join('\n');

function parseTags(content: string): { pure: string; plan: { title: string; steps: AgentStep[] } | null; thinking: string | null; actions: ParsedAction[] } {
  const pm = content.match(/<plan>([\s\S]*?)<\/plan>/);
  let plan: { title: string; steps: AgentStep[] } | null = null;
  if (pm) {
    const inner = pm[1], tm = inner.match(/<title>([\s\S]*?)<\/title>/);
    const steps: AgentStep[] = [];
    for (const m of inner.matchAll(/<step\s+id="(\d+)"[^>]*>([\s\S]*?)<\/step>/g)) steps.push({ id: m[1], title: m[2].trim(), status: 'pending' });
    if (tm) plan = { title: tm[1].trim(), steps };
  }
  const th = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const actions = parseActions(content);
  let pure = content.replace(/<plan>[\s\S]*?<\/plan>/g, '').replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  pure = stripActions(pure).trim();
  return { pure, plan, thinking: th ? th[1].trim() : null, actions };
}

function renderMD(text: string): string {
  let h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_0: string, _1: string, code: string) => '<pre><code>' + code.trim() + '</code></pre>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  h = h.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>').replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  return h.split(/\n\n+/).map((b: string) => { const t = b.trim(); if (!t) return ''; if (t.startsWith('<pre>') || t.startsWith('<ul>')) return t; return '<p>' + t.replace(/\n/g, '<br/>') + '</p>'; }).join('\n');
}

const SendIcon: React.FC = () => React.createElement('svg', { className: 'pn-chat__send-icon', viewBox: '0 0 16 16', fill: 'none' }, React.createElement('path', { d: 'M2 2l12 5.5L2 14l3-6.5L2 2z', fill: 'currentColor', stroke: 'currentColor', strokeWidth: '1', strokeLinejoin: 'round' }));
const EmptyIcon: React.FC = () => React.createElement('svg', { className: 'pn-chat__empty-icon', viewBox: '0 0 48 48', fill: 'none' }, React.createElement('rect', { x: '6', y: '8', width: '36', height: '28', rx: '4', stroke: 'currentColor', strokeWidth: '2' }), React.createElement('circle', { cx: '16', cy: '22', r: '3', fill: 'currentColor' }), React.createElement('circle', { cx: '24', cy: '22', r: '3', fill: 'currentColor' }), React.createElement('circle', { cx: '32', cy: '22', r: '3', fill: 'currentColor' }));

const ThinkingBlock: React.FC<{ content: string }> = ({ content }) => {
  const [open, setOpen] = useState(true);
  const [pos, setPos] = useState(0);
  const done = pos >= content.length;
  const prev = useRef(content);

  useEffect(() => { if (prev.current !== content) { setPos(0); setOpen(true); prev.current = content; } }, [content]);
  useEffect(() => { if (done || !open) return; const t = setTimeout(() => setPos((p: number) => Math.min(p + 5, content.length)), 10); return () => clearTimeout(t); }, [pos, content.length, done, open]);
  useEffect(() => { if (!done || !open) return; const t = setTimeout(() => setOpen(false), 4000); return () => clearTimeout(t); }, [done, open]);

  const text = content.slice(0, pos);

  return React.createElement('div', { style: { margin: '4px 0' } },
    React.createElement('div', { onClick: () => setOpen(!open), className: 'pn-thinking__toggle' },
      React.createElement('span', { className: 'pn-thinking__arrow', style: { transform: open ? 'rotate(90deg)' : 'none' } }, '▶'),
      '思考过程',
      !done ? React.createElement('span', { className: 'pn-thinking__spinner' }) : null,
    ),
    open ? React.createElement('div', { className: 'pn-thinking' },
      React.createElement('div', { className: 'pn-thinking__text' },
        text,
        !done ? React.createElement('span', { className: 'pn-thinking__cursor' }, '|') : null,
      ),
    ) : null,
  );
};

const PlanCard: React.FC<{ title: string; steps: AgentStep[]; onStart: () => void }> = ({ title, steps, onStart }) =>
  React.createElement('div', { className: 'pn-plan-card' },
    React.createElement('div', { className: 'pn-plan-card__title' }, '📋 ' + title),
    steps.map((s: AgentStep) =>
      React.createElement('div', { key: s.id, className: 'pn-plan-card__step', style: { opacity: s.status === 'done' ? 0.5 : 1 } },
        React.createElement('span', { className: 'pn-plan-card__dot', style: {
          background: s.status === 'done' ? 'var(--color-success,#22c55e)' : s.status === 'doing' ? 'var(--accent,#c8a96e)' : 'var(--border,#e2e5e9)',
          color: s.status !== 'pending' ? '#fff' : 'var(--text-tertiary)',
        } }, s.status === 'done' ? '✓' : s.status === 'doing' ? '▶' : s.id),
        React.createElement('span', { style: { color: 'var(--text-secondary)', textDecoration: s.status === 'done' ? 'line-through' : 'none' } }, s.title),
      )
    ),
    React.createElement('button', { className: 'pn-plan-card__btn', onClick: onStart }, '开始执行'),
  );

interface BubbleProps { msg: ChatMessage; isLast: boolean; onPlanStart: () => void; onAccept: (a: ParsedAction) => void; onReject: (a: ParsedAction) => void; pendingId: string | null; }

const MsgBubble: React.FC<BubbleProps> = ({ msg, isLast, onPlanStart, onAccept, onReject, pendingId }) => {
  const isU = msg.role === 'user';
  const meta: any = msg.meta;
  const time = (() => { try { return new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); } catch (_e) { return ''; } })();
  const actions: any[] = useMemo(() => meta?.actions || [], [meta]);
  return React.createElement('div', { className: 'pn-chat-msg pn-chat-msg--' + msg.role },
    React.createElement('div', { className: 'pn-chat-msg__avatar' }, isU ? '我' : 'AI'),
    React.createElement('div', { style: { minWidth: 0 } },
      !isU && meta?.thinking ? React.createElement(ThinkingBlock, { content: meta.thinking }) : null,
      !isU && meta?.plan && isLast ? React.createElement(PlanCard, { title: meta.plan.title, steps: meta.plan.steps, onStart: onPlanStart }) : null,
      !isU && actions.filter((a: any) => getSafety(a.type) === 'confirm').map((a: any, i: number) =>
        React.createElement(ActionConfirm, { key: a.type + '-' + i, action: a, pending: pendingId != null, onAccept: () => onAccept(a), onReject: () => onReject(a) })
      ),
      !isU && meta?.actionResults ? (meta.actionResults as string[]).map((r: string, i: number) =>
        React.createElement('div', { key: i, className: 'pn-action-ok' },
          React.createElement('span', null, '✓'),
          React.createElement('span', null, r),
        )
      ) : null,
      meta?.pureContent || msg.content ? React.createElement('div', { className: 'pn-chat-msg__bubble' },
        isU ? msg.content : React.createElement('div', { dangerouslySetInnerHTML: { __html: renderMD(meta?.pureContent || msg.content) } })
      ) : null,
      React.createElement('div', { className: 'pn-chat-msg__time' }, time),
    )
  );
};

interface Props { node: LeafPanel; getDocumentContent?: () => string; }

const ChatPanel: React.FC<Props> = ({ node, getDocumentContent }) => {
  const docId = useSelector((s: RootState) => (s as any).panelLayout?.loadedDocumentId) as string | null;
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [cbState, setCbState] = useState<ControlBarState>({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
  const endRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef(autoMode); autoRef.current = autoMode;
  const msgsRef = useRef(msgs); msgsRef.current = msgs;

  useEffect(() => {
    Bridge.registerEditor('document', {
      getText: () => getDocumentContent?.() || '',
      getHTML: () => getDocumentContent?.() || '',
      insert: (c: string) => { const ed = (window as any).__activeEditor; if (ed) { try { ed.chain().focus().insertContent(c).run(); return true; } catch { return false; } } return false; },
      replaceAll: (h: string) => { const ed = (window as any).__activeEditor; if (ed) { try { ed.chain().focus().selectAll().insertContent(h).run(); return true; } catch { return false; } } return false; },
      findAndReplace: (s: string, r: string) => { const ed = (window as any).__activeEditor; if (!ed) return false; try { const t: string = ed.getText() || ''; if (t.includes(s)) { const nh: string = (ed.getHTML() || '').split(s).join(r); ed.chain().focus().selectAll().insertContent(nh).run(); return true; } } catch { /* ok */ } try { ed.chain().focus().insertContent(r).run(); return true; } catch { return false; } },
      getSelection: () => { try { return ''; } catch { return ''; } },
    });
    return () => Bridge.unregisterEditor('document');
  }, [getDocumentContent]);

  useEffect(() => { if (!docId || loaded) return; let c = false; (async () => { try { const rows = await ipc.invoke<any[]>('db:getChatMessages', { documentId: docId, limit: 100 }); if (!c && rows?.length) setMsgs(rows.map((r: any) => ({ id: r.id, documentId: r.document_id ?? r.documentId, role: r.role, content: r.content, createdAt: r.created_at ?? r.createdAt, meta: typeof r.meta === 'string' ? JSON.parse(r.meta || '{}') : (r.meta || undefined) }))); } catch { /* ok */ } finally { if (!c) setLoaded(true); } })(); return () => { c = true; }; }, [docId, loaded]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  const persist = useCallback(async (m: ChatMessage) => { try { await ipc.invoke('db:saveChatMessage', m); } catch { /* ok */ } }, []);

  const callAi = useCallback(async (toSend: ChatMessage[]): Promise<string> => {
    setStreaming(true); setCbState((p: ControlBarState) => ({ ...p, status: 'thinking', visible: true }));
    try {
      const doc = getDocumentContent?.() ?? '';
      const pref = await buildSystemPrompt();
      const sysParts = [pref, AGENT_PROMPT];
      if (doc) sysParts.push('\n' + '当前文档：\n' + doc.slice(0, 3000));
      if (autoRef.current) sysParts.push('\n' + '用户已开启自动模式，自主执行无需确认。');
      const recent = toSend.slice(-25).map((m: ChatMessage) => ({ role: m.role, content: m.content }));
      const resp = await ipc.invoke<any>('ai:chat-stream', { messages: [{ role: 'system', content: sysParts.filter(Boolean).join('\n') }, ...recent], apiKey: '', model: '' });
      const content = typeof resp === 'string' ? resp : (resp?.content || resp?.text || JSON.stringify(resp));
      setCbState((p: ControlBarState) => ({ ...p, status: 'executing' }));
      return content;
    } finally { setStreaming(false); }
  }, [getDocumentContent]);

  const execActions = useCallback((actions: ParsedAction[]): string[] => {
    const results: string[] = [];
    for (const a of actions) {
      if (getSafety(a.type) !== 'safe' && !autoRef.current) continue;
      let r: Bridge.ActionResult = { success: false, message: '' };
      switch (a.type) { case 'append': r = Bridge.actionAppend(a.payload.title || '', a.content); break; case 'insert': r = Bridge.actionInsert(a.content); break; case 'replace': r = Bridge.actionReplace(a.payload.target || '', a.content); break; case 'rewrite': r = Bridge.actionRewrite(a.payload.target || '', a.content); break; case 'delete': r = Bridge.actionDelete(a.payload.target || ''); break; }
      if (r.message) results.push(r.success ? r.message : 'FAIL:' + r.message);
      setCbState((p: ControlBarState) => ({ ...p, status: 'executing', currentStep: r.message }));
    }
    Bridge.flashEditorChange(); Bridge.scrollToChange();
    return results;
  }, []);

  const processResponse = useCallback((raw: string): ChatMessage => {
    const { pure, plan, thinking, actions } = parseTags(raw);
    const meta: any = { pureContent: pure, kind: plan ? 'plan' : thinking ? 'thinking' : 'normal' };
    if (plan) meta.plan = plan;
    if (thinking) meta.thinking = thinking;
    const confirm = actions.filter((a: ParsedAction) => getSafety(a.type) === 'confirm' && !autoRef.current);
    if (confirm.length) meta.actions = confirm;
    const executable = actions.filter((a: ParsedAction) => getSafety(a.type) === 'safe' || (autoRef.current && getSafety(a.type) === 'confirm'));
    if (executable.length) { const results = execActions(executable); if (results.length) meta.actionResults = results; setCbState((p: ControlBarState) => ({ ...p, completedSteps: p.completedSteps + executable.length })); }
    return { id: msgId(), documentId: docId!, role: 'assistant', content: raw, createdAt: new Date().toISOString(), meta };
  }, [docId, execActions]);

  const send = useCallback(async () => {
    const t = input.trim(); if (!t || streaming || !docId) return; setInput('');
    if (t.includes('自动模式') || t.toLowerCase().includes('auto mode')) setAutoMode(true);
    if (t.includes('停止自动') || t.includes('取消自动') || t.includes('手动模式')) { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
    const um: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: t, createdAt: new Date().toISOString() };
    const cur = [...msgsRef.current, um]; setMsgs(cur); persist(um);
    try {
      const content = await callAi(cur);
      const am = processResponse(content);
      setMsgs((p: ChatMessage[]) => [...p, am]); persist(am);
      if (autoRef.current && (am.meta as any)?.plan) setTimeout(() => autoContinue(am), 1000);
      else if (!autoRef.current) setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
    } catch (err: any) {
      setMsgs((p: ChatMessage[]) => [...p, { id: msgId(), documentId: docId, role: 'assistant', content: 'FAIL:' + (err?.message || 'unknown'), createdAt: new Date().toISOString(), meta: { kind: 'normal', pureContent: 'FAIL:' + (err?.message || 'unknown') } }]);
      setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
    }
  }, [input, streaming, docId, persist, callAi, processResponse]);

  const autoContinue = useCallback(async (lastMsg: ChatMessage) => {
    if (!autoRef.current || !docId) return;
    const cm: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: '继续下一步（自动模式）', createdAt: new Date().toISOString() };
    const cur = [...msgsRef.current, cm]; setMsgs(cur); persist(cm);
    try {
      const content = await callAi(cur);
      const am = processResponse(content);
      setMsgs((p: ChatMessage[]) => [...p, am]); persist(am);
      if (autoRef.current) {
        const allDone = !(am.meta as any)?.plan || ((am.meta as any).plan.steps as AgentStep[])?.every((s: AgentStep) => s.status === 'done');
        if (allDone) { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
        else setTimeout(() => autoContinue(am), 1500);
      }
    } catch { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
  }, [docId, callAi, processResponse, persist]);

  const startPlan = useCallback(async () => {
    if (streaming || !docId) return;
    const cm: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: '开始执行计划', createdAt: new Date().toISOString() };
    const cur = [...msgsRef.current, cm]; setMsgs(cur); persist(cm);
    const plan = ((msgsRef.current[msgsRef.current.length - 1]?.meta) as any)?.plan;
    if (plan) setCbState({ visible: true, status: 'executing', currentStep: plan.steps[0]?.title || '', totalSteps: plan.steps.length, completedSteps: 0 });
    try { const content = await callAi(cur); const am = processResponse(content); setMsgs((p: ChatMessage[]) => [...p, am]); persist(am); if (!autoRef.current) setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); } catch { /* ok */ }
  }, [streaming, docId, persist, callAi, processResponse]);

  const acceptAction = useCallback(async (action: ParsedAction) => {
    setPendingActionId(action.type + '-' + Date.now());
    let r: Bridge.ActionResult = { success: false, message: '' };
    switch (action.type) { case 'replace': r = Bridge.actionReplace(action.payload.target || '', action.content); break; case 'rewrite': r = Bridge.actionRewrite(action.payload.target || '', action.content); break; case 'delete': r = Bridge.actionDelete(action.payload.target || ''); break; }
    setPendingActionId(null);
    const fb: ChatMessage = { id: msgId(), documentId: docId!, role: 'user', content: '操作已完成：' + r.message + '。请继续下一步。', createdAt: new Date().toISOString() };
    const cur = [...msgsRef.current, fb]; setMsgs(cur); persist(fb);
    try { const content = await callAi(cur); const am = processResponse(content); setMsgs((p: ChatMessage[]) => [...p, am]); persist(am); } catch { /* ok */ }
  }, [docId, persist, callAi, processResponse]);

  const rejectAction = useCallback(async (_action: ParsedAction) => {
    const fb: ChatMessage = { id: msgId(), documentId: docId!, role: 'user', content: '我拒绝了那个操作。请提供替代方案。', createdAt: new Date().toISOString() };
    const cur = [...msgsRef.current, fb]; setMsgs(cur); persist(fb);
    try { const content = await callAi(cur); const am = processResponse(content); setMsgs((p: ChatMessage[]) => [...p, am]); persist(am); } catch { /* ok */ }
  }, [docId, persist, callAi, processResponse]);

  const handleControlOverride = useCallback(async (instr: string) => {
    const cm: ChatMessage = { id: msgId(), documentId: docId!, role: 'user', content: '（打断当前任务）' + instr, createdAt: new Date().toISOString() };
    const cur = [...msgsRef.current, cm]; setMsgs(cur); persist(cm);
    try { const content = await callAi(cur); const am = processResponse(content); setMsgs((p: ChatMessage[]) => [...p, am]); persist(am); setCbState((p: ControlBarState) => ({ ...p, status: 'executing' })); } catch { /* ok */ }
  }, [docId, persist, callAi, processResponse]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }, [send]);
  const onInputC = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }, []);
  const msgList = useMemo(() => msgs.map((m: ChatMessage, i: number) => React.createElement(MsgBubble, { key: m.id, msg: m, isLast: i === msgs.length - 1, onPlanStart: startPlan, onAccept: acceptAction, onReject: rejectAction, pendingId: pendingActionId })), [msgs, startPlan, acceptAction, rejectAction, pendingActionId]);

  return React.createElement(Panel, { node: node },
    React.createElement('div', { className: 'pn-chat' },
      msgs.length === 0
        ? React.createElement('div', { className: 'pn-chat__empty' },
            React.createElement(EmptyIcon),
            React.createElement('p', { className: 'pn-chat__empty-text' },
              '告诉我你想写什么',
              React.createElement('br'),
              '比如“帮我写一篇产品发布公告”')),
        : React.createElement('div', { className: 'pn-chat__messages' },
            msgList,
            streaming ? React.createElement('div', { className: 'pn-chat-streaming' },
              React.createElement('span', null, 'AI 正在思考'),
              React.createElement('span', { className: 'pn-chat-streaming__dots' },
                React.createElement('span', { className: 'pn-chat-streaming__dot' }),
                React.createElement('span', { className: 'pn-chat-streaming__dot' }),
                React.createElement('span', { className: 'pn-chat-streaming__dot' }))) : null,
            React.createElement('div', { ref: endRef })),
      React.createElement('div', { className: 'pn-chat__input-area' },
        React.createElement('textarea', { className: 'pn-chat__input', value: input, onChange: onInputC, onKeyDown: onKeyDown, placeholder: autoMode ? '自动模式运行中…' : '描述你的写作需求…', rows: 1, disabled: streaming || autoMode }),
        React.createElement('button', { className: 'pn-chat__send', onClick: send, disabled: streaming || autoMode || !input.trim(), title: '发送' },
          React.createElement(SendIcon))),
      React.createElement(AgentControlBar, { state: cbState, onStop: () => { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }, onOverride: handleControlOverride }),
    ));
};

export default React.memo(ChatPanel);
