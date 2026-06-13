import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchExperiments, createExperiment, updateExperiment, deleteExperiment,
  setCurrentExperiment,
} from '../../store/slices/rdmSlice';
import type { Experiment, ExperimentStatus } from '../../types';

const STATUS_MAP: Record<ExperimentStatus, { label: string; color: string }> = {
  draft:       { label: '草稿',   color: '#8a8a84' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  completed:   { label: '已完成', color: '#52c97a' },
  archived:    { label: '已归档', color: '#c4c4bc' },
};
const STATUS_OPTS: ExperimentStatus[] = ['draft', 'in_progress', 'completed', 'archived'];

const btn = (variant: 'primary' | 'ghost' | 'danger' = 'ghost', extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  fontFamily: 'inherit', border: '0.5px solid var(--border)', transition: 'all .15s',
  background:
    variant === 'primary' ? 'linear-gradient(135deg,#c8a96e,#9a7040)' :
    variant === 'danger'  ? 'rgba(232,122,122,0.1)' : 'var(--bg-surface2)',
  color:
    variant === 'primary' ? '#fff' :
    variant === 'danger'  ? '#e87a7a' : 'var(--text-secondary)',
  borderColor: variant === 'danger' ? 'rgba(232,122,122,0.3)' : 'var(--border)',
  ...extra,
});

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg-surface2)', border: '0.5px solid var(--border)',
  borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, padding: '9px 13px',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const tag = (color: string): React.CSSProperties => ({
  background: `${color}22`, color, padding: '2px 9px', borderRadius: 20,
  fontSize: 11, fontWeight: 600, letterSpacing: 0.2, whiteSpace: 'nowrap',
});

export const ELNView: React.FC<{ currentUser?: string }> = ({ currentUser = 'user' }) => {
  const dispatch = useDispatch<any>();
  const { experiments, currentExperiment, loading } = useSelector((s: any) => s.rdm);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<ExperimentStatus | ''>('');
  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState({ title: '', content: '', status: 'draft' as ExperimentStatus, tags: '' });
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [activeTab, setActiveTab]     = useState<'write' | 'preview'>('write');
  const textareaRef                   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    dispatch(fetchExperiments({ search, status: statusFilter || undefined }));
  }, [search, statusFilter]);

  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (editing && activeTab === 'write') textareaRef.current?.focus();
  }, [editing, activeTab]);

  const handleNew = () => {
    dispatch(setCurrentExperiment(null));
    setForm({ title: '', content: '', status: 'draft', tags: '' });
    setEditing(true);
    setActiveTab('write');
    setSaved(false);
  };

  const handleSelect = (exp: Experiment) => {
    dispatch(setCurrentExperiment(exp));
    setForm({ title: exp.title, content: exp.content, status: exp.status, tags: exp.tags.join(', ') });
    setEditing(true);
    setActiveTab('write');
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      alert('请填写实验标题');
      return;
    }
    setSaving(true);
    try {
      const tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      if (currentExperiment) {
        await dispatch(updateExperiment({ id: currentExperiment.id, data: { title: form.title, content: form.content, status: form.status, tags } }));
      } else {
        const result = await dispatch(createExperiment({ title: form.title, content: form.content, status: form.status, tags, createdBy: currentUser }));
        if (result?.payload) dispatch(setCurrentExperiment(result.payload));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      dispatch(fetchExperiments({ search, status: statusFilter || undefined }));
    } catch (e) {
      alert('保存失败，请重试');
    } finally {
      setSaving(false); }
  }, [form, currentExperiment, currentUser, dispatch, search, statusFilter]);

  // Ctrl/Cmd+S shortcut
  useEffect(() => {
    if (!editing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, handleSave]);

  const handleDelete = async (exp: Experiment) => {
    if (!window.confirm(`确认删除「${exp.title}」？此操作不可撤销。`)) return;
    await dispatch(deleteExperiment(exp.id));
    if (currentExperiment?.id === exp.id) { setEditing(false); dispatch(setCurrentExperiment(null)); }
    dispatch(fetchExperiments({ search, status: statusFilter || undefined }));
  };

  const handleSign = async () => {
    if (!currentExperiment) return;
    if (!window.confirm(`确认以「${currentUser}」身份对本实验进行电子签名？签名后内容将被锁定。`)) return;
    await dispatch(updateExperiment({ id: currentExperiment.id, data: { isSigned: true, signer: currentUser, signedAt: new Date().toISOString() } }));
    dispatch(fetchExperiments({ search, status: statusFilter || undefined }));
  };

  // Simple markdown preview renderer
  const renderPreview = (md: string) => {
    if (!md) return '<p style="color:var(--text-tertiary);font-size:14px">暂无内容</p>';
    const html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;color:var(--text-primary);margin:20px 0 8px">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:600;color:var(--text-primary);margin:24px 0 10px;border-bottom:0.5px solid var(--border);padding-bottom:8px">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:700;color:var(--text-primary);margin:28px 0 12px">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:var(--bg-surface3);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:13px">$1</code>')
      .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="padding-left:20px;margin:8px 0">${m}</ul>`)
      .replace(/\n\n/g, '</p><p style="margin:10px 0;line-height:1.8;color:var(--text-primary)">')
      .replace(/\n/g, '<br/>');
    return `<p style="margin:0;line-height:1.8;color:var(--text-primary)">${html}</p>`;
  };

  const isLocked = Boolean(currentExperiment?.isSigned);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* ─── LEFT PANEL ─── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={handleNew}
            style={{ ...btn('primary'), width: '100%', textAlign: 'center', padding: '9px 0', fontSize: 13, fontWeight: 500, borderRadius: 10 }}
          >
            + 新建实验
          </button>
          <div style={{ position: 'relative', marginTop: 10 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-tertiary)' }}>🔍</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索实验..."
              style={{ ...inp, fontSize: 13, paddingLeft: 32, paddingTop: 7, paddingBottom: 7 }}
            />
          </div>
          {/* Status filter tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {[['', '全部'], ...STATUS_OPTS.map(s => [s, STATUS_MAP[s as ExperimentStatus].label])].map(([val, label]) => (
              <button
                key={val} onClick={() => setStatusFilter(val as any)}
                style={{
                  padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                  border: statusFilter === val ? 'none' : '0.5px solid var(--border)',
                  background: statusFilter === val ? 'linear-gradient(135deg,#c8a96e,#9a7040)' : 'transparent',
                  color: statusFilter === val ? '#fff' : 'var(--text-secondary)',
                  fontWeight: statusFilter === val ? 600 : 400,
                  transition: 'all .15s',
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* List body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>加载中...
            </div>
          )}
          {!loading && experiments.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🔬</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>暂无实验记录</div>
              <div style={{ fontSize: 11 }}>点击「新建实验」开始记录</div>
            </div>
          )}
          {experiments.map((exp: Experiment) => {
            const active = currentExperiment?.id === exp.id;
            return (
              <div
                key={exp.id}
                onClick={() => handleSelect(exp)}
                style={{
                  padding: '12px 14px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer',
                  background: active ? 'rgba(200,169,110,0.08)' : 'transparent',
                  borderLeft: active ? '2.5px solid #c8a96e' : '2.5px solid transparent',
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.title}
                  </span>
                  <span style={tag(STATUS_MAP[exp.status].color)}>{STATUS_MAP[exp.status].label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span>{new Date(exp.updatedAt).toLocaleDateString('zh-CN')}</span>
                  {exp.isSigned && <span style={{ color: '#52c97a', fontWeight: 500 }}>✓ 已签名</span>}
                  {exp.tags?.length > 0 && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exp.tags.slice(0, 2).join(' · ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          共 {experiments.length} 条记录
        </div>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!editing ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'var(--text-tertiary)', background: 'var(--bg-base)' }}>
            <div style={{ fontSize: 56, opacity: 0.25 }}>🔬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>选择或新建一个实验记录</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>在左侧列表选择，或点击「新建实验」开始</div>
            <button onClick={handleNew} style={{ ...btn('primary'), marginTop: 8, padding: '10px 24px', fontSize: 13, borderRadius: 10 }}>
              + 新建实验
            </button>
          </div>
        ) : (
          <>
            {/* Top toolbar */}
            <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--bg-surface)', flexWrap: 'wrap' }}>
              <input
                value={form.title}
                onChange={e => !isLocked && setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="实验标题"
                readOnly={isLocked}
                style={{ ...inp, fontSize: 16, fontWeight: 600, flex: 1, minWidth: 200, background: isLocked ? 'var(--bg-surface3)' : 'var(--bg-surface2)', cursor: isLocked ? 'default' : 'text' }}
              />
              <select
                value={form.status}
                onChange={e => !isLocked && setForm(f => ({ ...f, status: e.target.value as ExperimentStatus }))}
                disabled={isLocked}
                style={{ ...inp, width: 'auto', padding: '7px 12px', fontSize: 13, cursor: isLocked ? 'default' : 'pointer' }}
              >
                {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_MAP[s].label}</option>)}
              </select>
              {/* Tab toggles */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--border)' }}>
                {(['write', 'preview'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    border: 'none', background: activeTab === t ? 'rgba(200,169,110,0.15)' : 'transparent',
                    color: activeTab === t ? '#c8a96e' : 'var(--text-secondary)', transition: 'all .15s',
                  }}>
                    {t === 'write' ? '✏️ 编辑' : '👁 预览'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {currentExperiment && !isLocked && (
                  <button onClick={handleSign} style={btn()}>✍ 签名</button>
                )}
                {currentExperiment && (
                  <button onClick={() => handleDelete(currentExperiment)} style={btn('danger')}>🗑 删除</button>
                )}
                {!isLocked && (
                  <button onClick={handleSave} disabled={saving} style={{ ...btn('primary'), minWidth: 80, position: 'relative' }}>
                    {saving ? '保存中...' : saved ? '✓ 已保存' : '保存'}
                  </button>
                )}
              </div>
            </div>

            {/* Signed banner */}
            {isLocked && (
              <div style={{ padding: '8px 20px', background: 'rgba(82,201,122,0.07)', borderBottom: '0.5px solid rgba(82,201,122,0.2)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <span style={{ fontSize: 12, color: '#52c97a', fontWeight: 500 }}>
                  已由 {currentExperiment?.signer} 于 {new Date(currentExperiment?.signedAt!).toLocaleString('zh-CN')} 电子签名，内容已锁定
                </span>
              </div>
            )}

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-base)' }}>
              {/* Tags */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>标签（逗号分隔）</label>
                <input
                  value={form.tags}
                  onChange={e => !isLocked && setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="化学, 分析, 检测..."
                  readOnly={isLocked}
                  style={{ ...inp, fontSize: 13, background: isLocked ? 'var(--bg-surface3)' : 'var(--bg-surface2)' }}
                />
              </div>

              {/* Content area */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>实验内容（Markdown）</label>
                  {!isLocked && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ctrl+S 快捷保存</span>
                  )}
                </div>
                {activeTab === 'write' ? (
                  <textarea
                    ref={textareaRef}
                    value={form.content}
                    onChange={e => !isLocked && setForm(f => ({ ...f, content: e.target.value }))}
                    readOnly={isLocked}
                    placeholder="# 实验目的&#10;&#10;# 材料与方法&#10;&#10;# 实验步骤&#10;&#10;# 结果与分析&#10;&#10;# 结论"
                    style={{
                      width: '100%', minHeight: 'calc(100vh - 420px)', background: isLocked ? 'var(--bg-surface3)' : 'var(--bg-surface)',
                      border: '0.5px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14,
                      padding: '16px 18px', fontFamily: 'monospace', outline: 'none', resize: 'vertical',
                      lineHeight: 1.9, boxSizing: 'border-box', cursor: isLocked ? 'default' : 'text',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      minHeight: 'calc(100vh - 420px)', background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
                      borderRadius: 10, padding: '20px 24px', lineHeight: 1.8, fontSize: 14,
                    }}
                    dangerouslySetInnerHTML={{ __html: renderPreview(form.content) }}
                  />
                )}
              </div>

              {/* Metadata footer */}
              {currentExperiment && (
                <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: '0.5px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    ['创建时间', new Date(currentExperiment.createdAt).toLocaleString('zh-CN')],
                    ['更新时间', new Date(currentExperiment.updatedAt).toLocaleString('zh-CN')],
                    ['创建者',   currentExperiment.createdBy || currentUser],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{k}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
