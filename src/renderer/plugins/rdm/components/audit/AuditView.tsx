import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAuditLogs } from '../../store/slices/rdmSlice';
import type { AuditLog } from '../../types';

const ACTION_COLOR: Record<string, string> = {
  INSERT: '#52c97a', UPDATE: '#3b82f6', DELETE: '#e87a7a', VIEW: '#8a8a84',
};
const TABLE_LABELS: Record<string, string> = {
  rdm_experiments: '实验记录', rdm_samples: '样品', rdm_tasks: '任务',
  rdm_instruments: '仪器', rdm_approvals: '审批', rdm_instrument_reservations: '仪器预约',
};
const S = {
  wrap: { padding: 20, height: '100%', overflow: 'auto' as const },
  toolbar: { display: 'flex', gap: 8, marginBottom: 16 },
  inp: { background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, padding: '6px 10px', fontFamily: 'inherit', outline: 'none' },
  th: { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, borderBottom: '0.5px solid var(--border)', background: 'var(--bg-surface)', position: 'sticky' as const, top: 0 },
  td: { padding: '10px 12px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-primary)' },
  tag: (c: string) => ({ fontSize: 10, background: `${c}22`, color: c, padding: '2px 6px', borderRadius: 4, fontWeight: 500 }),
  btn: { padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', border: '0.5px solid var(--border)', background: 'linear-gradient(135deg,#c8a96e,#9a7040)', color: '#fff' },
};

export const AuditView: React.FC = () => {
  const dispatch = useDispatch<any>();
  const { auditLogs } = useSelector((s: any) => s.rdm);
  const [table, setTable] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    dispatch(fetchAuditLogs({ tableName: table || undefined, userId: userId || undefined, limit: 200 }));
  }, [table, userId]);

  const exportCSV = () => {
    if (!auditLogs.length) return;
    const rows = auditLogs.map((l: AuditLog) => ({ 时间: l.createdAt, 操作人: l.userId || '-', 操作: l.action, 表名: TABLE_LABELS[l.tableName] || l.tableName, 记录ID: l.recordId }));
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map((r: any) => keys.map((k: string) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '审计日志.csv'; a.click();
  };

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>审计日志</div>
        <button onClick={exportCSV} style={S.btn}>导出 CSV</button>
      </div>
      <div style={S.toolbar}>
        <select value={table} onChange={e => setTable(e.target.value)} style={S.inp}>
          <option value="">全部表</option>
          {Object.entries(TABLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="按用户ID筛选" style={S.inp} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['时间','操作人','操作','数据表','记录ID'].map((h: any) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {auditLogs.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>暂无记录</td></tr>}
          {auditLogs.map((log: AuditLog) => (
            <tr key={log.id}>
              <td style={S.td}><span style={{ fontSize: 12 }}>{new Date(log.createdAt).toLocaleString('zh-CN')}</span></td>
              <td style={S.td}>{log.userId || <span style={{ color: 'var(--text-tertiary)' }}>系统</span>}</td>
              <td style={S.td}><span style={S.tag(ACTION_COLOR[log.action] || '#888')}>{log.action}</span></td>
              <td style={S.td}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{TABLE_LABELS[log.tableName] || log.tableName}</span></td>
              <td style={S.td}><span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{log.recordId.slice(0,8)}...</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
