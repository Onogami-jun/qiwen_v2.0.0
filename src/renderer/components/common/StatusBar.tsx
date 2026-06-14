import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setFindOpen, setWordGoal } from '../../store/slices/editorSlice';
import { ipc } from '../../utils/ipc';
import { SyncStatusBar } from './SyncStatusBar';

// ── Pomodoro ───────────────────────────────────────────────
type PomState = 'idle' | 'running' | 'paused' | 'break';

const FMT_TIME = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const PomodoroWidget: React.FC<{ documentId?: string; workspaceId?: string | null }> = ({ documentId, workspaceId }) => {
  const WORK = 25 * 60;
  const SHORT_BREAK = 5 * 60;

  const [state, setState] = useState<PomState>('idle');
  const [remaining, setRemaining] = useState(WORK);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rounds, setRounds] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };

  const start = useCallback(async () => {
    if (!workspaceId) return;
    const isBreak = state === 'break';
    const duration = isBreak ? SHORT_BREAK : WORK;
    const res = await ipc.invoke('pomodoro:start', { documentId: documentId || null, workspaceId, duration }).catch(() => null);
    if (res?.id) setSessionId(res.id);
    setState('running');
    setRemaining(duration);
    clearTimer();
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearTimer();
          setState(isBreak ? 'idle' : 'break');
          if (!isBreak) setRounds(n => n + 1);
          ipc.invoke('pomodoro:end', { id: res?.id, completed: true }).catch(() => {});
          // 浏览器通知
          if (Notification.permission === 'granted') {
            new Notification(isBreak ? '☕ 休息结束，继续专注！' : '🍅 专注完成！休息一下', { silent: false });
          }
          return isBreak ? WORK : SHORT_BREAK;
        }
        return r - 1;
      });
    }, 1000);
  }, [workspaceId, documentId, state]);

  const pause = () => {
    clearTimer();
    setState('paused');
  };

  const resume = () => {
    setState('running');
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearTimer(); setState('idle'); return WORK; }
        return r - 1;
      });
    }, 1000);
  };

  const stop = async () => {
    clearTimer();
    if (sessionId) await ipc.invoke('pomodoro:end', { id: sessionId, completed: false }).catch(() => {});
    setState('idle');
    setRemaining(WORK);
    setSessionId(null);
  };

  const loadStats = useCallback(async () => {
    if (!workspaceId) return;
    const s = await ipc.invoke('pomodoro:stats', { workspaceId, days: 7 }).catch(() => null);
    if (s) setStats(s);
  }, [workspaceId]);

  useEffect(() => {
    if (showPanel) loadStats();
  }, [showPanel, loadStats]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  // 请求通知权限
  useEffect(() => {
    if (Notification.permission === 'default') Notification.requestPermission();
  }, []);

  // 点击外部关闭
  useEffect(() => {
    if (!showPanel) return;
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setShowPanel(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPanel]);

  const isWork = state === 'running' || state === 'paused';
  const isBreakState = state === 'break';
  const pct = isWork ? (1 - remaining / WORK) * 100 : isBreakState ? (1 - remaining / SHORT_BREAK) * 100 : 0;
  const color = isWork ? 'var(--accent)' : isBreakState ? '#52c97a' : 'var(--text-tertiary)';

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Status bar item */}
      <div onClick={() => setShowPanel(v => !v)} title="番茄钟" style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px', height: '100%',
        cursor: 'pointer', borderRadius: 3, transition: 'background 0.1s',
        background: showPanel ? 'var(--bg-surface2)' : 'transparent',
        color,
      }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface2)'}
        onMouseLeave={e => { if (!showPanel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {/* Mini arc */}
        <svg width="13" height="13" viewBox="0 0 13 13">
          <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="var(--border)" strokeWidth="1.5" />
          {pct > 0 && <circle cx="6.5" cy="6.5" r="5" fill="none" stroke={color} strokeWidth="1.5"
            strokeDasharray={`${pct * 0.314} 31.4`} strokeLinecap="round"
            transform="rotate(-90 6.5 6.5)" />}
          <text x="6.5" y="9" textAnchor="middle" fontSize="5" fill={color} fontFamily="monospace">
            {state === 'idle' ? '🍅' : ''}
          </text>
        </svg>
        <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
          {state === 'idle' ? '番茄钟' : FMT_TIME(remaining)}
        </span>
        {rounds > 0 && <span style={{ fontSize: 10, opacity: 0.6 }}>×{rounds}</span>}
      </div>

      {/* Panel */}
      {showPanel && (
        <div style={{
          position: 'absolute', bottom: 28, right: 0, zIndex: 500,
          width: 280, background: 'var(--bg-surface)',
          border: '0.5px solid var(--border-md)', borderRadius: 12,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.35)', overflow: 'hidden',
        }}>
          {/* Timer face */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
              {state === 'break' ? '☕ 休息中' : state === 'idle' ? '准备好了吗？' : '🍅 专注中'}
            </div>
            {/* Arc */}
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ margin: '0 auto', display: 'block' }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bg-surface3)" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={`${pct * 2.765} 276.5`} strokeLinecap="round"
                transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1s linear' }} />
              <text x="50" y="58" textAnchor="middle" fontSize="22" fill="var(--text-primary)" fontFamily="monospace" fontWeight="600">
                {FMT_TIME(remaining)}
              </text>
            </svg>
            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
              {state === 'idle' || state === 'break' ? (
                <button onClick={start} style={{ padding: '6px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#1a1408', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {state === 'break' ? '开始休息' : '开始专注'}
                </button>
              ) : state === 'running' ? (
                <>
                  <button onClick={pause} style={{ padding: '6px 16px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>暂停</button>
                  <button onClick={stop} style={{ padding: '6px 16px', borderRadius: 8, border: '0.5px solid rgba(255,100,100,0.3)', background: 'rgba(255,100,100,0.08)', color: '#ff6b6b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>放弃</button>
                </>
              ) : (
                <>
                  <button onClick={resume} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#1a1408', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>继续</button>
                  <button onClick={stop} style={{ padding: '6px 16px', borderRadius: 8, border: '0.5px solid rgba(255,100,100,0.3)', background: 'rgba(255,100,100,0.08)', color: '#ff6b6b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>放弃</button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-tertiary)', marginBottom: 8 }}>本周统计</div>
            {stats ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'var(--bg-surface2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)' }}>{stats.totalCompleted}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>已完成</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'var(--bg-surface2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round((stats.totalSeconds || 0) / 3600 * 10) / 10}h</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>专注时长</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'var(--bg-surface2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{rounds}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>今日</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>暂无数据</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── StatusBar ──────────────────────────────────────────────
export const StatusBar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { cursorLine, cursorCol, wordCount, charCount, selectionLength, readingTime, completionPercent, wordGoal } = useSelector((s: RootState) => s.editor);
  const { isLocalMode, user } = useSelector((s: RootState) => (s as any).auth);
  const activeTabId = useSelector((s: RootState) => s.app.activeTabId);
  const tabs = useSelector((s: RootState) => s.app.tabs);
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const activeView = useSelector((s: RootState) => s.app.activeView);
  const [editGoal, setEditGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(wordGoal));

  const activeTab = tabs.find(t => t.id === activeTabId);

  const item = (content: React.ReactNode, title?: string, onClick?: () => void) => (
    <div title={title} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', height: '100%',
      cursor: onClick ? 'pointer' : 'default', borderRadius: 3,
      transition: 'background 0.1s', whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface2)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {content}
    </div>
  );

  return (
    <div style={{
      height: 24, borderTop: '0.5px solid var(--border)',
      display: 'flex', alignItems: 'center',
      background: 'var(--bg-surface)', fontSize: 11, color: 'var(--text-tertiary)',
      flexShrink: 0, position: 'relative', zIndex: 10, overflow: 'hidden',
    }}>
      {/* 左侧 */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: 4 }}>
        {item(
          <><div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-success)' }} />Markdown</>,
          '文档格式'
        )}
        {item('UTF-8', '文件编码')}
        {item(
          <><span>第 {cursorLine} 行</span><span style={{ opacity: 0.5 }}>，</span><span>第 {cursorCol} 列</span></>,
          '光标位置'
        )}
        {selectionLength > 0 && item(
          <span style={{ color: 'var(--accent)' }}>已选 {selectionLength} 字</span>,
          '选中字符数'
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* 右侧 */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingRight: 4 }}>
        {/* 字数统计 */}
        {wordCount > 0 && item(
          <span>{wordCount.toLocaleString()} 字</span>,
          `共 ${charCount.toLocaleString()} 字符 · 预计阅读 ${readingTime} 分钟`
        )}

        {/* 字数目标 */}
        {editGoal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px' }}>
            <input
              autoFocus
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onBlur={() => { const v = parseInt(goalInput); if (v > 0) dispatch(setWordGoal(v)); setEditGoal(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(goalInput); if (v > 0) dispatch(setWordGoal(v)); setEditGoal(false); } if (e.key === 'Escape') setEditGoal(false); }}
              style={{ width: 60, height: 16, fontSize: 11, background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '0 4px', outline: 'none', fontFamily: 'inherit' }}
            />
            <span>字目标</span>
          </div>
        ) : item(
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--bg-surface3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, completionPercent)}%`, background: completionPercent >= 100 ? '#52c97a' : 'var(--accent)', transition: 'width 0.5s', borderRadius: 2 }} />
            </div>
            <span>{completionPercent}%</span>
          </div>,
          `写作目标：${wordCount.toLocaleString()} / ${wordGoal.toLocaleString()} 字（点击修改目标）`,
          () => { setGoalInput(String(wordGoal)); setEditGoal(true); }
        )}

        {/* 查找 */}
        {item(
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
          '查找与替换 Ctrl+F',
          () => dispatch(setFindOpen(true))
        )}

        {/* 阅读时长 */}
        {readingTime > 0 && item(
          <span>约 {readingTime} 分钟读完</span>,
          '预计阅读时长'
        )}

        {/* 番茄钟 */}
        <PomodoroWidget
          documentId={activeTab?.documentId}
          workspaceId={activeWorkspaceId}
        />

        {/* 账号状态 */}
        {item(
          <><div style={{ width: 5, height: 5, borderRadius: '50%', background: isLocalMode ? 'var(--color-warning)' : 'var(--color-success)' }} />{isLocalMode ? '本地模式' : user?.plan === 'PRO' ? '专业版' : '免费版'}</>,
          isLocalMode ? '数据存储在本地' : `登录账号：${user?.displayName}`
        )}

        {/* 云同步状态 */}
        {!isLocalMode && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', height: '100%' }}>
            <SyncStatusBar />
          </div>
        )}
      </div>
    </div>
  );
};
