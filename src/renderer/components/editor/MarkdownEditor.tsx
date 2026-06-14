import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import CharacterCount from '@tiptap/extension-character-count';
import { SlashCommandExtension } from './SlashCommand';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import Mathematics from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { updateStats, updateCursor } from '../../store/slices/editorSlice';
import { setDocumentContent } from '../../store/slices/documentsSlice';
import { markTabDirty } from '../../store/slices/appSlice';
import { autoSave } from '../../utils/autoSave';
import { useCollaboration, OnlineAvatars } from './CollaborationExtension';
import { CommentPanel } from './CommentPanel';

// ── WikiLink 双向链接扩展 ──────────────────────────────────
// 将 [[文档名]] 渲染为高亮可点击链接


const WikiLinkExtension = Extension.create({
  name: 'wikilink',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikilink'),
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: any[] = [];
            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const regex = /\[\[([^\]]+)\]\]/g;
              let m;
              while ((m = regex.exec(node.text)) !== null) {
                const start = pos + m.index;
                const end = start + m[0].length;
                decorations.push(
                  Decoration.inline(start, end, {
                    class: 'wikilink',
                    style: 'color: var(--accent); background: rgba(200,169,110,0.1); border-radius: 3px; padding: 0 2px; cursor: pointer; text-decoration: none;',
                    'data-wikilink': m[1],
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains('wikilink')) {
              const title = target.getAttribute('data-wikilink');
              if (title) {
                // 触发自定义事件，App.tsx 层处理跳转
                window.dispatchEvent(new CustomEvent('qiwen:open-wikilink', { detail: { title } }));
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
// LaTeX 公式支持
// 代码块语法高亮

interface MarkdownEditorProps {
  documentId: string;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  collaborationEnabled?: boolean;
  showComments?: boolean;
}

const FloatingToolbar: React.FC<{ editor: any }> = ({ editor }) => {
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '4px 8px', border: 'none', borderRadius: 5,
    background: active ? 'rgba(200,169,110,0.25)' : 'transparent',
    color: active ? '#c8a96e' : '#e8e6e0',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
    transition: 'all 0.1s', display: 'flex', alignItems: 'center',
    justifyContent: 'center', minWidth: 28, height: 28,
  });
  const sep = { width: 0.5, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' } as React.CSSProperties;

  return (
    <BubbleMenu editor={editor} tippyOptions={{ duration: 150, placement: 'top' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '4px 8px', background: '#1a1a28',
        border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
      }}>
      <button style={btn(editor.isActive('bold'))} title="加粗 Ctrl+B"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>
        <strong>B</strong></button>
      <button style={btn(editor.isActive('italic'))} title="斜体 Ctrl+I"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>
        <em>I</em></button>
      <button style={btn(editor.isActive('underline'))} title="下划线 Ctrl+U"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}>
        <span style={{ textDecoration: 'underline' }}>U</span></button>
      <button style={btn(editor.isActive('strike'))} title="删除线"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}>
        <span style={{ textDecoration: 'line-through' }}>S</span></button>
      <button style={btn(editor.isActive('highlight'))} title="高亮"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight().run(); }}>
        ✦</button>
      <div style={sep} />
      <button style={btn(editor.isActive('heading', { level: 1 }))} title="标题1"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}>
        H1</button>
      <button style={btn(editor.isActive('heading', { level: 2 }))} title="标题2"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}>
        H2</button>
      <div style={sep} />
      <button style={btn(editor.isActive('code'))} title="行内代码"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>
      <button style={btn(editor.isActive('link'))} title="链接"
        onMouseDown={e => {
          e.preventDefault();
          const url = window.prompt('输入链接地址：');
          if (url) editor.chain().focus().setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
      <div style={sep} />
      <AIInlineMenu editor={editor} />
      </div>
    </BubbleMenu>
  );
};

// ── AI 内联操作菜单 ────────────────────────────────────────
const BUILTIN_KEY = 'ark-0f0fd51c-1395-45bd-9df0-29a195257d96-5ab55';
const BUILTIN_MDL = 'doubao-seed-2-0-pro-260215';
function getK() { try { return localStorage.getItem('qiwen_doubao_apikey') || BUILTIN_KEY; } catch { return BUILTIN_KEY; } }
function getM() { try { return localStorage.getItem('qiwen_doubao_model') || BUILTIN_MDL; } catch { return BUILTIN_MDL; } }

const AI_OPS = [
  { id: 'polish',    label: '润色',   prompt: (t: string) => `请润色以下文字，保持原意，提升表达质量，只返回改写后的文字，不要解释：\n\n${t}` },
  { id: 'expand',   label: '扩写',   prompt: (t: string) => `请扩写以下文字，增加细节和论述，保持原有风格，只返回扩写后的文字：\n\n${t}` },
  { id: 'shorten',  label: '缩写',   prompt: (t: string) => `请精简以下文字，保留核心意思，删除冗余内容，只返回精简后的文字：\n\n${t}` },
  { id: 'translate',label: '译中文', prompt: (t: string) => `请将以下文字翻译为中文，只返回译文，不要解释：\n\n${t}` },
  { id: 'translate_en', label: '译英文', prompt: (t: string) => `Please translate the following text to English. Return only the translation:\n\n${t}` },
  { id: 'continue', label: '续写',   prompt: (t: string) => `请根据以下内容自然地续写100-200字，保持风格一致，只返回续写的部分：\n\n${t}` },
];

const AIInlineMenu: React.FC<{ editor: any }> = ({ editor }) => {
  const [loading, setLoading] = React.useState(false);
  const [activeOp, setActiveOp] = React.useState<string | null>(null);

  const runOp = async (op: typeof AI_OPS[0]) => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    setLoading(true);
    setActiveOp(op.id);
    try {
      const res = await (window as any).electronAPI?.invoke('ai:chat-stream', {
        messages: [{ role: 'user', content: op.prompt(selectedText) }],
        apiKey: getK(),
        model: getM(),
      });
      const result = res?.trim();
      if (result) {
        editor.chain().focus().deleteSelection().insertContent(result).run();
      }
    } catch (e) {
      console.error('[AI inline] error:', e);
    } finally {
      setLoading(false);
      setActiveOp(null);
    }
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 7px', border: 'none', borderRadius: 5,
    background: active ? 'rgba(200,169,110,0.3)' : 'transparent',
    color: active ? '#c8a96e' : 'rgba(200,169,110,0.8)',
    cursor: loading ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 500,
    transition: 'all 0.1s', whiteSpace: 'nowrap' as const,
    display: 'flex', alignItems: 'center', gap: 3, height: 26,
  });

  return (
    <>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 6px', color: '#c8a96e', fontSize: 11.5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(200,169,110,0.3)', borderTopColor: '#c8a96e', animation: 'spin 0.7s linear infinite' }} />
          AI {AI_OPS.find(o => o.id === activeOp)?.label}中...
        </div>
      ) : (
        AI_OPS.map(op => (
          <button key={op.id} style={btnStyle(false)} title={op.label}
            onMouseDown={e => { e.preventDefault(); runOp(op); }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            ✦ {op.label}
          </button>
        ))
      )}
    </>
  );
};

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ documentId, readOnly = false, onContentChange, collaborationEnabled = false, showComments = false }) => {
  const dispatch = useDispatch<AppDispatch>();
  const doc = useSelector((s: RootState) => s.documents.openDocuments[documentId]);
  const initialized = useRef(false);
  const lastHtml = useRef('');
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 实时协作
  const { onlineUsers, isConnected } = useCollaboration(documentId, collaborationEnabled);

  // 评论面板
  const [showCommentPanel, setShowCommentPanel] = React.useState(showComments);

  // AI Copilot 补全
  const [copilotSuggestion, setCopilotSuggestion] = React.useState('');
  const [copilotLoading, setCopilotLoading] = React.useState(false);
  const copilotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copilotEnabled = React.useRef(true); // 可通过设置关闭

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        // 禁用 StarterKit 内置的 codeBlock，改用 CodeBlockLowlight
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: '开始写作...', emptyEditorClass: 'is-editor-empty' }),
      Typography,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      // 代码块语法高亮：支持常用语言，自动检测
      CodeBlockLowlight.configure({
        lowlight: createLowlight(common),
        defaultLanguage: null,
        HTMLAttributes: { class: 'code-block-lowlight' },
      }),
      // LaTeX 数学公式（行内 $...$ 和块级 $$...$$）
      Mathematics,
      SlashCommandExtension,
      WikiLinkExtension,
    ],
    content: '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html === lastHtml.current) return;
      lastHtml.current = html;

      // 1. 通知 Redux 内容已变更（用于 AI 面板等读取最新内容）
      dispatch(setDocumentContent({ id: documentId, content: html }));
      // 2. 标记 tab 为 dirty
      dispatch(markTabDirty({ id: documentId, dirty: true }));
      // 3. 交给 autoSave 防抖，真正写 DB
      autoSave.schedule(documentId, html);
      // 4. 回调
      onContentChange?.(html);
      // 5. 字数统计降频（800ms 防抖）
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
      statsTimerRef.current = setTimeout(() => {
        const text = editor.getText();
        const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const en = (text.match(/\b[a-zA-Z]+\b/g) || []).length;
        dispatch(updateStats({ wordCount: cn + en, charCount: text.length }));
        statsTimerRef.current = null;
      }, 800);
    },
  });

  // 暴露给工具栏；卸载时立即 flush 保存（切换文档/关闭时不丢内容）
  useEffect(() => {
    if (!editor) return;
    (window as any).__activeEditor = editor;
    (window as any).__editors = (window as any).__editors || {};
    (window as any).__editors[documentId] = editor;
    return () => {
      if ((window as any).__editors) delete (window as any).__editors[documentId];
      if ((window as any).__activeEditor === editor) (window as any).__activeEditor = null;
      // 组件卸载时立即把 pending 内容写入 DB，确保切换文档/窗口关闭时不丢数据
      autoSave.flush(documentId).catch(() => {});
    };
  }, [editor, documentId]);

  // 初始化内容
  useEffect(() => {
    if (!editor || initialized.current || !doc) return;
    initialized.current = true;
    editor.commands.setContent(doc.content || '', false);
    lastHtml.current = doc.content || '';
    const text = editor.getText();
    const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const en = (text.match(/\b[a-zA-Z]+\b/g) || []).length;
    dispatch(updateStats({ wordCount: cn + en, charCount: text.length }));
  }, [editor, doc, dispatch]);

  // 外部内容同步：只在没有 pending 编辑时才同步（避免覆盖用户正在输入的内容）
  useEffect(() => {
    if (!editor || !doc?.content) return;
    if (doc.content === lastHtml.current) return;
    // 若 autoSave 有 pending 内容，说明用户正在编辑，不覆盖
    if (autoSave.hasPending()) return;
    editor.commands.setContent(doc.content, false);
    lastHtml.current = doc.content;
  }, [doc?.content]); // eslint-disable-line

  // 失焦时立即保存当前文档
  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => autoSave.flush(documentId);
    editor.on('blur', handleBlur);
    return () => { editor.off('blur', handleBlur); };
  }, [editor, documentId]);

  // AI Copilot：打字停顿 1.2 秒后触发补全
  useEffect(() => {
    if (!editor || readOnly) return;
    const onUpdate = () => {
      if (!copilotEnabled.current) return;
      setCopilotSuggestion('');
      if (copilotTimer.current) clearTimeout(copilotTimer.current);
      copilotTimer.current = setTimeout(async () => {
        const { empty, $from } = editor.state.selection;
        if (!empty) return; // 有选中时不触发
        // 取光标前 300 字作上下文
        const pos = $from.pos;
        const text = editor.state.doc.textBetween(Math.max(0, pos - 300), pos, '\n');
        if (!text.trim() || text.trim().length < 10) return;
        // 只在段落末尾（光标在行尾）时触发
        const lastChar = text[text.length - 1];
        if (lastChar === ' ' || lastChar === '\n') return;
        setCopilotLoading(true);
        try {
          const res = await (window as any).electronAPI?.invoke('ai:chat-stream', {
            messages: [{ role: 'user', content: `你是一位写作助手。请根据以下文字，续写10-30个字，语气自然流畅，只返回续写内容，不要解释或重复已有内容：\n\n${text}` }],
            apiKey: getK(),
            model: getM(),
          });
          if (res?.trim()) setCopilotSuggestion(res.trim().slice(0, 60));
        } catch {}
        finally { setCopilotLoading(false); }
      }, 1200);
    };
    editor.on('update', onUpdate);
    // 任何按键（非 Tab）清空建议
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && copilotSuggestion) {
        e.preventDefault();
        e.stopPropagation();
        editor.chain().focus().insertContent(copilotSuggestion).run();
        setCopilotSuggestion('');
      } else if (e.key !== 'Tab') {
        setCopilotSuggestion('');
      }
    };
    document.addEventListener('keydown', onKeydown, true);
    return () => {
      editor.off('update', onUpdate);
      document.removeEventListener('keydown', onKeydown, true);
      if (copilotTimer.current) clearTimeout(copilotTimer.current);
    };
  }, [editor, readOnly, copilotSuggestion]);

  // 清理 stats 计算定时器（必须在 early return 之前调用，遵守 Hook 规则）
  React.useEffect(() => {
    return () => {
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    };
  }, []);

  if (!editor) return null;

  // 代码块语言切换
  const LANGS = ['', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'bash', 'sql', 'html', 'css', 'json', 'yaml', 'markdown', 'xml', 'php', 'ruby', 'swift', 'kotlin', 'latex'];
  const LANG_LABELS: Record<string, string> = { '': '纯文本', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go', rust: 'Rust', bash: 'Bash/Shell', sql: 'SQL', html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', markdown: 'Markdown', xml: 'XML', php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin', latex: 'LaTeX' };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%' }}>
      {/* 主编辑区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', position: 'relative' }}>

        {/* 在线协作者头像（右上角） */}
        {onlineUsers.length > 0 && (
          <div style={{ position: 'absolute', top: 8, right: showCommentPanel ? 336 : 56, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <OnlineAvatars users={onlineUsers} />
            {isConnected && (
              <span style={{ fontSize: 10, color: '#52c97a', background: '#52c97a18', padding: '2px 7px', borderRadius: 10, border: '1px solid #52c97a30' }}>
                实时协作中
              </span>
            )}
          </div>
        )}

        {/* 评论面板开关按钮 */}
        <button
          onClick={() => setShowCommentPanel(v => !v)}
          title="评论面板"
          style={{
            position: 'absolute', top: 8, right: 12, zIndex: 20,
            padding: '3px 10px', borderRadius: 6,
            border: `1px solid ${showCommentPanel ? 'var(--accent)' : 'var(--border)'}`,
            background: showCommentPanel ? 'rgba(200,169,110,0.15)' : 'var(--bg-surface2)',
            color: showCommentPanel ? 'var(--accent)' : 'var(--text-tertiary)',
            cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit',
          }}
        >
          💬
        </button>

      <FloatingToolbar editor={editor} />
      {/* 代码块语言选择器（via CSS class注入，点击代码块时弹出） */}
      <style>{`
        .code-block-lowlight { position: relative; }
        .code-block-lowlight::before {
          content: attr(data-language);
          position: absolute; top: 10px; right: 44px;
          font-size: 11px; color: var(--text-tertiary);
          font-family: var(--font-mono, monospace);
          letter-spacing: 0.5px; pointer-events: none;
          text-transform: uppercase; opacity: 0.7;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <EditorContent editor={editor} style={{ flex: 1, overflow: 'auto', height: '100%' }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={async (e) => {
          e.preventDefault();
          if (!editor) return;
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
          for (const file of files) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              if (dataUrl) editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
            };
            reader.readAsDataURL(file);
          }
        }}
      />
      {/* AI Copilot 提示条 */}
      {(copilotSuggestion || copilotLoading) && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 20, zIndex: 50,
          background: 'rgba(20,18,30,0.92)', backdropFilter: 'blur(12px)',
          border: '0.5px solid rgba(200,169,110,0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          maxWidth: '70%', overflow: 'hidden',
        }}>
          {copilotLoading ? (
            <>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(200,169,110,0.3)', borderTopColor: '#c8a96e', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(200,169,110,0.6)' }}>AI 正在思考...</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, color: 'rgba(200,169,110,0.5)', flexShrink: 0 }}>✦</span>
              <span style={{ fontSize: 12.5, color: 'rgba(200,169,110,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{copilotSuggestion}</span>
              <kbd style={{ fontSize: 10, padding: '1px 5px', background: 'rgba(200,169,110,0.15)', border: '0.5px solid rgba(200,169,110,0.3)', borderRadius: 4, color: 'rgba(200,169,110,0.7)', flexShrink: 0, fontFamily: 'monospace' }}>Tab</kbd>
              <button onClick={() => setCopilotSuggestion('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
            </>
          )}
        </div>
      )}
      </div>

      {/* 评论面板 */}
      {showCommentPanel && (
        <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)' }}>
          <CommentPanel documentId={documentId} />
        </div>
      )}
    </div>
  );
};
