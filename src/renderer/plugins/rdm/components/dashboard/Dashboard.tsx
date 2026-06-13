import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboard } from '../../store/slices/rdmSlice';

const STATUS_COLORS: Record<string, string> = {
  draft: '#8a8a84', in_progress: '#3b82f6', completed: '#52c97a', archived: '#c4c4bc',
};
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', in_progress: '进行中', completed: '已完成', archived: '已归档',
};

export const Dashboard: React.FC = () => {
  const dispatch = useDispatch<any>();
  const { dashboard, loading, error } = useSelector((s: any) => s.rdm);

  useEffect(() => { dispatch(fetchDashboard()); }, []);

  if (loading && !dashboard) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>加载中...</div>
      </div>
    );
  }

  // Safe defaults — prevent crashes from undefined fields
  const d = dashboard || {};
  const totalExperiments  = d.totalExperiments  ?? 0;
  const activeExperiments = d.activeExperiments ?? d.inProgressExperiments ?? 0;
  const totalSamples      = d.totalSamples      ?? 0;
  const lowStockCount     = d.lowStockCount     ?? d.lowStockAlerts ?? 0;
  const expiringSoonCount = d.expiringSoonCount  ?? 0;
  const pendingApprovals  = d.pendingApprovals   ?? 0;
  const pendingTasks      = d.pendingTasks       ?? 0;
  const todayReservations = d.todayReservations  ?? 0;
  const recentExperiments = Array.isArray(d.recentExperiments) ? d.recentExperiments : [];
  const recentLogs        = Array.isArray(d.recentLogs)        ? d.recentLogs        : [];

  const stats = [
    {
      label: '实验总数', value: totalExperiments,
      sub: `${activeExperiments} 进行中`,
      color: 'var(--accent, #c8a96e)', icon: '🔬',
    },
    {
      label: '样品库存', value: totalSamples,
      sub: lowStockCount > 0 ? `${lowStockCount} 低库存` : '库存正常',
      color: lowStockCount > 0 ? '#e8a020' : '#52c97a', icon: '🧪',
    },
    {
      label: '即将过期', value: expiringSoonCount,
      sub: '30天内过期',
      color: expiringSoonCount > 0 ? '#e87a7a' : '#52c97a', icon: '⏰',
    },
    {
      label: '待办任务', value: pendingTasks,
      sub: `${pendingApprovals} 待审批`,
      color: '#3b82f6', icon: '📋',
    },
    {
      label: '今日预约', value: todayReservations,
      sub: '仪器使用预约',
      color: 'var(--text-secondary, #9b9890)', icon: '🔭',
    },
  ];

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
    borderRadius: 14, padding: '18px 20px',
  };
  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13,
  };
  const tag = (c: string): React.CSSProperties => ({
    background: `${c}22`, color: c, padding: '2px 8px', borderRadius: 5,
    fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
  });

  return (
    <div style={{ padding: 24, overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>📊 实验室概览</span>
        <button
          onClick={() => dispatch(fetchDashboard())}
          style={{
            marginLeft: 'auto', fontSize: 12, border: '0.5px solid var(--border)',
            background: 'transparent', color: 'var(--text-tertiary)',
            padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >↻ 刷新</button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(232,122,122,0.1)', border: '0.5px solid rgba(232,122,122,0.3)', fontSize: 13, color: '#e87a7a' }}>
          ⚠ {error} — 部分数据可能无法显示，请检查数据管理模块是否已正确安装。
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: s.color, marginTop: 3, opacity: 0.8 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Recent experiments */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>最近实验记录</div>
          {recentExperiments.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>暂无实验记录</div>
          ) : (
            recentExperiments.map((exp: any) => (
              <div key={exp.id} style={row}>
                <div style={{ flex: 1, overflow: 'hidden', marginRight: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.title || '未命名'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {exp.updatedAt ? new Date(exp.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
                <span style={tag(STATUS_COLORS[exp.status] || '#888')}>
                  {STATUS_LABELS[exp.status] || exp.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Recent sample logs */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>最近库存操作</div>
          {recentLogs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>暂无操作记录</div>
          ) : (
            recentLogs.map((log: any) => (
              <div key={log.id} style={row}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{log.operator || '未知'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {log.operated_at || log.operatedAt
                      ? new Date(log.operated_at || log.operatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </div>
                </div>
                <span style={tag((log.quantity_change ?? log.quantityChange ?? 0) > 0 ? '#52c97a' : '#e87a7a')}>
                  {(log.quantity_change ?? log.quantityChange ?? 0) > 0 ? '+' : ''}{log.quantity_change ?? log.quantityChange ?? 0}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
