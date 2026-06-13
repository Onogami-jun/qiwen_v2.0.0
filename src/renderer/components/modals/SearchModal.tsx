import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setSearchOpen, openTab, setView } from '../../store/slices/appSlice';
import { ipc } from '../../utils/ipc';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  wordCount: number;
  updatedAt: number;
  isPinned: boolean;
  contentType: string;
  score?: number;
}

const RECENT_KEY = 'qiwen_recent_searches';
const MAX_RECENT = 8;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecent(q: string) {
  try {
    const prev = getRecent().filter(r => r !== q);
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
  } catch {}
}
function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
}

// 高亮匹配词
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim() || !text) return <>{text}</>;
  // 处理 FTS5 返回的 <mark> 标签
  if (text.includes('<mark>')) {
    const parts = text.split(/(<mark>.*?<\/mark>)/g);
    return (
      <>
        {parts.map((part, i) =>
          part.startsWith('<mark>') ? (
            <mark key={i} style={{ background: 'rgba(200,169,110,0.3)', color: 'var(--accent)', borderRadius: 2, padding: '0 1px' }}>
              {part.replace(/<\/?mark>/g, '')}
            </mark>
          ) : <span key={i}>{part}</span>
        )}
      </>
    );
  }
  // fallback: 手动高亮
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const regex = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ background: 'rgba(200,169,110,0.3)', color: 'var(--accent)', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
        ) : <span key={i}>{part}</span>
      )}
    </>
  );
};

const fmt = (ts: number) => {
  const d = Date.now() - ts;
  if (d < 3600000) return `${Math.floor(d / 60000) || 1} 分钟前`;
  if (d < 86400000) return '今天';
  if (d < 172800000) return '昨天';
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

export const SearchModal: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const searchOpen = useSelector((s: RootState) => s.app.searchOpen);
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'title' | 'content'>('all');
  const [ftsReady, setFtsReady] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [searchOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !activeWorkspaceId) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await ipc.invoke<SearchResult[]>('documents:search', {
        workspaceId: activeWorkspaceId,
        query: q.trim(),
        mode: 'fts',
      });
      let filtered = res || [];
      if (filter === 'title') {
        filtered = filtered.filter(r => r.title.toLowerCase().includes(q.toLowerCase()));
      } else if (filter === 'content') {
        filtered = filtered.filter(r => r.snippet && r.snippet.length > 5);
      }
      setResults(filtered);
      setSelectedIdx(0);
      setFtsReady(true);
    } catch (e: any) {
      // FTS 不可用时降级
      console.warn('[search] FTS error:', e);
      setFtsReady(false);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, filter]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => doSearch(query), 180);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const handleSelect = (doc: SearchResult) => {
    addRecent(query.trim());
    dispatch(openTab({ documentId: doc.id, title: doc.title }));
    dispatch(setView('workbench'));
    dispatch(setSearchOpen(false));
    setQuery('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { dispatch(setSearchOpen(false)); return; }
    const list = query ? results : [];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, list.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && list[selectedIdx]) handleSelect(list[selectedIdx]);
  };

  // 滚动确保选中项可见
  useEffect(() => {
    const el = resultsRef.current?.children[selectedIdx] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // 重建 FTS 索引
  const handleRebuildFts = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    await ipc.invoke('documents:rebuild-fts', { workspaceId: activeWorkspaceId }).catch(() => {});
    setFtsReady(true);
    setLoading(false);
    if (query) doSearch(query);
  };

  return (
    <AnimatePresence>
      {searchOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => dispatch(setSearchOpen(false))}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 500 }}
          />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.34, 1.2, 0.64, 1] }}
            style={{
              position: 'fixed', top: 140,
              left: '50%', transform: 'translateX(-50%)',
              width: 620, background: 'var(--bg-surface)',
              border: '0.5px solid var(--border-md)', borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 32px 96px rgba(0,0,0,0.65)', zIndex: 501,
            }}
          >
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '0.5px solid var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="搜索全文、标题、标签..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 15.5, color: 'var(--text-primary)', fontFamily: 'inherit',
                  caretColor: 'var(--accent)',
                }}
              />
              {loading && (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              )}
              {query && !loading && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
              )}
              <kbd style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-surface3)', padding: '3px 7px', borderRadius: 5, flexShrink: 0 }}>ESC</kbd>
            </div>

            {/* Filter tabs */}
            {query && (
              <div style={{ display: 'flex', gap: 2, padding: '8px 14px', borderBottom: '0.5px solid var(--border)' }}>
                {([['all', '全部'], ['title', '标题'], ['content', '正文']] as const).map(([f, label]) => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    background: filter === f ? 'rgba(200,169,110,0.15)' : 'transparent',
                    color: filter === f ? 'var(--accent)' : 'var(--text-tertiary)',
                    fontWeight: filter === f ? 500 : 400,
                  }}>{label}</button>
                ))}
                <div style={{ flex: 1 }} />
                {results.length > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                    找到 {results.length} 篇
                  </span>
                )}
              </div>
            )}

            {/* FTS not ready hint */}
            {!ftsReady && query && (
              <div style={{ padding: '10px 18px', background: 'rgba(232,200,122,0.06)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>全文索引未就绪，正在使用标题搜索</span>
                <button onClick={handleRebuildFts} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>重建索引</button>
              </div>
            )}

            {/* Results / Recent */}
            <div ref={resultsRef} style={{ maxHeight: 400, overflowY: 'auto', scrollbarWidth: 'none' }}>
              {/* Recent searches (no query) */}
              {!query && recent.length > 0 && (
                <div>
                  <div style={{ padding: '10px 18px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)' }}>最近搜索</span>
                    <button onClick={() => { clearRecent(); setRecent([]); }} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>清除</button>
                  </div>
                  {recent.map((r, i) => (
                    <div key={i} onClick={() => setQuery(r)} style={{ padding: '9px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.96"/></svg>
                      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!query && recent.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.2, marginBottom: 10 }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <div style={{ fontSize: 13.5, marginBottom: 4 }}>输入关键词搜索全文</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>支持中英文、多词搜索（空格分隔）</div>
                </div>
              )}

              {/* No results */}
              {query && !loading && results.length === 0 && (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 32, opacity: 0.15, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>未找到包含「{query}」的文档</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>试试更短的关键词，或切换搜索范围</div>
                </div>
              )}

              {/* Results */}
              {results.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  onClick={() => handleSelect(doc)}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.18 }}
                  style={{
                    padding: '11px 18px', cursor: 'pointer',
                    background: i === selectedIdx ? 'rgba(200,169,110,0.07)' : 'transparent',
                    borderLeft: `2px solid ${i === selectedIdx ? 'var(--accent)' : 'transparent'}`,
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {/* 文档类型图标 */}
                    <span style={{ fontSize: 13, opacity: 0.5, flexShrink: 0 }}>
                      {doc.contentType === 'markdown' ? '📄' : '📋'}
                    </span>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: i === selectedIdx ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      <Highlight text={doc.title || '无标题'} query={query} />
                    </div>
                    {doc.isPinned && <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>📌</span>}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmt(doc.updatedAt)}</span>
                  </div>
                  {doc.snippet && doc.snippet.length > 5 && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 21, lineHeight: 1.5 }}>
                      <Highlight text={doc.snippet} query={query} />
                    </div>
                  )}
                  {doc.wordCount > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.6, paddingLeft: 21, marginTop: 2 }}>
                      {doc.wordCount.toLocaleString()} 字
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '9px 18px', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>↑↓ 选择</span>
              <span>↵ 打开</span>
              <span>ESC 关闭</span>
              <div style={{ flex: 1 }} />
              <span style={{ opacity: 0.5 }}>由 SQLite FTS5 驱动</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
