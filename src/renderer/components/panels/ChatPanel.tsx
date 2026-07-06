/**
 * ChatPanel — AI 常驻对话面板
 * 多轮对话 + 消息持久化 + AI 流式回复 + Markdown 渲染
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import Panel from './Panel';
import type { LeafPanel as LeafPanelType, ChatMessage } from './types';
import { msgId } from './types';
import type { RootState } from '../../store';
import { ipc } from '../../utils/ipc';
import { buildSystemPrompt } from '../../utils/writingPreferences';

// ── Minimal Markdown → HTML ──────────────────────────────────

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

// ── Component ────────────────────────────────────────────────

interface Props { node: LeafPanelType; getDocumentContent?: () => string; }

const ChatPanel: React.FC<Props> = ({ node, getDocumentContent }) => {
  const docId = useSelector((s: RootState) => (s as any).panelLayout?.loadedDocumentId) as string | null;
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => { if (!docId || loaded) return; let c = false;
    (async () => { try { const r = await ipc.invoke<ChatMessage[]>('db:getChatMessages', { documentId: docId, limit: 50 }); if (!c && r?.length) setMsgs(r); } catch{} finally { if (!c) setLoaded(true); } })();
    return () => { c = true; };
  }, [docId, loaded]);

  // Scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // Persist
  const persist = useCallback(async (m: ChatMessage) => { try { await ipc.invoke('db:saveChatMessage', m); } catch{} }, []);

  // Send
  const send = useCallback(async () => {
    const t = input.trim(); if (!t || streaming || !docId) return;
    setInput('');

    const um: ChatMessage = { id: msgId(), documentId: docId, role: 'user', content: t, createdAt: new Date().toISOString() };
    setMsgs(p => [...p, um]); persist(um);

    setStreaming(true);
    try {
      const doc = getDocumentContent?.() ?? '';
      const sys = await buildSystemPrompt();
      const parts = sys ? [sys] : [];
      if (doc) parts.push(`\n当前文档内容：\n\`\`\`\n${doc.slice(0, 5000)}\n\`\`\``);
      parts.push('\n请根据以上上下文和对话历史，帮助用户进行写作。');

      const recent = [...msgs.slice(-20), um].map(m => ({ role: m.role, content: m.content }));
      const full = [{ role: 'system', content: parts.join('\n') }, ...recent];

      // Get API key from settings or use default
      let apiKey = '';
      let model = '';
      try {
        apiKey = await ipc.invoke<string>('db:getWritingPreference', 'doubao_api_key') || '';
        model = await ipc.invoke<string>('db:getWritingPreference', 'doubao_model') || '';
      } catch {}

      // Use the existing ai:chat-stream IPC from the main process
      const response = (await ipc.invoke<any>('ai:chat-stream', { messages: full, apiKey, model })) as string;

      const am: ChatMessage = { id: msgId(), documentId: docId, role: 'assistant', content: response || '抱歉，没有收到回复。', createdAt: new Date().toISOString() };
      setMsgs(p => [...p, am]); persist(am);
    } catch (err) {
      const em: ChatMessage = { id: msgId(), documentId: docId, role: 'assistant', content: '抱歉，AI 请求失败了。请检查网络连接后重试。', createdAt: new Date().toISOString() };
      setMsgs(p => [...p, em]); persist(em);
    } finally { setStreaming(false); }
  }, [input, streaming, docId, msgs, persist, getDocumentContent]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }, [send]);
  const onInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }, []);
  const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' }); } catch { return ''; } };

  const msgList = useMemo(() => msgs.map(m => (
    <div key={m.id} className={`pn-chat-msg pn-chat-msg--${m.role}`}>
      <div className="pn-chat-msg__avatar">{m.role === 'user' ? '我' : 'AI'}</div>
      <div>
        <div className="pn-chat-msg__bubble" dangerouslySetInnerHTML={m.role === 'assistant' ? { __html: renderMD(m.content) } : undefined}>{m.role === 'user' ? m.content : undefined}</div>
        <div className="pn-chat-msg__time">{fmtTime(m.createdAt)}</div>
      </div>
    </div>
  )), [msgs, fmtTime]);

  return (
    <Panel node={node}>
      <div className="pn-chat">
        {msgs.length === 0 ? (
          <div className="pn-chat__empty"><EmptyIcon /><p className="pn-chat__empty-text">开始和 AI 聊聊你的写作想法<br/>我可以帮你构思、起草、润色和修改文档</p></div>
        ) : (
          <div className="pn-chat__messages">{msgList}{streaming && <div className="pn-chat-streaming"><span>AI 正在思考</span><span className="pn-chat-streaming__dots"><span className="pn-chat-streaming__dot"/><span className="pn-chat-streaming__dot"/><span className="pn-chat-streaming__dot"/></span></div>}<div ref={endRef}/></div>
        )}
        <div className="pn-chat__input-area">
          <textarea className="pn-chat__input" value={input} onChange={onInput} onKeyDown={onKeyDown} placeholder="输入你的写作需求..." rows={1} disabled={streaming} />
          <button className="pn-chat__send" onClick={send} disabled={streaming || !input.trim()} title="发送 (Enter)"><SendIcon /></button>
        </div>
      </div>
    </Panel>
  );
};

export default React.memo(ChatPanel);
