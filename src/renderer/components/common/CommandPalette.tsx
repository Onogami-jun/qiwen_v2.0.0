/**
 * CommandPalette.tsx — 全局命令面板
 * v1.2.0: Cmd+K / Ctrl+K 触发
 * 支持：文档跳转、工作区切换、操作执行、AI 命令、设置导航
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setCommandPaletteOpen, openTab, setView } from '../../store/slices/appSlice';
import { ipc } from '../../utils/ipc';

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  category: 'document' | 'workspace' | 'action' | 'navigate' | 'ai';
  keywords?: string[];
  action: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  workspaceId: string;
  contentType: string;
  updatedAt: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  document: '文档', workspace: '工作区', action: '操作', navigate: '导航', ai: 'AI',
};

const CATEGORY_ORDER = ['document', 'action', 'navigate', 'workspace', 'ai'];

export const CommandPalette: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const open = useSelector((s: RootState) => s.app.commandPaletteOpen ?? false);
  const workspaces = useSelector((s: RootState) => s.workspaces.items);
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const settings = useSelector((s: RootState) => s.settings);

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [docResults, setDocResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 关闭
  const close = useCallback(() => {
    dispatch(setCommandPaletteOpen(false));
    setQuery('');
    setDocResults([]);
    setSelectedIdx(0);
  }, [dispatch]);

  // Cmd+K 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        dispatch(setCommandPaletteOpen(true));
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close, dispatch]);

  // 聚焦输入框
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // 全局文档搜索（防抖）
  useEffect(() => {
    if (!query.trim() || query.startsWith('>')) { setDocResults([]); return; }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await ipc.invoke<SearchResult[]>('documents:search-global', { query });
        setDocResults(results || []);
      } catch { setDocResults([]); }
      finally { setIsSearching(false); }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // 静态命令列表
  const staticCommands = useMemo((): Command[] => {
    const cmds: Command[] = [
      // 导航
      { id: 'nav-home', title: '回到主页', icon: '🏠', category: 'navigate', keywords: ['home', '首页'], action: () => { dispatch(setView('home')); close(); } },
      { id: 'nav-settings', title: '打开设置', icon: '⚙️', category: 'navigate', keywords: ['settings', '设置', 'preferences'], action: () => { dispatch(setView('settings')); close(); } },
      { id: 'nav-stats', title: '写作统计', icon: '📊', category: 'navigate', keywords: ['stats', '统计', 'writing'], action: () => { dispatch(setView('stats')); close(); } },
      { id: 'nav-graph', title: '关系图谱', icon: '🕸️', category: 'navigate', keywords: ['graph', '图谱', 'links'], action: () => { dispatch(setView('graph')); close(); } },
      { id: 'nav-templates', title: '模板库', icon: '📋', category: 'navigate', keywords: ['templates', '模板'], action: () => { dispatch(setView('templates')); close(); } },
      { id: 'nav-slides', title: '演示文稿', icon: '📽️', category: 'navigate', keywords: ['slides', '演示', 'ppt', 'presentation'], action: () => { dispatch(setView('slides')); close(); } },
      // 操作
      { id: 'action-new-doc', title: '新建文档', subtitle: '在当前工作区', icon: '📄', category: 'action', keywords: ['new', 'create', '新建', '创建'], action: () => { close(); window.dispatchEvent(new CustomEvent('qiwen:new-document')); } },
      { id: 'action-new-folder', title: '新建文件夹', icon: '📁', category: 'action', keywords: ['folder', '文件夹'], action: () => { close(); window.dispatchEvent(new CustomEvent('qiwen:new-folder')); } },
      { id: 'action-search', title: '全文搜索', icon: '🔍', category: 'action', keywords: ['search', '搜索', 'find'], action: () => { close(); window.dispatchEvent(new CustomEvent('qiwen:open-search')); } },
      { id: 'action-theme', title: `切换主题 (当前: ${settings?.theme === 'dark' ? '深色' : '浅色'})`, icon: '🌓', category: 'action', keywords: ['theme', '主题', 'dark', 'light'], action: () => { close(); window.dispatchEvent(new CustomEvent('qiwen:toggle-theme')); } },
      { id: 'action-rebuild-fts', title: '重建搜索索引', icon: '🔄', category: 'action', keywords: ['rebuild', 'index', '索引', '重建'], action: async () => { close(); await ipc.invoke('documents:rebuild-fts', {}); } },
      // 工作区切换
      ...workspaces.map(ws => ({
        id: `ws-${ws.id}`, title: `切换到 ${ws.name}`, subtitle: '工作区', icon: ws.icon || '📁',
        category: 'workspace' as const, keywords: [ws.name, '工作区', 'workspace'],
        action: () => { close(); window.dispatchEvent(new CustomEvent('qiwen:switch-workspace', { detail: { id: ws.id } })); },
      })),
      // AI 命令
      { id: 'ai-panel', title: '打开 AI 助手', icon: '🤖', category: 'ai', keywords: ['ai', 'copilot', '助手'], action: () => { dispatch(setView('ai')); close(); } },
      { id: 'ai-improve', title: 'AI 润色当前文档', icon: '✨', category: 'ai', keywords: ['improve', 'polish', '润色', '优化'], action: () => { close(); window.dispatchEvent(new CustomEvent('qiwen:ai-improve')); } },
      { id: 'ai-summarize', title: 'AI 总结当前文档', icon: '📝', category: 'ai', keywords: ['summarize', 'summary', '总结', '摘要'], action: () => { close(); window.dispatchEvent(new CustomEvent('qiwen:ai-summarize')); } },
    ];
    return cmds;
  }, [workspaces, settings, close, dispatch]);

  // 过滤命令
  const filteredCommands = useMemo(() => {
    const q = query.startsWith('>') ? query.slice(1).trim().toLowerCase() : query.toLowerCase();
    if (!q && !query.startsWith('>')) return staticCommands.slice(0, 8);
    return staticCommands.filter(cmd => {
      const searchIn = [cmd.title, cmd.subtitle || '', ...(cmd.keywords || [])].join(' ').toLowerCase();
      return q.split(' ').every(term => searchIn.includes(term));
    }).slice(0, 15);
  }, [query, staticCommands]);

  // 文档结果转命令
  const docCommands: Command[] = useMemo(() => docResults.slice(0, 8).map(r => ({
    id: `doc-${r.id}`, title: r.title, subtitle: r.snippet?.replace(/<[^>]+>/g, '') || '',
    icon: r.contentType === 'markdown' ? '📝' : '📄', category: 'document' as const,
    action: () => { dispatch(openTab({ documentId: r.id, title: r.title })); close(); },
  })), [docResults, dispatch, close]);

  // 合并并按 category 分组
  const allCommands = query.startsWith('>') ? filteredCommands : [...docCommands, ...filteredCommands];
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat, label: CATEGORY_LABELS[cat],
    items: allCommands.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0);

  // 扁平列表用于键盘导航
  const flatItems = grouped.flatMap(g => g.items);
  const totalItems = flatItems.length;

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => (i + 1) % totalItems); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => (i - 1 + totalItems) % totalItems); }
    else if (e.key === 'Enter') { e.preventDefault(); flatItems[selectedIdx]?.action(); }
    else if (e.key === 'Escape') close();
  };

  // 选中项滚动到视图内
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  let globalIdx = -1;

  return (
    <AnimatePresence>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={close}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ width: 620, maxHeight: '65vh', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          onClick={e => e.stopPropagation()}
        >
          {/* 搜索框 */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 10 }}>
            <span style={{ fontSize: 18, opacity: 0.5 }}>{isSearching ? '⏳' : '⌘'}</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入命令或搜索文档… (以 > 开头可执行操作)"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-primary)', fontFamily: 'inherit' }}
            />
            <kbd style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>ESC</kbd>
          </div>

          {/* 结果列表 */}
          <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
            {totalItems === 0 && query && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                未找到匹配的命令或文档
              </div>
            )}
            {grouped.map(group => (
              <div key={group.category}>
                <div style={{ padding: '6px 16px 2px', fontSize: 10.5, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {group.label}
                </div>
                {group.items.map(item => {
                  globalIdx++;
                  const idx = globalIdx;
                  const isSelected = selectedIdx === idx;
                  return (
                    <div
                      key={item.id}
                      data-idx={idx}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: 'pointer',
                        background: isSelected ? 'var(--accent-dim, rgba(200,169,110,0.12))' : 'transparent',
                        borderRadius: 6, margin: '1px 6px',
                        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: isSelected ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 底部提示 */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span><kbd style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px' }}>↑↓</kbd> 导航</span>
            <span><kbd style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px' }}>↵</kbd> 执行</span>
            <span>输入 <code style={{ background: 'var(--bg-surface2)', padding: '0 3px', borderRadius: 2 }}>&gt;</code> 过滤操作</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
