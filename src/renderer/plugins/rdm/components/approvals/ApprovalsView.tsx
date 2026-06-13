import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchApprovals, resolveApproval } from '../../store/slices/rdmSlice';
import type { Approval } from '../../types';

const STATUS = { pending: { label: '待审批', color: '#e8a020' }, approved: { label: '已通过', color: '#52c97a' }, rejected: { label: '已拒绝', color: '#e87a7a' } };
const TYPE = { sample_out: '样品出库', purchase_request: '采购申请' };

const S = {
  wrap: { padding: 20, height: '100%', overflow: 'auto' as const },
  tabs: { display: 'flex', gap: 4, marginBottom: 16 },
  tab: (a: boolean) => ({ padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', border: '0.5px solid var(--border)', background: a ? 'linear-gradient(135deg,#c8a96e,#9a7040)' : 'transparent', color: a ? '#fff' : 'var(--text-secondary)' }),
  card: { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 10 },
  row: { display: 'flex', alignItems: 'center', gap: 10 },
  tag: (c: string) => ({ fontSize: 11, background: `${c}22`, color: c, padding: '2px 8px', borderRadius: 5 }),
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  mBox: { background: 'var(--bg-surface)', borderRadius: 16, padding: 24, width: 380, border: '0.5px solid var(--border)' },
  mInp: { width: '100%', background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const },
  btn: (v = 'ghost', c = '') => ({ padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', border: `0.5px solid ${c || 'var(--border)'}`, background: v === 'primary' ? 'linear-gradient(135deg,#c8a96e,#9a7040)' : v === 'danger' ? 'rgba(232,122,122,0.1)' : 'transparent', color: v === 'primary' ? '#fff' : v === 'danger' ? '#e87a7a' : 'var(--text-secondary)', borderColor: v === 'danger' ? 'rgba(232,122,122,0.3)' : c || 'var(--border)' }),
};

export const ApprovalsView: React.FC<{ currentUser?: string }> = ({ currentUser = 'user' }) => {
  const dispatch = useDispatch<any>();
  const { approvals } = useSelector((s: any) => s.rdm);
  const [tab, setTab] = useState<string>('pending');
  const [resolving, setResolving] = useState<Approval | null>(null);
  const [remark, setRemark] = useState('');

  useEffect(() => { dispatch(fetchApprovals(tab === 'all' ? undefined : tab)); }, [tab]);

  const handleResolve = async (approved: boolean) => {
    if (!resolving) return;
    await dispatch(resolveApproval({ id: resolving.id, approverId: currentUser, approved, remark }));
    dispatch(fetchApprovals(tab === 'all' ? undefined : tab));
    setResolving(null); setRemark('');
  };

  return (
    <div style={S.wrap}>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 16 }}>审批管理</div>
      <div style={S.tabs}>
        {[['pending','待审批'],['approved','已通过'],['rejected','已拒绝'],['all','全部']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={S.tab(tab === v)}>{l}</button>
        ))}
      </div>

      {approvals.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 0', fontSize: 14 }}>暂无审批记录</div>
      )}

      {approvals.map((ap: Approval) => (
        <div key={ap.id} style={S.card}>
          <div style={{ ...S.row, marginBottom: 10 }}>
            <span style={S.tag('#3b82f6')}>{(TYPE as any)[ap.targetType] || ap.targetType}</span>
            <span style={S.tag((STATUS as any)[ap.status]?.color || '#888')}>{(STATUS as any)[ap.status]?.label}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(ap.appliedAt).toLocaleString('zh-CN')}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
            申请人：{ap.requesterId} · 目标ID：{ap.targetId}
          </div>
          {ap.remark && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>备注：{ap.remark}</div>}
          {ap.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setResolving(ap)} style={S.btn('primary')}>审批</button>
            </div>
          )}
          {ap.status !== 'pending' && ap.approverId && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {ap.status === 'approved' ? '✓' : '✗'} 由 {ap.approverId} 于 {new Date(ap.resolvedAt!).toLocaleString('zh-CN')} {ap.status === 'approved' ? '批准' : '拒绝'}
            </div>
          )}
        </div>
      ))}

      {resolving && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setResolving(null)}>
          <div style={S.mBox}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>审批申请</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              {(TYPE as any)[resolving.targetType]} · 申请人：{resolving.requesterId}
            </div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>审批意见（可选）</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)}
              style={{ ...S.mInp, minHeight: 80, resize: 'vertical' as const, marginBottom: 16 }} placeholder="填写审批意见..." />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setResolving(null)} style={S.btn()}>取消</button>
              <button onClick={() => handleResolve(false)} style={S.btn('danger')}>拒绝</button>
              <button onClick={() => handleResolve(true)} style={S.btn('primary')}>批准</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
