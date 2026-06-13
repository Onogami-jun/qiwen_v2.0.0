import React, { useState, useEffect, useRef, useCallback } from 'react';
import { drugApi, DrugInfo, icdApi, ICDCode, doiApi, ReferenceInfo, legalApi, LegalClause, readabilityApi } from './api';

// ── 共享样式工具 ──────────────────────────────────────────
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'var(--bg-surface2)',
  border: '0.5px solid var(--border)',
  borderRadius: 10,
  padding: '12px 14px',
  marginBottom: 8,
  ...extra,
});

const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.8px',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase' as const,
  marginBottom: 10,
};

const btn = (accent?: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 8,
  border: accent ? 'none' : '0.5px solid var(--border)',
  background: accent ? 'linear-gradient(135deg, #c8a96e, #9a7040)' : 'var(--bg-surface3)',
  color: accent ? '#fff' : 'var(--text-secondary)',
  fontSize: 12.5,
  fontWeight: accent ? 500 : 400,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
  ...extra,
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: 'var(--bg-surface3)',
  border: '0.5px solid var(--border)',
  borderRadius: 7,
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
};

// ── 番茄专注计时器 ────────────────────────────────────────
export const FocusTimerPlugin: React.FC = () => {
  const WORK = 25 * 60;
  const BREAK = 5 * 60;
  const [seconds, setSeconds] = useState(WORK);
  const [running, setRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [rounds, setRounds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            setRunning(false);
            setIsBreak(prev => {
              if (!prev) setRounds(r => r + 1);
              return !prev;
            });
            return isBreak ? WORK : BREAK;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, isBreak]);

  const total = isBreak ? BREAK : WORK;
  const pct = ((total - seconds) / total) * 100;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const r = 34;
  const circ = 2 * Math.PI * r;

  const reset = () => {
    setRunning(false);
    setSeconds(isBreak ? BREAK : WORK);
  };

  return (
    <div>
      <div style={label}>番茄专注</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', width: 90, height: 90 }}>
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r={r} fill="none" stroke="var(--bg-surface3)" strokeWidth="6" />
            <circle
              cx="45" cy="45" r={r} fill="none"
              stroke={isBreak ? '#52c97a' : '#c8a96e'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct / 100)}
              transform="rotate(-90 45 45)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: 1 }}>{mm}:{ss}</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{isBreak ? '休息' : '专注'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn(!running)} onClick={() => setRunning(r => !r)}>{running ? '暂停' : '开始'}</button>
          <button style={btn(false)} onClick={reset}>重置</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          今日已完成 <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{rounds}</span> 轮
        </div>
      </div>
    </div>
  );
};

// ── 快速便签 ──────────────────────────────────────────────
export const QuickNotePlugin: React.FC = () => {
  const [notes, setNotes] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [input, setInput] = useState('');

  const add = () => {
    if (!input.trim()) return;
    setNotes(n => [...n, { id: Date.now().toString(), text: input.trim(), done: false }]);
    setInput('');
  };

  return (
    <div>
      <div style={label}>快速便签</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="记录灵感、待办..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <button style={btn(true, { padding: '6px 10px' })} onClick={add}>+</button>
      </div>
      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
        {notes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0', opacity: 0.6 }}>暂无便签</div>
        ) : notes.map(n => (
          <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
            <div
              onClick={() => setNotes(ns => ns.map(x => x.id === n.id ? { ...x, done: !x.done } : x))}
              style={{
                width: 14, height: 14, borderRadius: 4, marginTop: 1, flexShrink: 0, cursor: 'pointer',
                border: n.done ? 'none' : '1.5px solid var(--border)',
                background: n.done ? '#c8a96e' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {n.done && <span style={{ fontSize: 9, color: '#fff' }}>✓</span>}
            </div>
            <span style={{ fontSize: 12.5, color: n.done ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: n.done ? 'line-through' : 'none', flex: 1, lineHeight: 1.5 }}>{n.text}</span>
            <button onClick={() => setNotes(ns => ns.filter(x => x.id !== n.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 11, padding: 0 }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 引用格式生成（接入 doiApi/CrossRef）────────────────
export const CitationManagerPlugin: React.FC = () => {
  const [doi, setDoi] = useState('');
  const [ref, setRef] = useState<ReferenceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'apa' | 'mla' | 'gb'>('apa');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchDoi = async () => {
    if (!doi.trim()) return;
    setLoading(true); setError(''); setRef(null);
    try {
      const result = await doiApi.getByDoi(doi.trim());
      if (result) setRef(result);
      else setError('未找到该 DOI 对应的文献');
    } catch { setError('获取失败，请检查 DOI 格式'); }
    finally { setLoading(false); }
  };

  const formatted = ref ? doiApi.format(ref, format) : '';
  const copy = () => {
    if (!formatted) return;
    navigator.clipboard.writeText(formatted).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
        <input value={doi} onChange={e => setDoi(e.target.value)} placeholder="输入 DOI..."
          onKeyDown={e => e.key === 'Enter' && fetchDoi()}
          style={{ flex: 1, height: 28, padding: '0 8px', borderRadius: 6, background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={fetchDoi} disabled={loading || !doi.trim()}
          style={{ height: 28, padding: '0 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: (!doi.trim() || loading) ? 0.5 : 1 }}>
          {loading ? '...' : '获取'}
        </button>
      </div>
      {error && <div style={{ fontSize: 11.5, color: 'var(--color-danger)', marginBottom: 8 }}>{error}</div>}
      {ref && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{ref.title}</strong>
            {ref.authors.length > 0 && <div style={{ marginTop: 2 }}>{ref.authors.slice(0, 3).join(', ')}{ref.authors.length > 3 ? ' 等' : ''}</div>}
            {ref.journal && <div style={{ color: 'var(--text-tertiary)' }}>{ref.journal}{ref.year ? `, ${ref.year}` : ''}</div>}
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {(['apa', 'mla', 'gb'] as const).map(key => (
              <button key={key} onClick={() => setFormat(key)} style={{ flex: 1, height: 24, borderRadius: 5, border: '0.5px solid', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                borderColor: format === key ? 'var(--accent)' : 'var(--border)',
                background: format === key ? 'rgba(200,169,110,0.12)' : 'transparent',
                color: format === key ? 'var(--accent)' : 'var(--text-secondary)',
              }}>{key === 'gb' ? 'GB/T' : key.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ background: 'var(--bg-surface3)', borderRadius: 7, padding: '8px 10px', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8, userSelect: 'text' }}>
            {formatted}
          </div>
          <button onClick={copy} style={{ width: '100%', height: 28, borderRadius: 6, border: '0.5px solid var(--border)', background: copied ? 'rgba(76,175,125,0.1)' : 'transparent', color: copied ? 'var(--color-success)' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {copied ? '✓ 已复制' : '复制引用'}
          </button>
        </>
      )}
      {!ref && !error && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>支持 CrossRef DOI · 无需 API Key</div>}
    </div>
  );
};

// ── 法律条款模板库（接入 legalApi）──────────────────────
export const ClauseLibraryPlugin: React.FC = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<LegalClause[]>([]);
  const [selected, setSelected] = useState<LegalClause | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try { setResults((await legalApi.searchClauses(q)).slice(0, 15)); }
    catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { doSearch(''); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  if (selected) {
    return (
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{selected.title}</div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8, background: 'var(--accent-bg)', padding: '2px 7px', borderRadius: 4, display: 'inline-block' }}>{selected.category}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.75, background: 'var(--bg-surface3)', borderRadius: 7, padding: '10px 12px', marginBottom: 8, userSelect: 'text' }}>
          {selected.content}
        </div>
        <button onClick={() => copy(selected.content)} style={{ width: '100%', height: 28, borderRadius: 6, border: '0.5px solid var(--border)', background: copied ? 'rgba(76,175,125,0.1)' : 'transparent', color: copied ? 'var(--color-success)' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {copied ? '✓ 已复制' : '复制条款'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 12px 8px' }}>
      <input value={search} onChange={handleChange} placeholder="搜索条款..."
        style={{ width: '100%', height: 28, padding: '0 10px', marginBottom: 6, borderRadius: 6, background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 6 }}>内置 {legalApi.clauseCount()} 条常用合同条款</div>
      {loading && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0' }}>搜索中...</div>}
      <div style={{ maxHeight: 210, overflowY: 'auto' }}>
        {results.map(c => (
          <div key={c.id} onClick={() => setSelected(c)}
            style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2, transition: 'background 0.1s' }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{c.title}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{c.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 法律术语检查 ──────────────────────────────────────────
const RISK_TERMS = ['可能', '大概', '也许', '尽量', '争取', '视情况', '酌情'];
const VAGUE_TERMS = ['等', '若干', '相关', '适当'];

export const LegalCheckerPlugin: React.FC<{ content?: string }> = ({ content = '' }) => {
  const risks = RISK_TERMS.filter(t => content.includes(t));
  const vagueWords = VAGUE_TERMS.filter(t => content.includes(t));
  const total = risks.length + vagueWords.length;

  return (
    <div>
      <div style={label}>法律术语检查</div>
      <div style={{ ...card(), background: total === 0 ? 'rgba(82,201,122,0.06)' : 'rgba(200,169,110,0.06)', borderColor: total === 0 ? 'rgba(82,201,122,0.2)' : 'rgba(200,169,110,0.2)' }}>
        <div style={{ fontSize: 22, fontWeight: 300, color: total === 0 ? '#52c97a' : '#c8a96e' }}>{total}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{total === 0 ? '暂无风险词汇' : '处需关注'}</div>
      </div>
      {risks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#e8824a', marginBottom: 6 }}>⚠ 模糊承诺表达</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
            {risks.map(t => <span key={t} style={{ background: 'rgba(232,130,74,0.1)', color: '#e8824a', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{t}</span>)}
          </div>
        </div>
      )}
      {vagueWords.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#c8a96e', marginBottom: 6 }}>○ 模糊限定词</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
            {vagueWords.map(t => <span key={t} style={{ background: 'rgba(200,169,110,0.1)', color: '#c8a96e', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{t}</span>)}
          </div>
        </div>
      )}
      {content.length < 10 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0', opacity: 0.6 }}>打开文档后自动分析</div>
      )}
    </div>
  );
};

// ── 案件时间线 ────────────────────────────────────────────
export const CaseTimelinePlugin: React.FC = () => {
  const [events, setEvents] = useState([
    { id: '1', date: '2024-01-15', event: '合同签订', important: true },
    { id: '2', date: '2024-03-20', event: '争议发生', important: true },
    { id: '3', date: '2024-04-01', event: '律师介入', important: false },
  ]);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newEvent, setNewEvent] = useState('');

  const addEvent = () => {
    if (!newDate || !newEvent.trim()) return;
    setEvents(e => [...e, { id: Date.now().toString(), date: newDate, event: newEvent, important: false }]
      .sort((a, b) => a.date.localeCompare(b.date)));
    setAdding(false); setNewDate(''); setNewEvent('');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={label}>案件时间线</div>
        <button style={btn(false, { padding: '3px 8px', fontSize: 11 })} onClick={() => setAdding(a => !a)}>+ 添加</button>
      </div>
      {adding && (
        <div style={{ ...card(), marginBottom: 10 }}>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            style={{ ...inputStyle, marginBottom: 6 }} />
          <input value={newEvent} onChange={e => setNewEvent(e.target.value)} placeholder="事件描述"
            style={{ ...inputStyle, marginBottom: 8 }} />
          <button style={btn(true, { width: '100%' })} onClick={addEvent}>添加</button>
        </div>
      )}
      <div style={{ position: 'relative', paddingLeft: 16 }}>
        <div style={{ position: 'absolute', left: 5, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
        {events.map(e => (
          <div key={e.id} style={{ position: 'relative', paddingBottom: 12 }}>
            <div style={{
              position: 'absolute', left: -12, top: 4, width: 8, height: 8, borderRadius: '50%',
              background: e.important ? '#c8a96e' : 'var(--bg-surface3)',
              border: `1.5px solid ${e.important ? '#c8a96e' : 'var(--border)'}`,
            }} />
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{e.date}</div>
            <div style={{ fontSize: 12.5, color: e.important ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: e.important ? 500 : 400 }}>{e.event}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 教案规划器 ────────────────────────────────────────────
export const LessonPlannerPlugin: React.FC = () => {
  const [plan, setPlan] = useState({ subject: '', grade: '', duration: '45', objectives: '', keyPoints: '', activities: '' });

  const field = (key: keyof typeof plan, placeholder: string, rows = 1) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>{placeholder}</div>
      {rows === 1 ? (
        <input value={plan[key]} onChange={e => setPlan(p => ({ ...p, [key]: e.target.value }))}
          placeholder={placeholder} style={inputStyle} />
      ) : (
        <textarea value={plan[key]} onChange={e => setPlan(p => ({ ...p, [key]: e.target.value }))}
          placeholder={placeholder} rows={rows}
          style={{ ...inputStyle, resize: 'none' as const }} />
      )}
    </div>
  );

  const exportPlan = () => {
    const text = `# 教案\n\n**学科：** ${plan.subject}\n**年级：** ${plan.grade}\n**课时：** ${plan.duration} 分钟\n\n## 教学目标\n${plan.objectives}\n\n## 重难点\n${plan.keyPoints}\n\n## 教学活动\n${plan.activities}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <div style={label}>教案规划</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>{field('subject', '学科')}</div>
        <div style={{ flex: 1 }}>{field('grade', '年级')}</div>
      </div>
      {field('objectives', '教学目标', 2)}
      {field('keyPoints', '重难点', 2)}
      {field('activities', '教学环节', 3)}
      <button style={btn(true, { width: '100%' })} onClick={exportPlan}>复制为 Markdown</button>
    </div>
  );
};

// ── 题目生成器 ────────────────────────────────────────────
export const QuizGeneratorPlugin: React.FC<{ content?: string }> = ({ content = '' }) => {
  const [quiz, setQuiz] = useState<{ q: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const generate = () => {
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 8).slice(0, 5);
      const generated = sentences.map((s, i) => ({
        type: i % 2 === 0 ? '填空题' : '判断题',
        q: i % 2 === 0
          ? s.trim().replace(/[\u4e00-\u9fa5]{2,4}/, '____') + '。'
          : s.trim() + '。（对/错）',
      }));
      setQuiz(generated.length ? generated : [{ type: '提示', q: '请先在文档中写入内容，再生成题目' }]);
      setLoading(false);
    }, 800);
  };

  return (
    <div>
      <div style={label}>题目生成</div>
      <button style={btn(true, { width: '100%', marginBottom: 10 })} onClick={generate} disabled={loading}>
        {loading ? '生成中...' : '从文档生成题目'}
      </button>
      {quiz.map((q, i) => (
        <div key={i} style={card()}>
          <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 4 }}>{q.type}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{i + 1}. {q.q}</div>
        </div>
      ))}
    </div>
  );
};

// ── 思维导图 ──────────────────────────────────────────────
export const MindmapPlugin: React.FC<{ content?: string }> = ({ content = '' }) => {
  const outline = React.useMemo(() => {
    if (!content) return [];
    return content.split('\n')
      .filter(l => l.startsWith('#'))
      .map(l => ({ level: l.match(/^#+/)?.[0].length || 1, text: l.replace(/^#+\s*/, '').trim() }))
      .slice(0, 12);
  }, [content]);

  if (outline.length === 0) return (
    <div>
      <div style={label}>思维导图</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0', opacity: 0.6 }}>使用 # 标题构建思维导图</div>
    </div>
  );

  const colors = ['#c8a96e', '#7eb8e8', '#82c97a', '#e8824a', '#a87ed4'];

  return (
    <div>
      <div style={label}>思维导图</div>
      {outline.map((node, i) => {
        const indent = (node.level - 1) * 14;
        const color = colors[(node.level - 1) % colors.length];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `4px 0 4px ${indent}px` }}>
            <div style={{ width: node.level === 1 ? 8 : 5, height: node.level === 1 ? 8 : 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: node.level === 1 ? 13 : 11.5, color: node.level === 1 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: node.level === 1 ? 500 : 400 }}>
              {node.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── 病历模板 ──────────────────────────────────────────────
const MEDICAL_TEMPLATES = [
  { name: '门诊病历', icon: '🏥', template: `# 门诊病历\n\n**就诊日期：** \n**科室：** \n**主诉：** \n\n## 现病史\n\n\n## 既往史\n\n\n## 体格检查\n- 体温：℃　脉搏：次/分　呼吸：次/分　血压：mmHg\n\n## 辅助检查\n\n\n## 诊断\n\n\n## 治疗方案\n` },
  { name: '手术记录', icon: '⚕️', template: `# 手术记录\n\n**手术日期：** \n**手术名称：** \n**术者：** \n\n## 术前诊断\n\n## 术中所见\n\n## 手术经过\n\n## 术后诊断\n` },
  { name: '出院小结', icon: '📋', template: `# 出院小结\n\n**住院号：** \n**入院日期：** \n**出院日期：** \n\n## 入院诊断\n\n## 诊治经过\n\n## 出院诊断\n\n## 出院医嘱\n` },
];

export const MedicalTemplatePlugin: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (template: string, name: string) => {
    navigator.clipboard.writeText(template).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return (
    <div>
      <div style={label}>病历模板</div>
      {MEDICAL_TEMPLATES.map(t => (
        <div key={t.name} style={card({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t.name}</span>
          </div>
          <button onClick={() => copy(t.template, t.name)} style={btn(false, { padding: '3px 10px', fontSize: 11 })}>
            {copied === t.name ? '✓ 已复制' : '插入'}
          </button>
        </div>
      ))}
    </div>
  );
};

// ── 药品速查（接入 drugApi）──────────────────────────────
export const DrugReferencePlugin: React.FC = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<DrugInfo[]>([]);
  const [selected, setSelected] = useState<DrugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await drugApi.search(q || '常用药');
      setResults(res.slice(0, 20));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    doSearch('常用药');
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val || '常用药'), 350);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (selected) {
    return (
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{selected.name}</div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
        {selected.alias && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>别名：{selected.alias}</div>}
        {[
          { label: '分类', val: selected.category, color: 'var(--accent)' },
          { label: '适应症', val: selected.indication },
          { label: '用法用量', val: selected.dosage },
          { label: '禁忌', val: selected.contraindication, color: 'var(--color-danger)' },
          { label: '不良反应', val: selected.sideEffect },
          { label: '贮存', val: selected.storage },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: color || 'var(--text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{val}</div>
          </div>
        ))}
        {!drugApi.hasApiKey() && (
          <div style={{ marginTop: 10, padding: '6px 8px', background: 'rgba(200,169,110,0.06)', borderRadius: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
            💡 配置 API Key 后可查询更多药品
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 12px 8px' }}>
      <input value={search} onChange={handleChange} placeholder="搜索药品名称或分类..."
        style={{ width: '100%', height: 28, padding: '0 10px', marginBottom: 8, borderRadius: 6, background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
      {loading && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 0' }}>搜索中...</div>}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {results.map(d => (
          <div key={d.name} onClick={() => setSelected(d)} style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.1s' }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{d.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{d.category}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>›</span>
          </div>
        ))}
        {!loading && results.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '10px 0', textAlign: 'center' }}>未找到相关药品</div>}
      </div>
    </div>
  );
};

// ── ICD 编码查询（接入 icdApi）──────────────────────────
export const ICDLookupPlugin: React.FC = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ICDCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try { setResults(await icdApi.search(q)); }
    catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 400);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div style={{ padding: '0 12px 8px' }}>
      <input value={search} onChange={handleChange} placeholder="搜索疾病名称或编码..."
        style={{ width: '100%', height: 28, padding: '0 10px', marginBottom: 8, borderRadius: 6, background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
      {!icdApi.hasApiKey() && (
        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          内置 ICD-10 · <span style={{ color: 'var(--accent)' }}>配置 WHO Key 启用 ICD-11</span>
        </div>
      )}
      {loading && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 0' }}>搜索中...</div>}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {results.map(d => (
          <div key={d.code} style={{ padding: '5px 6px', borderRadius: 6, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 11, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 5, flexShrink: 0, whiteSpace: 'nowrap' }}>{d.code}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titleCN}</div>
              {d.titleCN !== d.title && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>}
            </div>
            <button onClick={() => copy(d.code)} style={{ border: '0.5px solid var(--border)', background: 'none', color: copied === d.code ? 'var(--color-success)' : 'var(--text-tertiary)', fontSize: 10.5, padding: '2px 7px', borderRadius: 5, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
              {copied === d.code ? '✓' : '复制'}
            </button>
          </div>
        ))}
        {!loading && search && results.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '10px 0', textAlign: 'center' }}>无匹配结果</div>}
        {!search && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', padding: '10px 0', textAlign: 'center' }}>输入疾病名称或编码开始搜索</div>}
      </div>
    </div>
  );
};

// ── 可读性分析（接入 readabilityApi）────────────────────
export const ReadabilityPlugin: React.FC<{ content?: string }> = ({ content: docContent = '' }) => {
  const result = readabilityApi.analyze(docContent);
  const scoreColor = result.score >= 80 ? 'var(--color-success)' : result.score >= 55 ? 'var(--color-warning)' : 'var(--color-danger)';

  if (!docContent.trim()) {
    return <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>请在编辑器中输入内容</div>;
  }

  return (
    <div style={{ padding: '8px 12px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, padding: '10px', background: 'var(--bg-surface3)', borderRadius: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor }}>{result.score}</span>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>可读性评分</div>
          <div style={{ fontSize: 11, color: scoreColor, marginTop: 2 }}>阅读等级：{result.level}</div>
        </div>
      </div>
      {[
        { label: '平均句长', val: `${result.avgSentenceLen} 字` },
        { label: '长句数量', val: `${result.longSentences} 句` },
      ].map(({ label, val }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{val}</span>
        </div>
      ))}
      {result.suggestions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>改进建议</div>
          {result.suggestions.map((s, i) => (
            <div key={i} style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid var(--accent)', lineHeight: 1.5 }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CharacterTrackerPlugin: React.FC = () => {
  const [chars, setChars] = useState([
    { id: '1', name: '主角', role: '主人公', color: '#c8a96e' },
    { id: '2', name: '配角', role: '助手', color: '#7eb8e8' },
  ]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const colors = ['#c8a96e', '#7eb8e8', '#82c97a', '#e8824a', '#a87ed4', '#e87a7a'];

  const add = () => {
    if (!name.trim()) return;
    const color = colors[chars.length % colors.length];
    setChars(c => [...c, { id: Date.now().toString(), name: name.trim(), role: role.trim(), color }]);
    setName(''); setRole('');
  };

  return (
    <div>
      <div style={label}>人物追踪</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="姓名" style={{ ...inputStyle, flex: 1 }} />
        <input value={role} onChange={e => setRole(e.target.value)} placeholder="角色" style={{ ...inputStyle, flex: 1 }} />
        <button style={btn(true, { padding: '6px 10px' })} onClick={add}>+</button>
      </div>
      {chars.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 500, flexShrink: 0 }}>
            {c.name.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</div>
            {c.role && <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{c.role}</div>}
          </div>
          <button onClick={() => setChars(cs => cs.filter(x => x.id !== c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 11 }}>✕</button>
        </div>
      ))}
    </div>
  );
};

// ── 文风检测 ──────────────────────────────────────────────
export const StyleCheckerPlugin: React.FC<{ content?: string }> = ({ content = '' }) => {
  const repeated = React.useMemo(() => {
    if (!content) return [];
    const words = content.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    const stopWords = new Set(['这个', '那个', '是的', '可以', '我们', '他们', '一个', '没有', '进行', '通过', '相关', '以及', '但是', '因为', '所以']);
    const freq: Record<string, number> = {};
    words.filter(w => !stopWords.has(w)).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq).filter(([, c]) => c >= 3).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [content]);

  const passive = (content.match(/被/g) || []).length;

  return (
    <div>
      <div style={label}>文风检测</div>
      {content.length < 20 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0', opacity: 0.6 }}>打开文档后自动分析</div>
      ) : (
        <>
          <div style={card()}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>被动语态频率</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 6, flex: 1, background: 'var(--bg-surface3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, passive * 5)}%`, background: passive > 10 ? '#e8824a' : '#c8a96e', borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 20 }}>{passive}</span>
            </div>
          </div>
          {repeated.length > 0 && (
            <div style={card()}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>高频词汇</div>
              {repeated.map(([w, c]) => (
                <div key={w} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>「{w}」</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>×{c}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── 关键词提取 ────────────────────────────────────────────
export const KeywordExtractorPlugin: React.FC<{ content?: string }> = ({ content = '' }) => {
  const keywords = React.useMemo(() => {
    if (content.length < 30) return [];
    const words = content.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    const stopWords = new Set(['这个', '那个', '是的', '可以', '我们', '他们', '一个', '没有', '进行', '通过', '相关', '以及', '但是', '因为', '所以']);
    const freq: Record<string, number> = {};
    words.filter(w => !stopWords.has(w)).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq).filter(([, c]) => c >= 2).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [content]);

  return (
    <div>
      <div style={label}>关键词提取</div>
      {keywords.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0', opacity: 0.6 }}>
          {content.length < 30 ? '文档内容不足，请继续写作' : '未找到高频关键词'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
          {keywords.map(([w, c]) => (
            <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface2)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '4px 10px' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{w}</span>
              <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '1px 5px', borderRadius: 10 }}>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 大纲助手 ──────────────────────────────────────────────
export const OutlineBuilderPlugin: React.FC = () => {
  const [sections, setSections] = useState([
    { id: '1', title: '引言', target: 500 },
    { id: '2', title: '文献综述', target: 2000 },
    { id: '3', title: '研究方法', target: 1500 },
    { id: '4', title: '结果与讨论', target: 2500 },
    { id: '5', title: '结论', target: 800 },
  ]);
  const total = sections.reduce((a, s) => a + s.target, 0);

  return (
    <div>
      <div style={label}>论文大纲</div>
      {sections.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 600 }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{s.title}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>目标 {s.target} 字</div>
          </div>
          <input type="number" value={s.target}
            onChange={e => setSections(ss => ss.map(x => x.id === s.id ? { ...x, target: Math.max(0, Number(e.target.value)) } : x))}
            style={{ width: 56, padding: '3px 6px', background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', outline: 'none', fontFamily: 'inherit', textAlign: 'center' as const }} />
        </div>
      ))}
      <div style={{ ...card({ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', marginTop: 8 }) }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>总目标</span>
        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{total.toLocaleString()} 字</span>
      </div>
    </div>
  );
};