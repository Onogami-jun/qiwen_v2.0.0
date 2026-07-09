/**
 * ChatPanel — AI Agent v5 (streaming AI + live thinking + Claude animations)
 * Uses ai:chat-stream-v2 for real-time streaming.
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

/* ── Agent Prompt ──────────────────────────────────────────── */
const AP = [
  '你是启文（QiWen Writer）的内置 AI Agent。你可以直接操作编辑器来完成写作任务。',
  '', '## 工作流程',
  '1. 需求不清晰时先提问（最多3个）→ 生成任务计划',
  '2. 使用 action 标签操作编辑器 → 汇报结果',
  '3. 每步完成后等待用户确认（除非用户开启自动模式）',
  '', '## 可用 Action',
  '- append: 末尾追加（自动）', '- insert: 光标插入（自动）',
  '- replace: 替换（确认）', '- rewrite: 改写（确认）', '- delete: 删除（确认）',
  '', '## 重要',
  '- 安全操作直接执行并告知结果', '- 修改操作展示 diff 等用户确认', '- 用户说"自动模式"→ 全自主执行直到叫停',
].join('\n');

/* ── Thinking ticker messages ──────────────────────────────── */
const THINK_MSGS = ['正在分析你的需求…', '正在理解文档内容…', '正在构思写作方案…', '正在组织内容结构…', '正在生成内容…', '正在检查与润色…'];

/* ── Helpers ───────────────────────────────────────────────── */
function parseTags(content: string): { pure: string; plan: any; thinking: string | null; actions: ParsedAction[] } {
  const pm = content.match(/<plan>([\s\S]*?)<\/plan>/);
  var plan: any = null;
  if (pm) { const inner = pm[1], tm = inner.match(/<title>([\s\S]*?)<\/title>/); const steps: AgentStep[] = []; for (const m of inner.matchAll(/<step\s+id="(\d+)"[^>]*>([\s\S]*?)<\/step>/g)) steps.push({ id: m[1], title: m[2].trim(), status: 'pending' }); if (tm) plan = { title: tm[1].trim(), steps }; }
  const th = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const actions = parseActions(content);
  var pure = content.replace(/<plan>[\s\S]*?<\/plan>/g, '').replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  pure = stripActions(pure).trim();
  return { pure, plan, thinking: th ? th[1].trim() : null, actions };
}

function renderMD(text: string): string {
  var h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, function(_0: string, _1: string, code: string) { return '<pre><code>' + code.trim() + '</code></pre>'; });
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>'); h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  h = h.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>'); h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  return h.split(/\n\n+/).map(function(b: string) { var t = b.trim(); if (!t) return ''; if (t.indexOf('<pre>')===0||t.indexOf('<ul>')===0) return t; return '<p>'+t.replace(/\n/g,'<br/>')+'</p>'; }).join('\n');
}

const SendIcon: React.FC = () => (<svg className="pn-chat__send-icon" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 5.5L2 14l3-6.5L2 2z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>);
const EmptyIcon: React.FC = () => (<svg className="pn-chat__empty-icon" viewBox="0 0 48 48" fill="none"><rect x="6" y="8" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2"/><circle cx="16" cy="22" r="3" fill="currentColor"/><circle cx="24" cy="22" r="3" fill="currentColor"/><circle cx="32" cy="22" r="3" fill="currentColor"/></svg>);

/* ── Thinking Block ───────────────────────────────────────── */
const ThinkingBlock: React.FC<{ content: string }> = function(props) {
  var c = props.content, s1 = useState(true), open = s1[0], setOpen = s1[1], s2 = useState(0), pos = s2[0], setPos = s2[1];
  var done = pos >= c.length, prev = useRef(c);
  useEffect(function() { if (prev.current !== c) { setPos(0); setOpen(true); prev.current = c; } }, [c]);
  useEffect(function() { if (done||!open) return; var t = setTimeout(function() { setPos(function(p: number) { return Math.min(p + 5, c.length); }); }, 10); return function() { clearTimeout(t); }; }, [pos, c.length, done, open]);
  useEffect(function() { if (!done||!open) return; var t = setTimeout(function() { setOpen(false); }, 5000); return function() { clearTimeout(t); }; }, [done, open]);
  var text = c.slice(0, pos);
  return (<div style={{ margin: '6px 0' }}>
    <div onClick={function() { setOpen(function(v: boolean) { return !v; }); }} className="pn-thinking__toggle">
      <span className="pn-thinking__arrow" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>{'▶'}</span>
      {'思考过程'} {!done && <span className="pn-thinking__spinner"/>}
    </div>
    {open && <div className="pn-thinking"><div className="pn-thinking__text">{text}{!done&&<span className="pn-thinking__cursor">{'|'}</span>}</div></div>}
  </div>);
};

/* ── Streaming Thinking Banner ─────────────────────────────── */
const StreamingBanner: React.FC<{ tick: number }> = function(props) {
  var idx = props.tick % THINK_MSGS.length;
  return (<div className="pn-live-thinking"><div className="pn-live-thinking__pulse"/><span className="pn-live-thinking__text">{THINK_MSGS[idx]}</span></div>);
};

/* ── Plan Card ─────────────────────────────────────────────── */
const PlanCard: React.FC<{ title: string; steps: AgentStep[]; onStart: () => void }> = function(props) {
  var title = props.title, steps = props.steps, onStart = props.onStart;
  return (<div className="pn-plan-card"><div className="pn-plan-card__title">{'📋 '+title}</div>
    {steps.map(function(s) { return (<div key={s.id} className="pn-plan-card__step" style={{ opacity: s.status==='done'?.5:1 }}><span className="pn-plan-card__dot" style={{ background: s.status==='done'?'var(--color-success,#22c55e)':s.status==='doing'?'var(--accent,#c8a96e)':'var(--border,#e2e5e9)', color: s.status!=='pending'?'#fff':'var(--text-tertiary)' }}>{s.status==='done'?'✓':s.status==='doing'?'▶':s.id}</span><span style={{ color:'var(--text-secondary)', textDecoration: s.status==='done'?'line-through':'none' }}>{s.title}</span></div>); })}
    <button className="pn-plan-card__btn" onClick={onStart}>开始执行</button></div>);
};

/* ── Message Bubble ────────────────────────────────────────── */
const MsgBubble: React.FC<{ msg: ChatMessage; isLast: boolean; onPlanStart: () => void; onAccept: (a: ParsedAction) => void; onReject: (a: ParsedAction) => void; pendingId: string | null }> = function(props) {
  var msg = props.msg, isLast = props.isLast, onPlanStart = props.onPlanStart, onAccept = props.onAccept, onReject = props.onReject, pendingId = props.pendingId;
  var isU = msg.role === 'user', meta: any = msg.meta;
  var time = (function() { try { return new Date(msg.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}); } catch(_e) { return ''; } })();
  var actions: any[] = useMemo(function() { return (meta&&meta.actions)||[]; }, [meta]);
  return (<div className={'pn-chat-msg pn-chat-msg--'+msg.role}><div className="pn-chat-msg__avatar">{isU?'我':'AI'}</div><div style={{ minWidth:0 }}>
    {!isU&&meta&&meta.thinking&&<ThinkingBlock content={meta.thinking}/>}
    {!isU&&meta&&meta.plan&&isLast&&<PlanCard title={meta.plan.title} steps={meta.plan.steps} onStart={onPlanStart}/>}
    {!isU&&actions.filter(function(a: any) { return getSafety(a.type)==='confirm'; }).map(function(a: any,i: number) { return <ActionConfirm key={a.type+'-'+i} action={a} pending={pendingId!=null} onAccept={function(){onAccept(a);}} onReject={function(){onReject(a);}}/>; })}
    {!isU&&meta&&meta.actionResults&&(meta.actionResults as string[]).map(function(r: string,i: number) { return <div key={String(i)} className="pn-action-ok"><span>{'✓'}</span><span>{r}</span></div>; })}
    {(meta&&meta.pureContent)||msg.content?<div className="pn-chat-msg__bubble">{isU?msg.content:<div dangerouslySetInnerHTML={{ __html: renderMD((meta&&meta.pureContent)||msg.content) }}/>}</div>:null}
    <div className="pn-chat-msg__time">{time}</div>
  </div></div>);
};

/* ── ChatPanel Main ────────────────────────────────────────── */
interface Props { node: LeafPanel; getDocumentContent?: () => string; }

const ChatPanel: React.FC<Props> = function(props: Props) {
  var node = props.node, getDocumentContent = props.getDocumentContent;
  var docId: string|null = (useSelector(function(s: RootState) { return ((s as any).panelLayout&&(s as any).panelLayout.loadedDocumentId)||null; })||null);
  var sm = useState<ChatMessage[]>([]); var msgs = sm[0]; var setMsgs = sm[1];
  var si = useState(''); var input = si[0]; var setInput = si[1];
  var ss = useState(false); var streaming = ss[0]; var setStreaming = ss[1];
  var sa = useState(false); var autoMode = sa[0]; var setAutoMode = sa[1];
  var sl = useState(false); var loaded = sl[0]; var setLoaded = sl[1];
  var sp = useState<string|null>(null); var pendingActionId = sp[0]; var setPendingActionId = sp[1];
  var sc = useState<ControlBarState>({ visible:false,status:'idle',currentStep:'',totalSteps:0,completedSteps:0 }); var cbState = sc[0]; var setCbState = sc[1];
  var endRef = useRef<HTMLDivElement>(null);
  var autoRef = useRef(autoMode); autoRef.current = autoMode;
  var msgsRef = useRef(msgs); msgsRef.current = msgs;
  var tickRef = useRef(0); var st = useState(-1); var liveTicker = st[0]; var setLiveTicker = st[1];

  /* ── Editor Bridge ──────────────────────────────────────── */
  useEffect(function() {
    Bridge.registerEditor('document', {
      getText: function(): string { return (getDocumentContent&&getDocumentContent())||''; },
      getHTML: function(): string { return (getDocumentContent&&getDocumentContent())||''; },
      insert: function(c: string): boolean { var ed = (window as any).__activeEditor; if (ed) { try { ed.chain().focus().insertContent(c).run(); return true; } catch(_e) { return false; } } return false; },
      replaceAll: function(h: string): boolean { var ed = (window as any).__activeEditor; if (ed) { try { ed.chain().focus().selectAll().insertContent(h).run(); return true; } catch(_e) { return false; } } return false; },
      findAndReplace: function(s: string, r: string): boolean { var ed = (window as any).__activeEditor; if (!ed) return false; try { var t: string = ed.getText()||''; if (t.indexOf(s)>=0) { var nh = (ed.getHTML()||'').split(s).join(r); ed.chain().focus().selectAll().insertContent(nh).run(); return true; } } catch(_e){} try { ed.chain().focus().insertContent(r).run(); return true; } catch(_e) { return false; } },
      getSelection: function(): string { try { return ''; } catch(_e) { return ''; } },
    });
    return function() { Bridge.unregisterEditor('document'); };
  }, [getDocumentContent]);

  /* ── Load ───────────────────────────────────────────────── */
  useEffect(function() { if (!docId||loaded) return; var c = false; (async function() { try { var rows = await ipc.invoke<any[]>('db:getChatMessages',{documentId:docId,limit:100}); if (!c&&rows&&rows.length) setMsgs(rows.map(function(r:any) { return { id:r.id,documentId:r.document_id||r.documentId,role:r.role,content:r.content,createdAt:r.created_at||r.createdAt,meta:typeof r.meta==='string'?JSON.parse(r.meta||'{}'):(r.meta||undefined) }; })); } catch(_e){} finally { if (!c) setLoaded(true); } })(); return function() { c=true; }; }, [docId,loaded]);
  useEffect(function() { if (endRef.current) endRef.current.scrollIntoView({ behavior:'smooth' }); }, [msgs]);
  var persist = useCallback(async function(m: ChatMessage) { try { await ipc.invoke('db:saveChatMessage',m); } catch(_e){} }, []);

  /* ── Ticker cycle during streaming ──────────────────────── */
  useEffect(function() {
    if (!streaming) { setLiveTicker(-1); tickRef.current = 0; return; }
    setLiveTicker(0);
    var timer = setInterval(function() { tickRef.current = (tickRef.current + 1) % THINK_MSGS.length; setLiveTicker(tickRef.current); }, 2200);
    return function() { clearInterval(timer); };
  }, [streaming]);

  /* ── Call AI via streaming API ──────────────────────────── */
  var callAiStreaming = useCallback(async function(toSend: ChatMessage[]): Promise<string> {
    setStreaming(true); setCbState(function(p: ControlBarState): ControlBarState { return { visible:true,status:'thinking' as const,currentStep:p.currentStep,totalSteps:p.totalSteps,completedSteps:p.completedSteps }; });
    return new Promise(function(resolve, reject) {
      async function doCall() {
        try {
          var doc = (getDocumentContent&&getDocumentContent())||'';
          var pref = await buildSystemPrompt();
          var sysParts = [pref, AP];
          if (doc) sysParts.push('\n当前文档：\n'+doc.slice(0,3000));
          if (autoRef.current) sysParts.push('\n用户已开启自动模式，自主执行无需确认。');
          var recent = toSend.slice(-25).map(function(m: ChatMessage) { return { role:m.role, content:m.content }; });
          var messages = [{ role:'system', content:sysParts.filter(Boolean).join('\n') }, ...recent];

          // Register stream listener
          var onChunk = function(data: { content: string; full: string }) {
            Bridge.showEditorBanner('AI 正在生成回复…');
          };
          if (window.electronAPI && window.electronAPI.onStreamChunk) {
            window.electronAPI.onStreamChunk(onChunk);
          }

          // Call streaming API
          try {
            var fullContent = await ipc.invoke<string>('ai:chat-stream-v2', { messages: messages, apiKey:'', model:'' });
          } finally {
            if (window.electronAPI && window.electronAPI.removeStreamChunk) {
              window.electronAPI.removeStreamChunk(onChunk);
            }
          }

          Bridge.hideEditorBanner();
          setCbState(function(p: ControlBarState): ControlBarState { return { visible:true,status:'executing' as const,currentStep:p.currentStep,totalSteps:p.totalSteps,completedSteps:p.completedSteps }; });
          resolve(fullContent);
        } catch (err: any) {
          Bridge.hideEditorBanner();
          reject(err);
        } finally {
          setStreaming(false);
        }
      }
      doCall();
    });
  }, [getDocumentContent]);

  /* ── Call AI via non-streaming fallback ─────────────────── */
  var callAi = useCallback(async function(toSend: ChatMessage[]): Promise<string> {
    setStreaming(true); setCbState(function(p: ControlBarState): ControlBarState { return { visible:true,status:'thinking' as const,currentStep:p.currentStep,totalSteps:p.totalSteps,completedSteps:p.completedSteps }; });
    try {
      var doc = (getDocumentContent&&getDocumentContent())||'';
      var pref = await buildSystemPrompt();
      var sysParts = [pref, AP];
      if (doc) sysParts.push('\n当前文档：\n'+doc.slice(0,3000));
      if (autoRef.current) sysParts.push('\n用户已开启自动模式，自主执行无需确认。');
      var recent = toSend.slice(-25).map(function(m: ChatMessage) { return { role:m.role, content:m.content }; });
      var resp = await ipc.invoke<any>('ai:chat-stream', { messages: [{ role:'system', content:sysParts.filter(Boolean).join('\n') }, ...recent], apiKey:'', model:'' });
      var content = typeof resp==='string'?resp:(resp&&(resp.content||resp.text||JSON.stringify(resp)));
      setCbState(function(p: ControlBarState): ControlBarState { return { visible:true,status:'executing' as const,currentStep:p.currentStep,totalSteps:p.totalSteps,completedSteps:p.completedSteps }; });
      return content;
    } finally { setStreaming(false); }
  }, [getDocumentContent]);

  /* ── Execute Actions ─────────────────────────────────────── */
  var execActions = useCallback(function(actions: ParsedAction[]): string[] {
    var results: string[] = [];
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      if (getSafety(a.type)!=='safe'&&!autoRef.current) continue;
      var r: Bridge.ActionResult = { success:false, message:'' };
      Bridge.showEditorBanner('正在'+(a.type==='append'?'追加内容':a.type==='insert'?'插入内容':a.type==='replace'?'替换文本':a.type==='rewrite'?'改写段落':a.type==='delete'?'删除内容':'操作中')+'…');
      var st = Date.now();
      switch(a.type) { case 'append': r = Bridge.actionAppend(a.payload.title||'', a.content); break; case 'insert': r = Bridge.actionInsert(a.content); break; case 'replace': r = Bridge.actionReplace(a.payload.target||'', a.content); break; case 'rewrite': r = Bridge.actionRewrite(a.payload.target||'', a.content); break; case 'delete': r = Bridge.actionDelete(a.payload.target||''); break; }
      var elapsed = Date.now() - st;
      if (elapsed < 600) setTimeout(function() { Bridge.hideEditorBanner(); }, 600 - elapsed);
      else Bridge.hideEditorBanner();
      if (r.message) results.push(r.success?r.message:'FAIL:'+r.message);
      setCbState(function(p: ControlBarState): ControlBarState { return { visible:true,status:'executing' as const,currentStep:r.message,totalSteps:p.totalSteps,completedSteps:p.completedSteps }; });
    }
    return results;
  }, []);

  function processResponse(raw: string): ChatMessage {
    var parsed = parseTags(raw), pure = parsed.pure, plan = parsed.plan, thinking = parsed.thinking, actions = parsed.actions;
    var meta: any = { pureContent:pure, kind:plan?'plan':thinking?'thinking':'normal' };
    if (plan) meta.plan = plan;
    if (thinking) meta.thinking = thinking;
    var confirm = actions.filter(function(a: ParsedAction) { return getSafety(a.type)==='confirm'&&!autoRef.current; });
    if (confirm.length) meta.actions = confirm;
    var executable = actions.filter(function(a: ParsedAction) { return getSafety(a.type)==='safe'||(autoRef.current&&getSafety(a.type)==='confirm'); });
    if (executable.length) {
      var results = execActions(executable);
      if (results.length) meta.actionResults = results;
      setCbState(function(p: ControlBarState): ControlBarState { return { visible:true,status:'executing' as const,currentStep:p.currentStep,totalSteps:p.totalSteps,completedSteps:p.completedSteps+executable.length }; });
    }
    return { id:msgId(), documentId:docId!, role:'assistant', content:raw, createdAt:new Date().toISOString(), meta:meta };
  }

  var send = useCallback(async function() {
    var t = input.trim(); if (!t||streaming||!docId) return; setInput('');
    if (t.indexOf('自动模式')>=0||t.toLowerCase().indexOf('auto mode')>=0) setAutoMode(true);
    if (t.indexOf('停止自动')>=0||t.indexOf('取消自动')>=0||t.indexOf('手动模式')>=0) { setAutoMode(false); setCbState({ visible:false,status:'idle',currentStep:'',totalSteps:0,completedSteps:0 }); }
    var um: ChatMessage = { id:msgId(), documentId:docId, role:'user', content:t, createdAt:new Date().toISOString() };
    var cur = msgsRef.current.concat([um]); setMsgs(cur); persist(um);
    try {
      var content = await callAiStreaming(cur);
      var am = processResponse(content);
      setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am);
      if (autoRef.current&&(am.meta as any)&&(am.meta as any).plan) setTimeout(function() { autoContinue(am); }, 1200);
      else if (!autoRef.current) setCbState({ visible:false,status:'idle',currentStep:'',totalSteps:0,completedSteps:0 });
    } catch(err: any) {
      setMsgs(function(p: ChatMessage[]) { return p.concat([{ id:msgId(),documentId:docId,role:'assistant',content:'FAIL:'+((err&&err.message)||'unknown'),createdAt:new Date().toISOString(),meta:{ kind:'normal',pureContent:'FAIL:'+((err&&err.message)||'unknown') } }]); });
      setCbState({ visible:false,status:'idle',currentStep:'',totalSteps:0,completedSteps:0 });
    }
  }, [input,streaming,docId,persist,callAi]);

  var autoContinue = useCallback(async function(lastMsg: ChatMessage) {
    if (!autoRef.current||!docId) return;
    var cm: ChatMessage = { id:msgId(),documentId:docId,role:'user',content:'继续下一步（自动模式）',createdAt:new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    try {
      var content = await callAiStreaming(cur), am = processResponse(content);
      setMsgs(function(p: ChatMessage[]) { return p.concat([am]); }); persist(am);
      if (autoRef.current) { var mp = (am.meta as any)&&(am.meta as any).plan, ad = !mp||((mp.steps||[]) as AgentStep[]).every(function(s:AgentStep){return s.status==='done';}); if (ad) { setAutoMode(false); setCbState({ visible:false,status:'idle',currentStep:'',totalSteps:0,completedSteps:0 }); } else setTimeout(function() { autoContinue(am); }, 1500); }
    } catch(_e) { setAutoMode(false); setCbState({ visible:false,status:'idle',currentStep:'',totalSteps:0,completedSteps:0 }); }
  }, [docId, callAi, persist]);

  var startPlan = useCallback(async function() {
    if (streaming||!docId) return;
    var cm: ChatMessage = { id:msgId(),documentId:docId,role:'user',content:'开始执行计划',createdAt:new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    var lm = msgsRef.current.length>0?((msgsRef.current[msgsRef.current.length-1]||{}).meta as any):null, plan = lm&&lm.plan;
    if (plan) setCbState({ visible:true,status:'executing' as const,currentStep:(plan.steps[0]&&plan.steps[0].title)||'',totalSteps:plan.steps.length,completedSteps:0 });
    try { var c2 = await callAiStreaming(cur), a2 = processResponse(c2); setMsgs(function(p: ChatMessage[]) { return p.concat([a2]); }); persist(a2); if (!autoRef.current) setCbState({ visible:false,status:'idle' as const,currentStep:'',totalSteps:0,completedSteps:0 }); } catch(_e) {}
  }, [streaming,docId,persist,callAi]);

  var acceptAction = useCallback(async function(action: ParsedAction) {
    setPendingActionId(action.type+'-'+Date.now()); var r: Bridge.ActionResult = { success:false,message:'' };
    switch(action.type) { case 'replace': r = Bridge.actionReplace(action.payload.target||'',action.content); break; case 'rewrite': r = Bridge.actionRewrite(action.payload.target||'',action.content); break; case 'delete': r = Bridge.actionDelete(action.payload.target||''); break; }
    setPendingActionId(null);
    var fb: ChatMessage = { id:msgId(),documentId:docId!,role:'user',content:'操作已完成：'+r.message+'。请继续下一步。',createdAt:new Date().toISOString() };
    var cur = msgsRef.current.concat([fb]); setMsgs(cur); persist(fb);
    try { var c3 = await callAiStreaming(cur), a3 = processResponse(c3); setMsgs(function(p: ChatMessage[]) { return p.concat([a3]); }); persist(a3); } catch(_e) {}
  }, [docId,persist,callAi]);

  var rejectAction = useCallback(async function(_action: ParsedAction) {
    var fb: ChatMessage = { id:msgId(),documentId:docId!,role:'user',content:'我拒绝了那个操作。请提供替代方案。',createdAt:new Date().toISOString() };
    var cur = msgsRef.current.concat([fb]); setMsgs(cur); persist(fb);
    try { var c4 = await callAiStreaming(cur), a4 = processResponse(c4); setMsgs(function(p: ChatMessage[]) { return p.concat([a4]); }); persist(a4); } catch(_e) {}
  }, [docId,persist,callAi]);

  var handleControlOverride = useCallback(async function(instr: string) {
    var cm: ChatMessage = { id:msgId(),documentId:docId!,role:'user',content:'（打断当前任务）'+instr,createdAt:new Date().toISOString() };
    var cur = msgsRef.current.concat([cm]); setMsgs(cur); persist(cm);
    try { var c5 = await callAiStreaming(cur), a5 = processResponse(c5); setMsgs(function(p: ChatMessage[]) { return p.concat([a5]); }); persist(a5); setCbState(function(p: ControlBarState): ControlBarState { return { visible:true,status:'executing' as const,currentStep:p.currentStep,totalSteps:p.totalSteps,completedSteps:p.completedSteps }; }); } catch(_e) {}
  }, [docId,persist,callAi]);

  var onKeyDown = useCallback(function(e: React.KeyboardEvent) { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); send(); } }, [send]);
  var onInputC = useCallback(function(e: React.ChangeEvent<HTMLTextAreaElement>) { setInput(e.target.value); e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }, []);
  var msgList = useMemo(function() { return msgs.map(function(m: ChatMessage,i: number) { return <MsgBubble key={m.id} msg={m} isLast={i===msgs.length-1} onPlanStart={startPlan} onAccept={acceptAction} onReject={rejectAction} pendingId={pendingActionId}/>; }); }, [msgs,startPlan,acceptAction,rejectAction,pendingActionId]);

  return (<Panel node={node}><div className="pn-chat">
    {autoMode&&(<div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 14px',background:'rgba(200,169,110,0.1)',borderBottom:'1px solid var(--accent,#c8a96e)',fontSize:12,color:'var(--accent,#c8a96e)' }}><span style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent,#c8a96e)',animation:'pn-pulse 1.5s infinite' }}/><span style={{ flex:1,fontWeight:500 }}>{'🤖 自动模式 — AI 自主执行中'}</span><button onClick={function(){setAutoMode(false);}} style={{ padding:'2px 10px',borderRadius:12,border:'1px solid var(--accent,#c8a96e)',background:'transparent',color:'var(--accent,#c8a96e)',cursor:'pointer',fontSize:11 }}>停止</button></div>)}
    {msgs.length===0?(<div className="pn-chat__empty"><EmptyIcon/><p className="pn-chat__empty-text">告诉我你想写什么<br/>比如"帮我写一篇产品发布公告"</p></div>):(<div className="pn-chat__messages">{msgList}{streaming&&liveTicker>=0&&<StreamingBanner tick={liveTicker}/>}{streaming&&(<div className="pn-chat-streaming"><span className="pn-streaming__text">AI 正在工作</span><span className="pn-chat-streaming__dots"><span className="pn-chat-streaming__dot"/><span className="pn-chat-streaming__dot"/><span className="pn-chat-streaming__dot"/></span></div>)}<div ref={endRef}/></div>)}
    <div className="pn-chat__input-area"><textarea className="pn-chat__input" value={input} onChange={onInputC} onKeyDown={onKeyDown} placeholder={autoMode?'自动模式运行中…':'描述你的写作需求…'} rows={1} disabled={streaming||autoMode}/><button className="pn-chat__send" onClick={send} disabled={streaming||autoMode||!input.trim()} title="发送"><SendIcon/></button></div>
    <AgentControlBar state={cbState} onStop={function(){setAutoMode(false);setCbState({ visible:false,status:'idle',currentStep:'',totalSteps:0,completedSteps:0 });}} onOverride={handleControlOverride}/>
  </div></Panel>);
};

export default React.memo(ChatPanel);
