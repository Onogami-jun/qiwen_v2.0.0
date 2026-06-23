/**
 * SlashCommand.tsx
 * 输入 "/" 后弹出快速插入菜单，类似 Notion/WPS 的斜杠命令
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

/* ── 命令定义 ─────────────────────────────────────── */
interface SlashCommand {
  title: string;
  description: string;
  icon: string;
  shortcut?: string;
  command: (editor: any) => void;
}

const COMMANDS: SlashCommand[] = [
  // 文本格式
  { title: '正文', description: '普通段落文本', icon: '¶',
    command: e => e.chain().focus().setParagraph().run() },
  { title: '标题 1', description: '大标题', icon: 'H1', shortcut: '#',
    command: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: '标题 2', description: '中标题', icon: 'H2', shortcut: '##',
    command: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: '标题 3', description: '小标题', icon: 'H3', shortcut: '###',
    command: e => e.chain().focus().toggleHeading({ level: 3 }).run() },
  // 列表
  { title: '无序列表', description: '项目符号列表', icon: '•', shortcut: '-',
    command: e => e.chain().focus().toggleBulletList().run() },
  { title: '有序列表', description: '编号列表', icon: '1.', shortcut: '1.',
    command: e => e.chain().focus().toggleOrderedList().run() },
  { title: '待办列表', description: '可勾选的任务清单', icon: '☑', shortcut: '[]',
    command: e => e.chain().focus().toggleTaskList().run() },
  // 块元素
  { title: '引用块', description: '引用或高亮内容', icon: '❝', shortcut: '>',
    command: e => e.chain().focus().toggleBlockquote().run() },
  { title: '代码块', description: '多行代码，支持语法高亮', icon: '</>', shortcut: '```',
    command: e => e.chain().focus().toggleCodeBlock().run() },
  { title: '行内公式', description: 'LaTeX 行内数学公式 $...$', icon: 'Σ',
    command: e => e.chain().focus().insertContent('$formula$').run() },
  { title: '块级公式', description: 'LaTeX 独立数学公式块 $$...$$', icon: '∫',
    command: e => e.chain().focus().insertContent('$$\n\n$$').run() },
  { title: '分割线', description: '水平分隔线', icon: '─', shortcut: '---',
    command: e => e.chain().focus().setHorizontalRule().run() },
  // 插入
  { title: '表格', description: '插入 3×3 表格', icon: '⊞',
    command: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: '图片', description: '从 URL 插入图片', icon: '🖼',
    command: e => {
      const url = window.prompt('图片 URL：');
      if (url) e.chain().focus().setImage({ src: url }).run();
    }
  },
];

/* ── 命令列表 UI ──────────────────────────────────── */
interface CommandListProps {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
}

const CommandList = React.forwardRef<{ onKeyDown: (e: KeyboardEvent) => boolean }, CommandListProps>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);

    React.useImperativeHandle(ref, () => ({
      onKeyDown({ event }: any) {
        if (event.key === 'ArrowUp') {
          setSelected(s => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelected(s => (s + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[selected];
          if (item) { command(item); return true; }
        }
        return false;
      },
    }));

    useEffect(() => setSelected(0), [items]);

    if (!items.length) return null;

    return (
      <div style={{
        background: 'var(--bg-surface2)',
        border: '0.5px solid var(--border-md)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        padding: '6px 0',
        width: 260,
        maxHeight: 320,
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}>
        {items.map((item, i) => (
          <button
            key={item.title}
            onClick={() => command(item)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px', border: 'none', textAlign: 'left',
              background: i === selected ? 'var(--bg-hover)' : 'transparent',
              cursor: 'pointer', transition: 'background 0.1s', fontFamily: 'inherit',
            }}
            onMouseEnter={() => setSelected(i)}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0,
              background: 'var(--bg-surface3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
              fontFamily: 'monospace',
            }}>{item.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{item.description}</div>
            </div>
            {item.shortcut && (
              <kbd style={{
                fontSize: 10, color: 'var(--text-tertiary)',
                background: 'var(--bg-surface3)', borderRadius: 'var(--radius-sm)',
                padding: '1px 5px', fontFamily: 'monospace', flexShrink: 0,
              }}>{item.shortcut}</kbd>
            )}
          </button>
        ))}
      </div>
    );
  }
);

CommandList.displayName = 'CommandList';

/* ── Tiptap Extension ─────────────────────────────── */
export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command(editor, range);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase().trim();
          if (!q) return COMMANDS;
          return COMMANDS.filter(c =>
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            (c.shortcut && c.shortcut.includes(q))
          );
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: any = null;

          return {
            onStart(props: any) {
              component = new ReactRenderer(CommandList, {
                props: {
                  ...props,
                  command: (item: SlashCommand) => {
                    props.command({ command: (editor: any, range: any) => {
                      editor.chain().focus().deleteRange(range).run();
                      item.command(editor);
                    }});
                    popup?.[0]?.hide();
                  },
                },
                editor: props.editor,
              });

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'slash-menu',
                arrow: false,
                offset: [0, 8],
              });
            },

            onUpdate(props: any) {
              component?.updateProps(props);
              if (!props.clientRect) return;
              popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
            },

            onKeyDown(props: any) {
              if (props.event.key === 'Escape') { popup?.[0]?.hide(); return true; }
              return (component?.ref as any)?.onKeyDown(props) ?? false;
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommandExtension;
