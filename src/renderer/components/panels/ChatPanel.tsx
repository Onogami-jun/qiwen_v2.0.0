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
  var h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, _l, code) { return '<pre><code>' + code.trim() + '</code></pre>'; });
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  h = h.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>').replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  return h.split(/\n\n+/).map(function(b) { var t = b.trim(); if (!t) return ''; if (t.startsWith('<pre>') || t.startsWith('<ul>')) return t; return '<p>' + t.replace(/\n/g, '<br/>') + '</p>'; }).join('\n');
}

var SendIcon = function() { return React.createElement('svg', { className: 'pn-chat__send-icon', viewBox: '0 0 16 16', fill: 'none' }, React.createElement('path', { d: 'M2 2l12 5.5L2 14l3-6.5L2 2z', fill: 'currentColor', stroke: 'currentColor', strokeWidth: '1', strokeLinejoin: 'round' })); };
var EmptyIcon = function() { return React.createElement('svg', { className: 'pn-chat__empty-icon', viewBox: '0 0 48 48', fill: 'none' }, React.createElement('rect', { x: '6', y: '8', width: '36', height: '28', rx: '4', stroke: 'currentColor', strokeWidth: '2' }), React.createElement('circle', { cx: '16', cy: '22', r: '3', fill: 'currentColor' }), React.createElement('circle', { cx: '24', cy: '22', r: '3', fill: 'currentColor' }), React.createElement('circle', { cx: '32', cy: '22', r: '3', fill: 'currentColor' })); };

var ThinkingBlock = function(_a) {
  var content = _a.content;
  var _b = useState(true), open = _b[0], setOpen = _b[1];
  var _c = useState(0), pos = _c[0], setPos = _c[1];
  var done = pos >= content.length;
  var prevContent = useRef(content);

  useEffect(function() {
    if (prevContent.current !== content) { setPos(0); setOpen(true); prevContent.current = content; }
  }, [content]);

  useEffect(function() {
    if (done || !open) return;
    var t = setTimeout(function() { setPos(function(p) { return Math.min(p + 5, content.length); }); }, 10);
    return function() { clearTimeout(t); };
  }, [pos, content.length, done, open]);

  useEffect(function() {
    if (!done || !open) return;
    var t = setTimeout(function() { setOpen(false); }, 4000);
    return function() { clearTimeout(t); };
  }, [done, open]);

  var text = content.slice(0, pos);

  return React.createElement('div', { style: { margin: '4px 0' } },
    React.createElement('div', { onClick: function() { setOpen(!open); }, className: 'pn-thinking__toggle' },
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

var PlanCard = function(_a) {
  var title = _a.title, steps = _a.steps, onStart = _a.onStart;
  return React.createElement('div', { className: 'pn-plan-card' },
    React.createElement('div', { className: 'pn-plan-card__title' }, '📋 ' + title),
    steps.map(function(s) {
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

var MsgBubble = function(_a) {
  var msg = _a.msg, isLast = _a.isLast, onPlanStart = _a.onPlanStart, onAccept = _a.onAccept, onReject = _a.onReject, pendingId = _a.pendingId;
  var isU = msg.role === 'user';
  var meta = msg.meta;
  var time = (function() { try { return new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); } catch (_e) { return ''; } })();
  var actions = useMemo(function() { return (meta && meta.actions) || []; }, [meta]);
  return React.createElement('div', { className: 'pn-chat-msg pn-chat-msg--' + msg.role },
    React.createElement('div', { className: 'pn-chat-msg__avatar' }, isU ? '我' : 'AI'),
    React.createElement('div', { style: { minWidth: 0 } },
      !isU && meta && meta.thinking ? React.createElement(ThinkingBlock, { content: meta.thinking }) : null,
      !isU && meta && meta.plan && isLast ? React.createElement(PlanCard, { title: meta.plan.title, steps: meta.plan.steps, onStart: onPlanStart }) : null,
      !isU && actions.filter(function(a) { return getSafety(a.type) === 'confirm'; }).map(function(a, i) {
        return React.createElement(ActionConfirm, { key: a.type + '-' + i, action: a, pending: pendingId != null, onAccept: function() { onAccept(a); }, onReject: function() { onReject(a); } });
      }),
      !isU && meta && meta.actionResults ? (meta.actionResults).map(function(r, i) {
        return React.createElement('div', { key: i, className: 'pn-action-ok' },
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

var ChatPanel = function(_a) {
  var node = _a.node, getDocumentContent = _a.getDocumentContent;

  var docId = useSelector(function(s) { return s.panelLayout && s.panelLayout.loadedDocumentId; }) || null;
  var _b = useState([]), msgs = _b[0], setMsgs = _b[1];
  var _c = useState(''), input = _c[0], setInput = _c[1];
  var _d = useState(false), streaming = _d[0], setStreaming = _d[1];
  var _e = useState(false), autoMode = _e[0], setAutoMode = _e[1];
  var _f = useState(false), loaded = _f[0], setLoaded = _f[1];
  var _g = useState(null), pendingActionId = _g[0], setPendingActionId = _g[1];
  var _h = useState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }), cbState = _h[0], setCbState = _h[1];
  var endRef = useRef(null);
  var autoRef = useRef(autoMode); autoRef.current = autoMode;
  var msgsRef = useRef(msgs); msgsRef.current = msgs;

  useEffect(function() {
    Bridge.registerEditor('document', {
      getText: function() { return (getDocumentContent && getDocumentContent()) || ''; },
      getHTML: function() { return (getDocumentContent && getDocumentContent()) || ''; },
      insert: function(c) { var ed = window.__activeEditor; if (ed) { try { ed.chain().focus().insertContent(c).run(); return true; } catch (_e) { return false; } } return false; },
      replaceAll: function(h) { var ed = window.__activeEditor; if (ed) { try { ed.chain().focus().selectAll().insertContent(h).run(); return true; } catch (_e) { return false; } } return false; },
      findAndReplace: function(s, r) { var ed = window.__activeEditor; if (!ed) return false; try { var t = ed.getText() || ''; if (t.indexOf(s) >= 0) { var nh = (ed.getHTML() || '').split(s).join(r); ed.chain().focus().selectAll().insertContent(nh).run(); return true; } } catch (_e) { /* ok */ } try { ed.chain().focus().insertContent(r).run(); return true; } catch (_e) { return false; } },
      getSelection: function() { try { var ed = window.__activeEditor; return ed && ed.state && ed.state.selection ? '' : ''; } catch (_e) { return ''; } },
    });
    return function() { Bridge.unregisterEditor('document'); };
  }, [getDocumentContent]);

  useEffect(function() { if (!docId || loaded) return; var c = false; (function() { var _a = ipc.invoke('db:getChatMessages', { documentId: docId, limit: 100 }); return _a.then(function(rows) { if (!c && rows && rows.length) setMsgs(rows.map(function(r) { return { id: r.id, documentId: r.document_id || r.documentId, role: r.role, content: r.content, createdAt: r.created_at || r.createdAt, meta: typeof r.meta === 'string' ? JSON.parse(r.meta || '{}') : (r.meta || undefined) }; })); }).catch(function() {}).then(function() { if (!c) setLoaded(true); }); })(); return function() { c = true; }; }, [docId, loaded]);
  useEffect(function() { if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  var persist = useCallback(function(m) { ipc.invoke('db:saveChatMessage', m).catch(function() {}); }, []);

  var callAi = useCallback(function(toSend) {
    setStreaming(true); setCbState(function(p) { return Object.assign({}, p, { status: 'thinking', visible: true }); });
    var _a = (function() {
      var doc = (getDocumentContent && getDocumentContent()) || '';
      return buildSystemPrompt().then(function(pref) {
        var sys = [pref, AGENT_PROMPT];
        if (doc) sys.push('\n当前文档：\n' + doc.slice(0, 3000));
        if (autoRef.current) sys.push('\n用户已开启自动模式，自主执行无需确认。');
        var recent = toSend.slice(-25).map(function(m) { return { role: m.role, content: m.content }; });
        return ipc.invoke('ai:chat-stream', {
          messages: [{ role: 'system', content: sys.filter(Boolean).join('\n') }].concat(recent),
          apiKey: '', model: '',
        }).then(function(resp) {
          var content = typeof resp === 'string' ? resp : (resp && (resp.content || resp.text || JSON.stringify(resp)));
          setCbState(function(p) { return Object.assign({}, p, { status: 'executing' }); });
          return content;
        });
      });
    })();
    return _a.finally(function() { setStreaming(false); });
  }, [getDocumentContent]);

  var execActions = useCallback(function(actions) {
    var results = [];
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      if (getSafety(a.type) !== 'safe' && !autoRef.current) continue;
      var r = { success: false, message: '' };
      switch (a.type) { case 'append': r = Bridge.actionAppend(a.payload.title || '', a.content); break; case 'insert': r = Bridge.actionInsert(a.content); break; case 'replace': r = Bridge.actionReplace(a.payload.target || '', a.content); break; case 'rewrite': r = Bridge.actionRewrite(a.payload.target || '', a.content); break; case 'delete': r = Bridge.actionDelete(a.payload.target || ''); break; }
      if (r.message) results.push(r.success ? r.message : 'FAIL:' + r.message);
      setCbState(function(p) { return Object.assign({}, p, { status: 'executing', currentStep: r.message }); });
    }
    Bridge.flashEditorChange(); Bridge.scrollToChange();
    return results;
  }, []);

  var processResponse = useCallback(function(raw) {
    var _a = parseTags(raw), pure = _a.pure, plan = _a.plan, thinking = _a.thinking, actions = _a.actions;
    var meta = { pureContent: pure, kind: plan ? 'plan' : thinking ? 'thinking' : 'normal' };
    if (plan) meta.plan = plan;
    if (thinking) meta.thinking = thinking;
    var confirm = actions.filter(function(a) { return getSafety(a.type) === 'confirm' && !autoRef.current; });
    if (confirm.length) meta.actions = confirm;
    var executable = actions.filter(function(a) { return getSafety(a.type) === 'safe' || (autoRef.current && getSafety(a.type) === 'confirm'); });
    if (executable.length) { var results = execActions(executable); if (results.length) meta.actionResults = results; setCbState(function(p) { return Object.assign({}, p, { completedSteps: p.completedSteps + executable.length }); }); }
    return { id: msgId(), documentId: docId, role: 'assistant', content: raw, createdAt: new Date().toISOString(), meta: meta };
  }, [docId, execActions]);

  var send = useCallback(function() {
    var t = input.trim(); if (!t || streaming || !docId) return; setInput('');
    if (t.indexOf('自动模式') >= 0 || t.toLowerCase().indexOf('auto mode') >= 0) setAutoMode(true);
    if (t.indexOf('停止自动') >= 0 || t.indexOf('取消自动') >= 0 || t.indexOf('手动模式') >= 0) { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
    var um = { id: msgId(), documentId: docId, role: 'user', content: t, createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([um]); setMsgs(cur); persist(um);
    callAi(cur).then(function(content) {
      var am = processResponse(content);
      setMsgs(function(p) { return p.concat([am]); }); persist(am);
      if (autoRef.current && am.meta && am.meta.plan) { setTimeout(function() { autoContinue(am); }, 1000); }
      else if (!autoRef.current) setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
    }).catch(function(err) {
      setMsgs(function(p) { return p.concat([{ id: msgId(), documentId: docId, role: 'assistant', content: 'FAIL:' + ((err && err.message) || 'unknown'), createdAt: new Date().toISOString(), meta: { kind: 'normal', pureContent: 'FAIL:' + ((err && err.message) || 'unknown') } }]); });
      setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
    });
  }, [input, streaming, docId, persist, callAi, processResponse]);

  var autoContinue = useCallback(function(lastMsg) {
    if (!autoRef.current || !docId) return;
    var cm = { id: msgId(), documentId: docId, role: 'user', content: '继续下一步（自动模式）', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    callAi(cur).then(function(content) {
      var am = processResponse(content);
      setMsgs(function(p) { return p.concat([am]); }); persist(am);
      if (autoRef.current) {
        var plan = am.meta && am.meta.plan;
        var allDone = !plan || (plan.steps || []).every(function(s) { return s.status === 'done'; });
        if (allDone) { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); }
        else setTimeout(function() { autoContinue(am); }, 1500);
      }
    }).catch(function() { setAutoMode(false); setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 }); });
  }, [docId, callAi, processResponse, persist]);

  var startPlan = useCallback(function() {
    if (streaming || !docId) return;
    var cm = { id: msgId(), documentId: docId, role: 'user', content: '开始执行计划', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    var lastMeta = (msgsRef.current[msgsRef.current.length - 1] || {}).meta;
    var plan = lastMeta && lastMeta.plan;
    if (plan) setCbState({ visible: true, status: 'executing', currentStep: (plan.steps[0] || {}).title || '', totalSteps: plan.steps.length, completedSteps: 0 });
    callAi(cur).then(function(content) {
      var am = processResponse(content);
      setMsgs(function(p) { return p.concat([am]); }); persist(am);
      if (!autoRef.current) setCbState({ visible: false, status: 'idle', currentStep: '', totalSteps: 0, completedSteps: 0 });
    }).catch(function() {});
  }, [streaming, docId, persist, callAi, processResponse]);

  var acceptAction = useCallback(function(action) {
    setPendingActionId(action.type + '-' + Date.now());
    var r = { success: false, message: '' };
    switch (action.type) { case 'replace': r = Bridge.actionReplace(action.payload.target || '', action.content); break; case 'rewrite': r = Bridge.actionRewrite(action.payload.target || '', action.content); break; case 'delete': r = Bridge.actionDelete(action.payload.target || ''); break; }
    setPendingActionId(null);
    var fb = { id: msgId(), documentId: docId, role: 'user', content: '操作已完成：' + r.message + '。请继续下一步。', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([fb]); setMsgs(cur); persist(fb);
    callAi(cur).then(function(content) { var am = processResponse(content); setMsgs(function(p) { return p.concat([am]); }); persist(am); }).catch(function() {});
  }, [docId, persist, callAi, processResponse]);

  var rejectAction = useCallback(function(_action) {
    var fb = { id: msgId(), documentId: docId, role: 'user', content: '我拒绝了那个操作。请提供替代方案。', createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([fb]); setMsgs(cur); persist(fb);
    callAi(cur).then(function(content) { var am = processResponse(content); setMsgs(function(p) { return p.concat([am]); }); persist(am); }).catch(function() {});
  }, [docId, persist, callAi, processResponse]);

  var handleControlOverride = useCallback(function(instr) {
    var cm = { id: msgId(), documentId: docId, role: 'user', content: '（打断当前任务）' + instr, createdAt: new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    callAi(cur).then(function(content) { var am = processResponse(content); setMsgs(function(p) { return p.concat([am]); }); persist(am); setCbState(function(p) { return Object.assign({}, p, { status: 'executing' }); }); }).catch(function() {});
  }, [docId, persist, callAi, processResponse]);

  var onKeyDown = useCallback(function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }, [send]);
  var onInputC = useCallback(function(e) { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }, []);
  var msgList = useMemo(function() { return msgs.map(function(m, i) { return React.createElement(MsgBubble, { key: m.id, msg: m, isLast: i === msgs.length - 1, onPlanStart: startPlan, onAccept: acceptAction, onReject: rejectAction, pendingId: pendingActionId }); }); }, [msgs, startPlan, acceptAction, rejectAction, pendingActionId]);

  return React.createElement(Panel, { node: node },
    React.createElement('div', { className: 'pn-chat' },
      msgs.length === 0
        ? React.createElement('div', { className: 'pn-chat__empty' },
            React.createElement(EmptyIcon),
            React.createElement('p', { className: 'pn-chat__empty-text' }, '告诉我你想写什么', React.createElement('br'), '比如"帮我写一篇产品发布公告"'))
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
