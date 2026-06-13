import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchSamples, fetchExperiments } from '../../store/slices/rdmSlice';
import { useDispatch } from 'react-redux';

const S = {
  wrap: { padding: 20, height: '100%', overflow: 'auto' as const },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 },
  card: { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  title: { fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 },
  bar: (pct: number, color: string) => ({ height: 8, borderRadius: 4, background: `linear-gradient(90deg,${color},${color}88)`, width: `${Math.min(pct,100)}%`, transition: 'width .4s' }),
  barBg: { height: 8, borderRadius: 4, background: 'var(--bg-surface2)', overflow: 'hidden' as const, marginTop: 4 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 },
  btn: { padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', border: '0.5px solid var(--border)', background: 'linear-gradient(135deg,#c8a96e,#9a7040)', color: '#fff' },
};

export const ReportsView: React.FC = () => {
  const dispatch = useDispatch<any>();
  const { samples, experiments } = useSelector((s: any) => s.rdm);

  useEffect(() => {
    dispatch(fetchSamples({}));
    dispatch(fetchExperiments({}));
  }, []);

  // 样品类型统计
  const sampleByType = samples.reduce((acc: any, s: any) => {
    acc[s.type || '未分类'] = (acc[s.type || '未分类'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const maxSt = Math.max(...Object.values(sampleByType) as number[], 1);

  // 实验状态统计
  const expByStatus = experiments.reduce((acc: any, e: any) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusLabels: Record<string, [string, string]> = {
    draft: ['草稿', '#8a8a84'], in_progress: ['进行中', '#3b82f6'],
    completed: ['已完成', '#52c97a'], archived: ['已归档', '#c4c4bc'],
  };

  // 低库存和过期预警
  const lowStock = samples.filter((s: any) => s.lowStockThreshold && s.quantity <= s.lowStockThreshold);
  const expiring = samples.filter((s: any) => s.expiryDate && new Date(s.expiryDate) <= new Date(Date.now() + 30*86400000));

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map((row: any) => keys.map((k: any) => JSON.stringify(row[k] ?? '')).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>报表中心</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportCSV(samples, '样品清单.csv')} style={S.btn}>导出样品 CSV</button>
          <button onClick={() => exportCSV(experiments, '实验记录.csv')} style={S.btn}>导出实验 CSV</button>
        </div>
      </div>

      <div style={S.grid}>
        {/* 样品类型分布 */}
        <div style={S.card}>
          <div style={S.title}>样品类型分布（共 {samples.length} 种）</div>
          {Object.keys(sampleByType).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>暂无数据</div>}
          {Object.entries(sampleByType).map(([type, count]) => (
            <div key={type} style={{ marginBottom: 12 }}>
              <div style={S.row}><span style={{ color: 'var(--text-secondary)' }}>{type}</span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{count as number}</span></div>
              <div style={S.barBg}><div style={S.bar((count as number) / maxSt * 100, '#c8a96e')} /></div>
            </div>
          ))}
        </div>

        {/* 实验状态分布 */}
        <div style={S.card}>
          <div style={S.title}>实验记录状态（共 {experiments.length} 条）</div>
          {Object.keys(expByStatus).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>暂无数据</div>}
          {Object.entries(statusLabels).map(([status, [label, color]]) => {
            const count = (expByStatus[status] || 0) as number;
            const total = Math.max(experiments.length, 1);
            return (
              <div key={status} style={{ marginBottom: 12 }}>
                <div style={S.row}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ color, fontWeight: 500 }}>{count} ({Math.round(count/total*100)}%)</span>
                </div>
                <div style={S.barBg}><div style={S.bar(count/total*100, color)} /></div>
              </div>
            );
          })}
        </div>

        {/* 低库存预警 */}
        <div style={S.card}>
          <div style={S.title}>⚠️ 低库存预警 ({lowStock.length})</div>
          {lowStock.length === 0 && <div style={{ fontSize: 13, color: '#52c97a' }}>✓ 所有样品库存充足</div>}
          {lowStock.slice(0, 8).map((s: any) => (
            <div key={s.id} style={{ ...S.row, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
              <span style={{ color: '#e87a7a', fontSize: 12 }}>{s.quantity}/{s.lowStockThreshold} {s.unit}</span>
            </div>
          ))}
          {lowStock.length > 8 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>还有 {lowStock.length - 8} 条...</div>}
        </div>

        {/* 过期预警 */}
        <div style={S.card}>
          <div style={S.title}>📅 30天内过期 ({expiring.length})</div>
          {expiring.length === 0 && <div style={{ fontSize: 13, color: '#52c97a' }}>✓ 暂无即将过期样品</div>}
          {expiring.slice(0, 8).map((s: any) => {
            const days = Math.ceil((new Date(s.expiryDate).getTime() - Date.now()) / 86400000);
            return (
              <div key={s.id} style={{ ...S.row, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                <span style={{ color: days <= 7 ? '#e87a7a' : '#e8a020', fontSize: 12 }}>
                  {days <= 0 ? '已过期' : `${days}天后`}
                </span>
              </div>
            );
          })}
          {expiring.length > 8 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>还有 {expiring.length - 8} 条...</div>}
        </div>
      </div>
    </div>
  );
};
