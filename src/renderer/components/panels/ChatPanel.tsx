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
  '2. 使用 action 标签操作编辑器 → 汇报结果',
  '3. 每步完成后等待用户确认（除非用户开启自动模式）',
  '',
  '## 可用 Action',
  '- append: 末尾追加（自动）',
  '- insert: 光标插入（自动）',
  '- replace: 替换（确认）',
  '- rewrite: 改写（确认）',
  '- delete: 删除（确认）',
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
    const inner = pm[1]; const tm = inner.match(/<title>([\s\S]*?)<\/title>/);
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
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, function(_0: string, _1: string, code: string) { return '<pre><code>' + code.trim() + '</code></pre>'; });
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  h = h.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>').replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  return h.split(/\n\n+/).map(function(b: string) { var t = b.trim(); if (!t) return ''; if (t.startsWith('<pre>') || t.startsWith('<ul>')) return t; return '<p>' + t.replace(/\n/g, '<br/>') + '</p>'; }).join('\n');
}

const SendIcon: React.FC = function() { return React.createElement('svg', { className: 'pn-chat__send-icon', viewBox: '0 0 16 16', fill: 'none' }, React.createElement('path', { d: 'M2 2l12 5.5L2 14l3-6.5L2 2z', fill: 'currentColor', stroke: 'currentColor', strokeWidth: '1', strokeLinejoin: 'round' })); };
const EmptyIcon: React.FC = function() { return React.createElement('svg', { className: 'pn-chat__empty-icon', viewBox: '0 0 48 48', fill: 'none' }, React.createElement('rect', { x: '6', y: '8', width: '36', height: '28', rx: '4', stroke: 'currentColor', strokeWidth: '2' }), React.createElement('circle', { cx: '16', cy: '22', r: '3', fill: 'currentColor' }), React.createElement('circle', { cx: '24', cy: '22', r: '3', fill: 'currentColor' }), React.createElement('circle', { cx: '32', cy: '22', r: '3', fill: 'currentColor' })); };

const ThinkingBlock: React.FC<{ content: string }> = function(props: { content: string }) {
  var content = props.content;
  var stateOpen = useState(true); var open: boolean = stateOpen[0]; var setOpen: (v: boolean) => void = stateOpen[1];
  var statePos = useState(0); var pos: number = statePos[0]; var setPos: (v: number) => void = statePos[1];
  var done = pos >= content.length;
  var prev = useRef(content);

  useEffect(function() { if (prev.current !== content) { setPos(0); setOpen(true); prev.current = content; } }, [content]);
  useEffect(function() { if (done || !open) return; var t = setTimeout(function() { setPos(function(p: number) { return Math.min(p + 5, content.length); }); }, 10); return function() { clearTimeout(t); }; }, [pos, content.length, done, open]);
  useEffect(function() { if (!done || !open) return; var t = setTimeout(function() { setOpen(false); }, 4000); return function() { clearTimeout(t); }; }, [done, open]);

  var text = content.slice(0, pos);

  return React.createElement('div', { style: { margin: '4px 0' } },
    React.createElement('div', { onClick: function() { setOpen(function(v: boolean) { return !v; }); }, className: 'pn-thinking__toggle' },
      React.createElement('span', { className: 'pn-thinking__arrow', style: { transform: open ? 'rotate(90deg)' : 'none' } }, '▶'),
      '思考过程',
      !done ? React.createElement('span', { className: 'pn-thinking__spinner' }) : null
    ),
    open ? React.createElement('div', { className: 'pn-thinking' },
      React.createElement('div', { className: 'pn-thinking__text' },
        text,
        !done ? React.createElement('span', { className: 'pn-thinking__cursor' }, '|') : null
      )
    ) : null
  );
};

const PlanCard: React.FC<{ title: string; steps: AgentStep[]; onStart: () => void }> = function(props: { title: string; steps: AgentStep[]; onStart: () => void }) {
  var title = props.title; var steps = props.steps; var onStart = props.onStart;
  return React.createElement('div', { className: 'pn-plan-card' },
    React.createElement('div', { className: 'pn-plan-card__title' }, '📋 ' + title),
    steps.map(function(s: AgentStep) {
      return React.createElement('div', { key: s.id, className: 'pn-plan-card__step', style: { opacity: s.status === 'done' ? 0.5 : 1 } },
        React.createElement('span', { className: 'pn-plan-card__dot', style: {
          background: s.status === 'done' ? 'var(--color-success,#22c55e)' : s.status === 'doing' ? 'var(--accent,#c8a96e)' : 'var(--border,#e2e5e9)',
          color: s.status !== 'pending' ? '#fff' : 'var(--text-tertiary)',
        } }, s.status === 'done' ? '✓' : s.status === 'doing' ? '▶' : s.id),
        React.createElement('span', { style: { color: 'var(--text-secondary)', textDecoration: s.status === 'done' ? 'line-through' : 'none' } }, s.title)
      );
    }),
    React.createElement('button', { className: 'pn-plan-card__btn', onClick: onStart }, '开始执行')
  );
};

interface BubbleProps { msg: ChatMessage; isLast: boolean; onPlanStart: () => void; onAccept: (a: ParsedAction) => void; onReject: (a: ParsedAction) => void; pendingId: string | null; }

const MsgBubble: React.FC<BubbleProps> = function(props: BubbleProps) {
  var msg = props.msg; var isLast = props.isLast; var onPlanStart = props.onPlanStart; var onAccept = props.onAccept; var onReject = props.onReject; var pendingId = props.pendingId;
  var isU = msg.role === 'user';
  var meta: any = msg.meta;
  var time = (function() { try { return new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); } catch (_e) { return ''; } })();
  var actions: any[] = useMemo(function() { return meta && meta.actions ? meta.actions : []; }, [meta]);
  return React.createElement('div', { className: 'pn-chat-msg pn-chat-msg--' + msg.role },
    React.createElement('div', { className: 'pn-chat-msg__avatar' }, isU ? '我' : 'AI'),
    React.createElement('div', { style: { minWidth: 0 } },
      !isU && meta && meta.thinking ? React.createElement(ThinkingBlock, { content: meta.thinking }) : null,
      !isU && meta && meta.plan && isLast ? React.createElement(PlanCard, { title: meta.plan.title, steps: meta.plan.steps, onStart: onPlanStart }) : null,
      !isU && actions.filter(function(a: any) { return getSafety(a.type) === 'confirm'; }).map(function(a: any, i: number) {
        return React.createElement(ActionConfirm, { key: a.type + '-' + i, action: a, pending: pendingId != null, onAccept: function() { onAccept(a); }, onReject: function() { onReject(a); } });
      }),
      !isU && meta && meta.actionResults ? (meta.actionResults as string[]).map(function(r: string, i: number) {
        return React.createElement('div', { key: String(i), className: 'pn-action-ok' },
          React.createElement('span', null, '✓'),
          React.createElement('span', null, r)
        );
      }) : null,
      (meta && meta.pureContent) || msg.content ? React.createElement('div', { className: 'pn-chat-msg__bubble' },
        isU ? msg.content : React.createElement('div', { dangerouslySetInnerHTML: { __html: renderMD((meta && meta.pureContent) || msg.content) } })
      ) : null,
      React.createElement('div', { className: 'pn-chat-msg__time' }, time)
    )
  );
};

interface Props { node: LeafPanel; getDocumentContent?: () => string; }

const ChatPanel: React.FC<Props> = function(props: Props) {
  var node = props.node; var getDocumentContent = props.getDocumentContent;
  var docId = useSelector(function(s: RootState) { return (s as any).panelLayout && (s as any).panelLayout.loadedDocumentId as string | null; }) || null;
  var msgsState = useState<ChatMessage[]>([]); var msgs = msgsState[0]; var setMsgs = msgsState[1];
  var inputState = useState(''); var input = inputState[0]; var setInput = inputState[1];
  var streamingState = useState(false); var streaming = streamingState[0]; var setStreaming = streamingState[1];
  var autoModeState = useState(false); var autoMode = autoModeState[0]; var setAutoMode = autoModeState[1];
  var loadedState = useState(false); var loaded = loadedState[0]; var setLoaded = loadedState[1];
  var pendingState = useState<string | null>(null); var pendingActionId = pendingState[0]; var setPendingActionId = pendingState[1];
  var cbStateData = useState<ControlBarState>({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); var cbState = cbStateData[0]; var setCbState = cbStateData[1];
  var endRef = useRef<HTMLDivElement>(null);
  var autoRef = useRef(autoMode); autoRef.current = autoMode;
  var msgsRef = useRef(msgs); msgsRef.current = msgs;

  useEffect(function() {
    Bridge.registerEditor('document', {
      getText: function(): string { return (getDocumentContent && getDocumentContent()) || ''; },
      getHTML: function(): string { return (getDocumentContent && getDocumentContent()) || ''; },
      insert: function(c: string): boolean { var ed = (window as any).__activeEditor; if (ed) { try { ed.chain().focus().insertContent(c).run(); return true; } catch (_e) { return false; } } return false; },
      replaceAll: function(h: string): boolean { var ed = (window as any).__activeEditor; if (ed) { try { ed.chain().focus().selectAll().insertContent(h).run(); return true; } catch (_e) { return false; } } return false; },
      findAndReplace: function(s: string, r: string): boolean { var ed = (window as any).__activeEditor; if (!ed) return false; try { var t: string = ed.getText() || ''; if (t.indexOf(s) >= 0) { var nh: string = (ed.getHTML() || '').split(s).join(r); ed.chain().focus().selectAll().insertContent(nh).run(); return true; } } catch (_e) { /* ok */ } try { ed.chain().focus().insertContent(r).run(); return true; } catch (_e) { return false; } },
      getSelection: function(): string { try { return ''; } catch (_e) { return ''; } },
    });
    return function() { Bridge.unregisterEditor('document'); };
  }, [getDocumentContent]);

  useEffect(function() { if (!docId || loaded) return; var c = false; (async function() { try { var rows = await ipc.invoke<any[]>('db:getChatMessages', { documentId: docId, limit: 100 }); if (!c && rows && rows.length) setMsgs(rows.map(function(r: any) { return { id: r.id, documentId: r.document_id || r.documentId, role: r.role, content: r.content, createdAt: r.created_at || r.createdAt, meta: typeof r.meta === 'string' ? JSON.parse(r.meta || '{}') : (r.meta || undefined) }; })); } catch (_e) { /* ok */ } finally { if (!c) setLoaded(true); } })(); return function() { c = true; }; }, [docId, loaded]);
  useEffect(function() { if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  var persist = useCallback(async function(m: ChatMessage) { try { await ipc.invoke('db:saveChatMessage', m); } catch (_e) { /* ok */ } }, []);

  var callAi = useCallback(async function(toSend: ChatMessage[]): Promise<string> {
    setStreaming(true); setCbState(function(p: ControlBarState): ControlBarState { return { visible: true, status: 'thinking', currentStep: p.currentStep, totalSteps: p.totalSteps, completedSteps: p.completedSteps }; });
    try {
      var doc = (getDocumentContent && getDocumentContent()) || '';
      var pref = await buildSystemPrompt();
      var sysParts = [pref, AGENT_PROMPT];
      if (doc) sysParts.push('\n' + '当前文档：\n' + doc.slice(0, 3000));
      if (autoRef.current) sysParts.push('\n' + '用户已开启自动模式，自主执行无需确认。');
      var recent = toSend.slice(-25).map(function(m: ChatMessage) { return { role: m.role, content: m.content }; });
      var resp = await ipc.invoke<any>('ai:chat-stream', { messages: [{ role: 'system', content: sysParts.filter(Boolean).join('\n') }, ...recent], apiKey: '', model: '' });
      var content = typeof resp === 'string' ? resp : (resp && (resp.content || resp.text || JSON.stringify(resp)));
      setCbState(function(p: ControlBarState): ControlBarState { return { visible: true, status: 'executing', currentStep: p.currentStep, totalSteps: p.totalSteps, completedSteps: p.completedSteps }; });
      return content;
    } finally { setStreaming(false); }
  }, [getDocumentContent]);

  var execActions = useCallback(function(actions: ParsedAction[]): string[] {
    var results: string[] = [];
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      if (getSafety(a.type) !== 'safe' && !autoRef.current) continue;
      var r: Bridge.ActionResult = { success: false, message: '' };
      switch (a.type) { case 'append': r = Bridge.actionAppend(a.payload.title || '', a.content); break; case 'insert': r = Bridge.actionInsert(a.content); break; case 'replace': r = Bridge.actionReplace(a.payload.target || '', a.content); break; case 'rewrite': r = Bridge.actionRewrite(a.payload.target || '', a.content); break; case 'delete': r = Bridge.actionDelete(a.payload.target || ''); break; }
      if (r.message) results.push(r.success ? r.message : 'FAIL:' + r.message);
      setCbState(function(p: ControlBarState): ControlBarState { return { visible: true, status: 'executing', currentStep: r.message, totalSteps: p.totalSteps, completedSteps: p.completedSteps }; });
    }
    Bridge.flashEditorChange(); Bridge.scrollToChange();
    return results;
  }, []);

  var processResponse = useCallback(function(raw: string): ChatMessage {
    var parsed = parseTags(raw); var pure = parsed.pure; var plan = parsed.plan; var thinking = parsed.thinking; var actions = parsed.actions;
    var meta: any = { pureContent: pure, kind: plan ? 'plan' : thinking ? 'thinking' : 'normal' };
    if (plan) meta.plan = plan;
    if (thinking) meta.thinking = thinking;
    var confirm = actions.filter(function(a: ParsedAction) { return getSafety(a.type) === 'confirm' && !autoRef.current; });
    if (confirm.length) meta.actions = confirm;
    var executable = actions.filter(function(a: ParsedAction) { return getSafety(a.type) === 'safe' || (autoRef.current && getSafety(a.type) === 'confirm'); });
    if (executable.length) { var results = execActions(executable); if (results.length) meta.actionResults = results; setCbState(function(p: ControlBarState): ControlBarState { return { visible: true, status: 'executing', currentStep: p.currentStep, totalSteps: p.totalSteps, completedSteps: p.completedSteps + executable.length }; }); }
    return { id: msgId(), documentId: docId!, role: 'assistant', content: raw, createdAt: new Date().toISOString(), meta: meta };
  }, [docId, execActions]);

  var send = useCallback(async function() {
    var t = input.trim(); if (!t || streaming || !docId) return; setInput('');
    if (t.indexOf('自动模式') >= 0 || t.toLowerCase().indexOf('auto mode') >= 0) setAutoMode(true);
    if (t.indexOf('停止自动') >= 0 || t.indexOf('取消自动') >= 0 || t.indexOf('手动模式') >= 0) { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
    var um: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: t, createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([um]); setMsgs(cur); persist(um);
    try {
      var content = await callAi(cur);
      var am = processResponse(content);
      setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am);
      if (autoRef.current && (am.meta as any) && (am.meta as any).plan) setTimeout(function() { autoContinue(am); }, 1000);
      else if (!autoRef.current) setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
    } catch (err: any) {
      setMsgs(function(p: ChatMessage[]) { return p.concat([{ id: msgId(), documentId: docId, role: 'assistant', content: 'FAIL:' + ((err && err.message) || 'unknown'), createdAt: new Date().toISOString(), meta: { kind: 'normal', pureContent: 'FAIL:' + ((err && err.message) || 'unknown') } }]); });
      setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
    }
  }, [input, streaming, docId, persist, callAi, processResponse]);

  var autoContinue = useCallback(async function(lastMsg: ChatMessage) {
    if (!autoRef.current || !docId) return;
    var cm: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: '继续下一步（自动模式）', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    try {
      var content = await callAi(cur);
      var am = processResponse(content);
      setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am);
      if (autoRef.current) {
        var metaPlan = (am.meta as any) && (am.meta as any).plan;
        var allDone = !metaPlan || ((metaPlan.steps || []) as AgentStep[]).every(function(s: AgentStep) { return s.status === 'done'; });
        if (allDone) { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
        else setTimeout(function() { autoContinue(am); }, 1500);
      }
    } catch (_e) { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
  }, [docId, callAi, processResponse, persist]);

  var startPlan = useCallback(async function() {
    if (streaming || !docId) return;
    var cm: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: '开始执行计划', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    var lastMeta = msgsRef.current.length > 0 ? ((msgsRef.current[msgsRef.current.length - 1] || {}).meta as any) : null;
    var plan = lastMeta && lastMeta.plan;
    if (plan) setCbState({ visible: true, status: 'executing', currentStep: (plan.steps[0] && plan.steps[0].title) || '', totalSteps: plan.steps.length, completedSteps: 0 });
    try { var content = await callAi(cur); var am = processResponse(content); setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am); if (!autoRef.current) setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); } catch (_e) { /* ok */ }
  }, [streaming, docId, persist, callAi, processResponse]);

  var acceptAction = useCallback(async function(action: ParsedAction) {
    setPendingActionId(action.type + '-' + Date.now());
    var r: Bridge.ActionResult = { success: false, message: '' };
    switch (action.type) { case 'replace': r = Bridge.actionReplace(action.payload.target || '', action.content); break; case 'rewrite': r = Bridge.actionRewrite(action.payload.target || '', action.content); break; case 'delete': r = Bridge.actionDelete(action.payload.target || ''); break; }
    setPendingActionId(null);
    var fb: ChatMessage = { id: msgId(), documentId: docId!, role: 'user', content: '操作已完成：' + r.message + '。请继续下一步。', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([fb]); setMsgs(cur); persist(fb);
    try { var content = await callAi(cur); var am = processResponse(content); setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am); } catch (_e) { /* ok */ }
  }, [docId, persist, callAi, processResponse]);

  var rejectAction = useCallback(async function(_action: ParsedAction) {
    var fb: ChatMessage = { id: msgId(), documentId: docId!, role: 'user', content: '我拒绝了那个操作。请提供替代方案。', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([fb]); setMsgs(cur); persist(fb);
    try { var content = await callAi(cur); var am = processResponse(content); setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am); } catch (_e) { /* ok */ }
  }, [docId, persist, callAi, processResponse]);

  var handleControlOverride = useCallback(async function(instr: string) {
    var cm: ChatMessage = { id: msgId(), documentId: docId!, role: 'user', content: '（打断当前任务）' + instr, createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    try { var content = await callAi(cur); var am = processResponse(content); setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am); setCbState(function(p: ControlBarState): ControlBarState { return { visible: true, status: 'executing', currentStep: p.currentStep, totalSteps: p.totalSteps, completedSteps: p.completedSteps }; }); } catch (_e) { /* ok */ }
  }, [docId, persist, callAi, processResponse]);

  var onKeyDown = useCallback(function(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }, [send]);
  var onInputC = useCallback(function(e: React.ChangeEvent<HTMLTextAreaElement>) { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }, []);
  var msgList = useMemo(function() { return msgs.map(function(m: ChatMessage, i: number) { return React.createElement(MsgBubble, { key: m.id, msg: m, isLast: i === msgs.length - 1, onPlanStart: startPlan, onAccept: acceptAction, onReject: rejectAction, pendingId: pendingActionId }); }); }, [msgs, startPlan, acceptAction, rejectAction, pendingActionId]);

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
      React.createElement(AgentControlBar, { state: cbState, onStop: function() { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }, onOverride: handleControlOverride })
    ));
};

export default React.memo(ChatPanel);
