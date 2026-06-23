/**
 * VersionHistory.tsx
 * 文档版本历史面板 — 列出快照，可预览和回滚
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ipc } from '../../utils/ipc';

interface Version {
  id: string;
  document_id: string;
  content: string;
  title: string;
  word_count: number;
  created_at: number;
}

interface VersionHistoryProps {
  documentId: string;
  onRestore: (content: string, title: string) => void;
  onClose: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ documentId, onRestore, onClose }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'preview' | 'diff'>('preview');
  const currentDoc = useSelector((s: RootState) => s.documents.openDocuments[documentId]);

  // 简单 diff：按行对比
  const computeDiff = (oldHtml: string, newHtml: string) => {
    const stripTags = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const oldLines = stripTags(oldHtml).split(/\n+/).filter(Boolean);
    const newLines = stripTags(newHtml).split(/\n+/).filter(Boolean);
    const result: { type: 'same' | 'add' | 'remove'; text: string }[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const o = oldLines[i]; const n = newLines[i];
      if (o === n) result.push({ type: 'same', text: o || '' });
      else {
        if (o) result.push({ type: 'remove', text: o });
        if (n) result.push({ type: 'add', text: n });
      }
    }
    return result;
  };

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ipc.invoke<Version[]>('documents:versions', { id: documentId });
      setVersions(data || []);
      if (data?.length) setSelected(data[0]);
    } catch { }
    finally { setLoading(false); }
  }, [documentId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const fmt = (ts: number) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 880, height: 580, background: 'var(--bg-surface)',
        border: '0.5px solid var(--border-md)', borderRadius: 'var(--radius-xl)',
        display: 'flex', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* 左侧版本列表 */}
        <div style={{
          width: 220, flexShrink: 0, borderRight: '0.5px solid var(--border)',
          display: 'flex', flexDirection: 'column', background: 'var(--bg-surface2)',
        }}>
          <div style={{ padding: '16px 14px 12px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>版本历史</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
              最近 20 个版本
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
            {loading && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                加载中...
              </div>
            )}
            {!loading && versions.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                暂无版本记录
              </div>
            )}
            {versions.map((v, i) => (
              <div key={v.id}
                onClick={() => setSelected(v)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '0.5px solid var(--border)',
                  background: selected?.id === v.id ? 'var(--bg-active)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseOver={e => { if (selected?.id !== v.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseOut={e => { if (selected?.id !== v.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>
                  {i === 0 ? '当前版本' : `版本 ${versions.length - i}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(v.created_at)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {v.word_count.toLocaleString()} 字
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧预览 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px', borderBottom: '0.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                {selected?.title || '预览'}
              </div>
              {selected && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {fmt(selected.created_at)} · {selected.word_count.toLocaleString()} 字
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* 视图切换 */}
              <div style={{ display: 'flex', background: 'var(--bg-surface3)', borderRadius: 'var(--radius-md)', padding: 2, gap: 1 }}>
                {(['preview', 'diff'] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: viewMode === mode ? 'var(--bg-surface)' : 'transparent', color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' }}>
                    {mode === 'preview' ? '预览' : '对比'}
                  </button>
                ))}
              </div>
              {selected && (
                <button onClick={() => { navigator.clipboard.writeText(selected.content.replace(/<[^>]+>/g, '')); }}
                  style={{ height: 28, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  复制文本
                </button>
              )}
              {selected && (
                <button onClick={() => { if (window.confirm('确定要恢复到这个版本？当前内容将被覆盖。')) { onRestore(selected.content, selected.title); onClose(); } }}
                  style={{ height: 28, padding: '0 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500 }}>
                  恢复此版本
                </button>
              )}
              <button onClick={onClose} style={{ height: 28, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>关闭</button>
            </div>
          </div>

          {/* 内容预览 / Diff */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
            {!selected ? (
              <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 60, fontSize: 13 }}>选择左侧版本进行预览</div>
            ) : viewMode === 'preview' ? (
              <div className="preview-content" dangerouslySetInnerHTML={{ __html: selected.content }} style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }} />
            ) : (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                  <span style={{ color: 'var(--color-danger)' }}>● 删除</span> &nbsp; <span style={{ color: 'var(--color-success)' }}>● 新增</span> &nbsp; — 与当前文档对比
                </div>
                {computeDiff(selected.content, currentDoc?.content || '').map((line, i) => (
                  <div key={i} style={{
                    padding: '3px 12px', fontSize: 13.5, lineHeight: 1.7,
                    background: line.type === 'add' ? 'rgba(var(--color-success-rgb), 0.1)' : line.type === 'remove' ? 'rgba(var(--color-danger-rgb), 0.1)' : 'transparent',
                    borderLeft: `3px solid ${line.type === 'add' ? 'var(--color-success)' : line.type === 'remove' ? 'var(--color-danger)' : 'transparent'}`,
                    color: line.type === 'add' ? 'var(--color-success)' : line.type === 'remove' ? 'var(--color-danger)' : 'var(--text-secondary)',
                    marginBottom: 1,
                  }}>
                    <span style={{ opacity: 0.5, marginRight: 8, fontSize: 11, fontFamily: 'monospace' }}>{line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
