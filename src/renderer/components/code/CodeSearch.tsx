/**
 * CodeSearch.tsx — 代码跨文件全局搜索
 * src/renderer/components/code/CodeSearch.tsx
 *
 * 功能：
 * - 在已打开的项目文件夹里全文搜索
 * - 关键词高亮、显示行号和上下文
 * - 点击结果跳转到对应文件和行
 * - 支持大小写/正则切换
 */
import React, { useState, useCallback, useRef } from 'react';
import { ipc } from '../../utils/ipc';

interface SearchResult {
  filePath: string;
  fileName: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

interface Props {
  rootPath: string | null;
  onOpenFile: (filePath: string, line?: number) => void;
}

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'target', 'vendor']);
const MAX_RESULTS = 200;
const MAX_FILE_SIZE = 500 * 1024; // 500KB

export const CodeSearch: React.FC<Props> = ({ rootPath, onOpenFile }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchCount, setSearchCount] = useState({ files: 0, matches: 0 });
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const abortRef = useRef(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !rootPath) { setResults([]); return; }
    setSearching(true);
    abortRef.current = false;
    setResults([]);
    setSearchCount({ files: 0, matches: 0 });

    let pattern: RegExp;
    try {
      pattern = useRegex
        ? new RegExp(q, caseSensitive ? 'g' : 'gi')
        : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    } catch { setSearching(false); return; }

    const allResults: SearchResult[] = [];
    let fileCount = 0;

    const searchDir = async (dirPath: string) => {
      if (abortRef.current || allResults.length >= MAX_RESULTS) return;
      try {
        const entries = await ipc.invoke<{ name: string; isDir: boolean; path: string }[]>('fs:list-dir', { path: dirPath });
        for (const entry of entries || []) {
          if (abortRef.current || allResults.length >= MAX_RESULTS) break;
          if (entry.isDir) {
            if (!IGNORE_DIRS.has(entry.name)) await searchDir(entry.path);
          } else {
            const ext = entry.name.split('.').pop()?.toLowerCase() || '';
            const codeExts = ['ts','tsx','js','jsx','py','go','rs','java','cpp','c','cs','rb','swift','kt','php','md','json','yaml','yml','sql','sh','html','css','scss','vue','svelte','xml','toml'];
            if (!codeExts.includes(ext)) continue;
            try {
              const res = await ipc.invoke<{ content: string; error?: string }>('fs:read-file', { path: entry.path });
              if (res.error || !res.content || res.content.length > MAX_FILE_SIZE) continue;
              const lines = res.content.split('\n');
              let fileMatched = false;
              pattern.lastIndex = 0;
              for (let i = 0; i < lines.length; i++) {
                pattern.lastIndex = 0;
                const match = pattern.exec(lines[i]);
                if (match) {
                  allResults.push({
                    filePath: entry.path,
                    fileName: entry.name,
                    line: i + 1,
                    content: lines[i].trim(),
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length,
                  });
                  if (!fileMatched) { fileCount++; fileMatched = true; }
                  if (allResults.length >= MAX_RESULTS) break;
                }
              }
            } catch {}
          }
        }
      } catch {}
    };

    await searchDir(rootPath);
    setResults(allResults);
    setSearchCount({ files: fileCount, matches: allResults.length });
    setSearching(false);

    // 默认展开所有文件
    const files = new Set(allResults.map(r => r.filePath));
    setExpandedFiles(files);
  }, [rootPath, caseSensitive, useRegex]);

  // 防抖搜索
  const debounceRef = useRef<any>(null);
  const handleQueryChange = (q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); abortRef.current = true; return; }
    debounceRef.current = setTimeout(() => search(q), 300);
  };

  // 按文件分组
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!grouped.has(r.filePath)) grouped.set(r.filePath, []);
    grouped.get(r.filePath)!.push(r);
  }

  const highlightLine = (content: string, matchStart: number, matchEnd: number, q: string) => {
    if (!q) return <span>{content}</span>;
    const start = Math.max(0, matchStart - 30);
    const preview = content.slice(start, start + 120);
    const adjStart = matchStart - start;
    const adjEnd = matchEnd - start;
    return (
      <span style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
        {preview.slice(0, adjStart)}
        <mark style={{ background: '#c8a96e44', color: '#c8a96e', borderRadius: 2 }}>{preview.slice(adjStart, adjEnd)}</mark>
        {preview.slice(adjEnd)}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#161616' }}>
      {/* 搜索框 */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <input
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder={rootPath ? '在项目中搜索…' : '请先打开文件夹'}
            disabled={!rootPath}
            style={{ width: '100%', padding: '7px 10px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 7, color: '#e0e0d8', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
          {searching && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#888' }}>搜索中…</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ label: 'Aa', title: '区分大小写', active: caseSensitive, toggle: () => { setCaseSensitive(v => !v); if (query) search(query); } },
            { label: '.*', title: '正则表达式', active: useRegex, toggle: () => { setUseRegex(v => !v); if (query) search(query); } }
          ].map(opt => (
            <button key={opt.label} onClick={opt.toggle} title={opt.title}
              style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${opt.active ? '#c8a96e' : '#333'}`, background: opt.active ? '#c8a96e22' : 'transparent', color: opt.active ? '#c8a96e' : '#666', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
              {opt.label}
            </button>
          ))}
          {results.length > 0 && (
            <span style={{ fontSize: 10.5, color: '#555', marginLeft: 'auto', alignSelf: 'center' }}>
              {searchCount.matches} 个结果，{searchCount.files} 个文件
              {searchCount.matches >= MAX_RESULTS && ' (已截断)'}
            </span>
          )}
        </div>
      </div>

      {/* 结果列表 */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {!rootPath && (
          <div style={{ padding: 24, textAlign: 'center', color: '#444', fontSize: 12 }}>先打开一个文件夹</div>
        )}
        {rootPath && !query && (
          <div style={{ padding: 24, textAlign: 'center', color: '#444', fontSize: 12 }}>输入关键词开始搜索</div>
        )}
        {query && !searching && results.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#444', fontSize: 12 }}>未找到「{query}」</div>
        )}
        {Array.from(grouped.entries()).map(([filePath, fileResults]) => {
          const isExpanded = expandedFiles.has(filePath);
          const relPath = rootPath ? filePath.replace(rootPath, '').replace(/^[/\\]/, '') : filePath;
          return (
            <div key={filePath}>
              {/* 文件头 */}
              <div
                onClick={() => setExpandedFiles(prev => {
                  const next = new Set(prev);
                  if (next.has(filePath)) next.delete(filePath); else next.add(filePath);
                  return next;
                })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', cursor: 'pointer', background: '#1a1a1a', borderBottom: '1px solid #222', userSelect: 'none' }}>
                <span style={{ fontSize: 9, color: '#555' }}>{isExpanded ? '▼' : '▶'}</span>
                <span style={{ fontSize: 12, color: '#c8a96e', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{relPath}</span>
                <span style={{ fontSize: 10.5, color: '#555', flexShrink: 0 }}>{fileResults.length}</span>
              </div>
              {/* 匹配行 */}
              {isExpanded && fileResults.map((r, i) => (
                <div key={i}
                  onClick={() => onOpenFile(r.filePath, r.line)}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 10px 4px 20px', cursor: 'pointer', borderBottom: '1px solid #1a1a1a' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#252525')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 10.5, color: '#555', width: 32, flexShrink: 0, textAlign: 'right' }}>{r.line}</span>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#a0a098' }}>
                    {highlightLine(r.content, r.matchStart, r.matchEnd, query)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
