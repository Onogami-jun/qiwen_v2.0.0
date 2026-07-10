import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setRightPanelTab, toggleRightPanel } from '../../store/slices/appSlice';
import { PluginSidebarPanel } from '../../plugins/PluginSidebarPanel';
import { ipc } from '../../utils/ipc';
import { openTab, setView } from '../../store/slices/appSlice';

interface RightPanelProps {
  documentId?: string;
}

const LinkItem: React.FC<{ doc: any; dispatch: any }> = ({ doc, dispatch }) => {
  const fmt = (ts: number) => {
    const d = Date.now() - ts;
    if (d < 3600000) return `${Math.floor(d / 60000)} 分钟前`;
    if (d < 86400000) return '今天';
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };
  return (
    <div onClick={() => { dispatch(openTab({ documentId: doc.id, title: doc.title })); dispatch(setView('workbench')); }}
      style={{ padding: '7px 9px', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: 3 }}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{doc.title || '无标题'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(doc.updatedAt)}{doc.wordCount > 0 ? ` · ${doc.wordCount.toLocaleString()} 字` : ''}</div>
    </div>
  );
};

export const RightPanel: React.FC<RightPanelProps> = React.memo(({ documentId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { rightPanelTab } = useSelector((s: RootState) => s.app);
  const { wordCount, charCount, completionPercent, readingTime, wordGoal } = useSelector((s: RootState) => s.editor);
  const doc = useSelector((s: RootState) => documentId ? s.documents.openDocuments[documentId] : null);

  // Parse outline from doc content
  const outline = React.useMemo(() => {
    if (!doc?.content) return [];
    return doc.content.split('\n')
      .filter(l => l.startsWith('#'))
      .map(l => ({
        level: l.match(/^#+/)?.[0].length || 1,
        text: l.replace(/^#+\s*/, '').trim(),
      }))
      .slice(0, 20);
  }, [doc?.content]);

  const TABS = [
    { id: 'outline', label: '大纲' },
    { id: 'links',   label: '链接' },
    { id: 'stats',   label: '统计' },
    { id: 'plugins', label: '插件' },
    { id: 'ai',      label: 'AI' },
  ] as const;

  // 双向链接
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const [backlinks, setBacklinks] = React.useState<any[]>([]);
  const [outlinks, setOutlinks] = React.useState<any[]>([]);
  const [linksLoading, setLinksLoading] = React.useState(false);
  React.useEffect(() => {
    if (rightPanelTab !== 'links' || !documentId || !activeWorkspaceId) return;
    setLinksLoading(true);
    Promise.all([
      ipc.invoke('documents:backlinks', { documentId, workspaceId: activeWorkspaceId }).catch(() => []),
      ipc.invoke('documents:outlinks', { documentId, workspaceId: activeWorkspaceId }).catch(() => []),
    ]).then(([bl, ol]) => { setBacklinks(bl || []); setOutlinks(ol || []); setLinksLoading(false); });
  }, [rightPanelTab, documentId, activeWorkspaceId]);

  return (
    <div style={{
      width: 260, borderLeft: '0.5px solid var(--border)',
      background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', flexShrink: 0, height: '100%',
    }}>
      {/* Tabs + 关闭按钮 */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', flexShrink: 0, alignItems: 'center' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => dispatch(setRightPanelTab(tab.id as any))}
            style={{
              flex: 1, padding: '10px 0', fontSize: 11.5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: rightPanelTab === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${rightPanelTab === tab.id ? 'var(--accent)' : 'transparent'}`,
              transition: 'all var(--dur-base) var(--ease-smooth)', letterSpacing: 0.2,
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        ))}
        {/* 关闭按钮 */}
        <button
          onClick={() => dispatch(toggleRightPanel())}
          title="关闭面板"
          style={{
            width: 28, height: 28, flexShrink: 0, marginRight: 4,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-tertiary)', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: rightPanelTab === 'ai' ? 'hidden' : 'auto', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column' }}>

        {/* OUTLINE */}
        {rightPanelTab === 'outline' && (
          <div style={{ padding: 16 }}>
            {outline.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                暂无标题结构<br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>使用 # 号创建标题</span>
              </div>
            ) : outline.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: `5px ${8 + (item.level - 1) * 12}px`,
                borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13,
                color: item.level === 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: item.level === 1 ? 500 : 400,
                transition: 'background 0.15s',
              }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: item.level === 1 ? 6 : 4,
                  height: item.level === 1 ? 6 : 4,
                  borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
                  opacity: item.level === 1 ? 1 : 0.5,
                }} />
                {item.text}
              </div>
            ))}
          </div>
        )}

        {/* LINKS */}
        {rightPanelTab === 'links' && (
          <div style={{ padding: 16 }}>
            {linksLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>加载中...</div>
            ) : (
              <>
                {/* 出链 */}
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  本文引用 ({outlinks.length})
                </div>
                {outlinks.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0 16px', opacity: 0.7 }}>
                    使用 [[文档名]] 创建链接
                  </div>
                ) : outlinks.map((d: any) => (
                  <LinkItem key={d.id} doc={d} dispatch={dispatch} />
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                {/* 反向链接 */}
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  被引用于 ({backlinks.length})
                </div>
                {backlinks.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0', opacity: 0.7 }}>暂无反向引用</div>
                ) : backlinks.map((d: any) => (
                  <LinkItem key={d.id} doc={d} dispatch={dispatch} />
                ))}
              </>
            )}
          </div>
        )}

        {/* STATS */}
        {rightPanelTab === 'stats' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: '字符数', value: charCount.toLocaleString() },
                { label: '词语数', value: wordCount.toLocaleString() },
                { label: '段落数', value: doc?.content?.split('\n\n').filter(Boolean).length || 0 },
                { label: '阅读时长', value: `${readingTime} min` },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--bg-surface2)', borderRadius: 'var(--radius-md)', padding: '12px',
                  border: '0.5px solid var(--border)',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: -0.5 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Progress ring */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 8px' }}>
              <div style={{ position: 'relative', width: 84, height: 84 }}>
                <svg width="84" height="84" viewBox="0 0 84 84">
                  <circle cx="42" cy="42" r="33" fill="none" stroke="var(--bg-surface3)" strokeWidth="7" />
                  <circle
                    cx="42" cy="42" r="33" fill="none"
                    stroke="url(#rg)" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray="207.3"
                    strokeDashoffset={207.3 * (1 - completionPercent / 100)}
                    transform="rotate(-90 42 42)"
                    style={{ transition: 'stroke-dashoffset 1s var(--ease-smooth)' }}
                  />
                  <defs>
                    <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--accent)" />
                      <stop offset="100%" stopColor="#e8c98e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 19, fontWeight: 300, color: 'var(--text-primary)' }}>{completionPercent}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>完成度</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              目标 {wordGoal.toLocaleString()} 字 · 已写 {wordCount.toLocaleString()} 字
            </div>
          </div>
        )}

        {/* PLUGINS */}
        {rightPanelTab === 'plugins' && (
          <PluginSidebarPanel documentContent={doc?.content ?? ''} />
        )}

        {/* AI */}
{/* AIPanel removed — use ChatPanel in the panel grid instead */}
      </div>
    </div>
  );
});
