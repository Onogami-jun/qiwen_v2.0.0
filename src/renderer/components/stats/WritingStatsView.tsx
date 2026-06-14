import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ipc } from '../../utils/ipc';

// ── Types ──────────────────────────────────────────────────
interface DayStats { date: string; words: number; docs: number; pomodoros: number; }
interface PomStats { totalCompleted: number; totalSeconds: number; byDocument: { documentId: string; title: string; count: number; seconds: number }[]; byDay: { dayBucket: number; count: number }[]; }

// ── Helpers ────────────────────────────────────────────────
const fmtTime = (s: number) => {
  if (s < 60) return `${s}秒`;
  if (s < 3600) return `${Math.floor(s / 60)}分钟`;
  return `${(s / 3600).toFixed(1)}小时`;
};

// ── GitHub-style heatmap ───────────────────────────────────
const Heatmap: React.FC<{ data: DayStats[] }> = ({ data }) => {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);

  const map: Record<string, DayStats> = {};
  data.forEach(d => { map[d.date] = d; });

  const weeks: { date: string; words: number }[][] = [];
  let cur = new Date(startDate);
  const dow = cur.getDay();
  cur.setDate(cur.getDate() - (dow === 0 ? 6 : dow - 1));

  for (let w = 0; w < 53; w++) {
    const week: { date: string; words: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const key = cur.toISOString().slice(0, 10);
      week.push({ date: key, words: map[key]?.words || 0 });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const maxWords = data.length > 0 ? Math.max(...data.map(d => d.words), 1) : 1;
  const getColor = (words: number) => {
    if (words === 0) return 'rgba(255,255,255,0.04)';
    const pct = words / maxWords;
    if (pct < 0.15) return 'rgba(200,169,110,0.2)';
    if (pct < 0.35) return 'rgba(200,169,110,0.4)';
    if (pct < 0.65) return 'rgba(200,169,110,0.65)';
    if (pct < 0.85) return 'rgba(200,169,110,0.85)';
    return '#c8a96e';
  };

  const monthLabels: { label: string; x: number }[] = [];
  weeks.forEach((week, wi) => {
    if (wi === 0 || new Date(week[0].date).getDate() <= 7) {
      const m = new Date(week[0].date).toLocaleDateString('zh-CN', { month: 'short' });
      if (wi === 0 || monthLabels[monthLabels.length - 1]?.label !== m) {
        monthLabels.push({ label: m, x: wi });
      }
    }
  });

  const CELL = 11; const GAP = 2; const W = (CELL + GAP);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <svg width={weeks.length * W + 30} height={7 * W + 24} style={{ display: 'block' }}>
        {monthLabels.map(({ label, x }) => (
          <text key={label + x} x={30 + x * W} y={10} fontSize={10} fill="var(--text-tertiary)" fontFamily="inherit">{label}</text>
        ))}
        {['一', '三', '五'].map((d, i) => (
          <text key={d} x={0} y={16 + (i * 2 + 1) * W - 1} fontSize={9} fill="var(--text-tertiary)" fontFamily="inherit">{d}</text>
        ))}
        {weeks.map((week, wi) => week.map((day, di) => (
          <rect key={day.date} x={30 + wi * W} y={16 + di * W} width={CELL} height={CELL} rx={2}
            fill={getColor(day.words)}
            style={{ cursor: day.words > 0 ? 'pointer' : 'default' }}>
            <title>{day.date}: {day.words.toLocaleString()} 字</title>
          </rect>
        )))}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 10.5, color: 'var(--text-tertiary)' }}>
        <span>少</span>
        {[0, 0.2, 0.4, 0.65, 1].map((pct, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: getColor(pct * maxWords + (pct > 0 ? 1 : 0)) }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
};

// ── Bar chart (mini) ───────────────────────────────────────
const MiniBar: React.FC<{ data: { label: string; value: number }[]; color?: string; unit?: string }> = ({ data, color = '#c8a96e', unit = '' }) => {
  const max = data.length > 0 ? Math.max(...data.map(d => d.value), 1) : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div title={`${d.label}: ${d.value}${unit}`} style={{
            width: '100%', background: d.value > 0 ? color : 'rgba(255,255,255,0.05)',
            borderRadius: '3px 3px 0 0', height: `${Math.max(3, (d.value / max) * 48)}px`,
            transition: 'height 0.4s ease', opacity: d.value > 0 ? 1 : 0.3,
          }} />
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

// ── Stat card ──────────────────────────────────────────────
const StatCard: React.FC<{ icon: string; label: string; value: string | number; sub?: string; accent?: boolean }> = ({ icon, label, value, sub, accent }) => (
  <div style={{
    padding: '18px 20px',
    background: accent ? 'rgba(200,169,110,0.07)' : 'var(--bg-surface2)',
    border: `1px solid ${accent ? 'rgba(200,169,110,0.28)' : 'var(--border)'}`,
    borderRadius: 14,
    transition: 'border-color 0.2s',
  }}>
    <div style={{ fontSize: 18, marginBottom: 10, opacity: 0.85 }}>{icon}</div>
    <div style={{
      fontSize: 26, fontWeight: 300,
      color: accent ? 'var(--accent)' : 'var(--text-primary)',
      letterSpacing: -0.5, lineHeight: 1,
    }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5, letterSpacing: 0.2 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, opacity: 0.6 }}>{sub}</div>}
  </div>
);

// ── Section header ─────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, children, style }) => (
  <div style={{
    padding: '20px 22px',
    background: 'var(--bg-surface2)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    ...style,
  }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, letterSpacing: 0.3, textTransform: 'uppercase' }}>{title}</div>
    {children}
  </div>
);

// ── Main view ──────────────────────────────────────────────
export const WritingStatsView: React.FC = () => {
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const docs = (useSelector((s: RootState) => s.documents.tree) || []) as any[];
  const [pomStats, setPomStats] = useState<PomStats | null>(null);
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [range, setRange] = useState<7 | 30 | 90 | 365>(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const pom = await ipc.invoke('pomodoro:stats', { workspaceId: activeWorkspaceId, days: 365 }).catch(() => null);
      if (pom) {
        // ✅ 修复：确保 byDocument 和 byDay 始终是数组
        setPomStats({
          totalCompleted: pom.totalCompleted ?? 0,
          totalSeconds: pom.totalSeconds ?? 0,
          byDocument: Array.isArray(pom.byDocument) ? pom.byDocument : [],
          byDay: Array.isArray(pom.byDay) ? pom.byDay : [],
        });
      }

      const now = Date.now();
      const days: Record<string, DayStats> = {};
      const initDay = (date: string) => { if (!days[date]) days[date] = { date, words: 0, docs: 0, pomodoros: 0 }; };

      for (let i = 0; i < 365; i++) {
        const d = new Date(now - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        initDay(key);
      }

      docs.forEach((doc: any) => {
        if (!doc.updatedAt) return;
        const key = new Date(doc.updatedAt).toISOString().slice(0, 10);
        if (days[key]) {
          days[key].words += doc.wordCount || 0;
          days[key].docs += 1;
        }
      });

      if (pom?.byDay && Array.isArray(pom.byDay)) {
        pom.byDay.forEach((b: any) => {
          const key = new Date(b.dayBucket * 86400000).toISOString().slice(0, 10);
          if (days[key]) days[key].pomodoros += b.count;
        });
      }

      setDayStats(Object.values(days).sort((a, b) => a.date.localeCompare(b.date)));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, docs]);

  useEffect(() => { load(); }, [load]);

  const rangeData = dayStats.slice(-range);
  const totalWords = rangeData.reduce((s, d) => s + d.words, 0);
  const activeDays = rangeData.filter(d => d.words > 0).length;
  const avgWords = activeDays > 0 ? Math.round(totalWords / activeDays) : 0;
  const streak = (() => {
    let s = 0;
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...rangeData].sort((a, b) => b.date.localeCompare(a.date));
    for (const d of sorted) {
      if (d.words > 0) s++;
      else if (d.date <= today) break;
    }
    return s;
  })();

  const last7 = dayStats.slice(-7).map(d => ({
    label: new Date(d.date).toLocaleDateString('zh-CN', { weekday: 'short' }).slice(1),
    value: d.words,
  }));
  const last30 = (() => {
    const weeks: { label: string; value: number }[] = [];
    const d = dayStats.slice(-28);
    for (let i = 0; i < 4; i++) {
      const chunk = d.slice(i * 7, i * 7 + 7);
      weeks.push({ label: `第${i + 1}周`, value: chunk.reduce((s, x) => s + x.words, 0) });
    }
    return weeks;
  })();

  const allDocs = [...docs].filter(d => !d.isFolder && d.wordCount > 0).sort((a, b) => b.wordCount - a.wordCount).slice(0, 8);
  // ✅ 修复：安全访问 byDocument
  const byDocument = pomStats?.byDocument ?? [];

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-editor)', color: 'var(--text-tertiary)', gap: 12 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 13 }}>加载统计数据…</span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-editor)', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 56px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.3 }}>写作统计</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>记录你的每一次创作</div>
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-surface2)', borderRadius: 9, padding: 3, border: '1px solid var(--border)' }}>
            {([7, 30, 90, 365] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: '5px 12px', borderRadius: 7, border: 'none',
                background: range === r ? 'var(--bg-surface)' : 'transparent',
                color: range === r ? 'var(--text-primary)' : 'var(--text-tertiary)',
                cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                fontWeight: range === r ? 600 : 400,
                boxShadow: range === r ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                transition: 'all 0.15s',
              }}>
                {r === 365 ? '一年' : `${r}天`}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10, marginBottom: 24 }}>
          <StatCard icon="✍️" label={`累计字数 (${range}天)`} value={totalWords >= 10000 ? `${(totalWords / 10000).toFixed(1)}万` : totalWords.toLocaleString()} accent />
          <StatCard icon="📅" label="活跃天数" value={activeDays} sub={`${range}天中`} />
          <StatCard icon="🔥" label="连续写作" value={`${streak}天`} sub="当前连续" />
          <StatCard icon="📝" label="日均字数" value={avgWords.toLocaleString()} sub="活跃日均" />
          <StatCard icon="🍅" label="完成番茄" value={pomStats?.totalCompleted || 0} sub="共完成" />
          <StatCard icon="⏱" label="专注时长" value={fmtTime(pomStats?.totalSeconds || 0)} sub="累计专注" />
        </div>

        {/* 热力图 */}
        <Section title="全年写作热力图" style={{ marginBottom: 16 }}>
          <Heatmap data={dayStats} />
        </Section>

        {/* 两列图表 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <Section title="近 7 天字数">
            <MiniBar data={last7} unit=" 字" />
          </Section>
          <Section title="近 4 周字数">
            <MiniBar data={last30} unit=" 字" color="rgba(200,169,110,0.7)" />
          </Section>
        </div>

        {/* 番茄钟 top 文档 — ✅ 用安全的 byDocument */}
        {byDocument.length > 0 && (
          <Section title="专注最多的文档" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byDocument.slice(0, 5).map((d, i) => {
                const pct = d.count / (byDocument[0]?.count || 1) * 100;
                return (
                  <div key={d.documentId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 16, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{d.title}</div>
                      <div style={{ height: 3, background: 'var(--bg-surface3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, letterSpacing: 0.2 }}>{d.count}🍅 · {fmtTime(d.seconds)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* 字数最多的文档 */}
        <Section title="字数最多的文档">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allDocs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '16px 0', textAlign: 'center', opacity: 0.6 }}>暂无数据</div>
            ) : allDocs.map((doc: any, i: number) => {
              const pct = doc.wordCount / allDocs[0].wordCount * 100;
              return (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 16, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title || '无标题'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{doc.wordCount.toLocaleString()} 字</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-surface3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(200,169,110,0.6)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

      </div>
    </div>
  );
};
