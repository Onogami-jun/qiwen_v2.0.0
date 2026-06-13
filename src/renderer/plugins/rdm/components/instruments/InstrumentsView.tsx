import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchInstruments, fetchReservations, createInstrument, createReservation } from '../../store/slices/rdmSlice';
import type { Instrument, InstrumentReservation } from '../../types';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal:      { label: '正常',   color: '#52c97a' },
  maintenance: { label: '维护中', color: '#e8a020' },
  unavailable: { label: '不可用', color: '#e87a7a' },
  retired:     { label: '已退役', color: '#8a8a84' },
};

const S = {
  wrap: { display: 'flex', height: '100%', overflow: 'hidden' },
  list: { width: 260, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  listHead: { padding: '12px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 },
  listBody: { flex: 1, overflowY: 'auto' as const },
  item: (active: boolean) => ({ padding: '12px 14px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', background: active ? 'var(--bg-surface2)' : 'transparent' }),
  main: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  head: { padding: '14px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  body: { flex: 1, overflow: 'auto' as const, padding: 16 },
  btn: (v = 'ghost') => ({ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', border: '0.5px solid var(--border)', background: v === 'primary' ? 'linear-gradient(135deg,#c8a96e,#9a7040)' : 'transparent', color: v === 'primary' ? '#fff' : 'var(--text-secondary)' }),
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  mBox: { background: 'var(--bg-surface)', borderRadius: 16, padding: '24px', width: 400, border: '0.5px solid var(--border)' },
  mInp: { width: '100%', background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 10 },
  resCard: { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 },
};

export const InstrumentsView: React.FC<{ currentUser?: string }> = ({ currentUser = 'user' }) => {
  const dispatch = useDispatch<any>();
  const { instruments, reservations } = useSelector((s: any) => s.rdm);
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [showNewInst, setShowNewInst] = useState(false);
  const [showNewRes, setShowNewRes] = useState(false);
  const [iForm, setIForm] = useState({ name: '', model: '', location: '', description: '' });
  const [rForm, setRForm] = useState({ startTime: '', endTime: '', purpose: '' });
  const [resError, setResError] = useState('');

  useEffect(() => { dispatch(fetchInstruments()); }, []);
  useEffect(() => {
    if (selected) dispatch(fetchReservations({ instrumentId: selected.id }));
  }, [selected]);

  const handleCreateInst = async () => {
    if (!iForm.name.trim()) return;
    await dispatch(createInstrument(iForm));
    setShowNewInst(false); setIForm({ name: '', model: '', location: '', description: '' });
  };

  const handleCreateRes = async () => {
    if (!selected || !rForm.startTime || !rForm.endTime) return;
    setResError('');
    try {
      await dispatch(createReservation({ instrumentId: selected.id, userId: currentUser, ...rForm })).unwrap();
      setShowNewRes(false); setRForm({ startTime: '', endTime: '', purpose: '' });
    } catch (e: any) { setResError(e.message || '预约失败'); }
  };

  const todayReservations = reservations.filter((r: InstrumentReservation) =>
    r.instrumentId === selected?.id && r.status !== 'cancelled'
  );

  return (
    <div style={S.wrap}>
      <div style={S.list}>
        <div style={S.listHead}>
          <button onClick={() => setShowNewInst(true)} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center' }}>+ 添加仪器</button>
        </div>
        <div style={S.listBody}>
          {instruments.map((inst: Instrument) => (
            <div key={inst.id} style={S.item(selected?.id === inst.id)} onClick={() => setSelected(inst)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{inst.name}</div>
                <span style={{ fontSize: 10, background: `${STATUS_MAP[inst.status]?.color}22`, color: STATUS_MAP[inst.status]?.color, padding: '2px 7px', borderRadius: 4 }}>
                  {STATUS_MAP[inst.status]?.label}
                </span>
              </div>
              {inst.model && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{inst.model}</div>}
              {inst.location && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>📍 {inst.location}</div>}
            </div>
          ))}
          {instruments.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无仪器</div>
          )}
        </div>
      </div>

      <div style={S.main}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 32 }}>🔭</div>
            <div style={{ fontSize: 14 }}>选择仪器查看预约</div>
          </div>
        ) : (
          <>
            <div style={S.head}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{selected.name}</div>
                {selected.model && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selected.model} {selected.location && `· ${selected.location}`}</div>}
              </div>
              <button onClick={() => setShowNewRes(true)} style={{ ...S.btn('primary'), marginLeft: 'auto' }}>+ 新建预约</button>
            </div>
            <div style={S.body}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
                预约记录 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>（{todayReservations.length} 条）</span>
              </div>
              {todayReservations.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '32px 0' }}>暂无预约记录</div>
              )}
              {todayReservations.map((r: InstrumentReservation) => (
                <div key={r.id} style={S.resCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{r.userId}</div>
                    <span style={{ fontSize: 11, background: r.status === 'reserved' ? 'rgba(59,130,246,0.15)' : 'rgba(82,201,122,0.15)', color: r.status === 'reserved' ? '#3b82f6' : '#52c97a', padding: '2px 8px', borderRadius: 5 }}>
                      {r.status === 'reserved' ? '已预约' : r.status === 'in_use' ? '使用中' : '已完成'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {new Date(r.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — {new Date(r.endTime).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {r.purpose && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{r.purpose}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showNewInst && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNewInst(false)}>
          <div style={S.mBox}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>添加仪器</div>
            {[['name','仪器名称 *'],['model','型号'],['location','位置'],['description','描述']].map(([k,lbl]) => (
              <div key={k}><label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 3 }}>{lbl}</label>
              <input value={(iForm as any)[k]} onChange={e => setIForm(f => ({ ...f, [k]: e.target.value }))} style={S.mInp} /></div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewInst(false)} style={S.btn()}>取消</button>
              <button onClick={handleCreateInst} style={S.btn('primary')}>添加</button>
            </div>
          </div>
        </div>
      )}

      {showNewRes && selected && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNewRes(false)}>
          <div style={S.mBox}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>预约仪器</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>{selected.name}</div>
            {[['startTime','开始时间','datetime-local'],['endTime','结束时间','datetime-local'],['purpose','用途说明','text']].map(([k,lbl,type]) => (
              <div key={k}><label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 3 }}>{lbl}</label>
              <input type={type} value={(rForm as any)[k]} onChange={e => setRForm(f => ({ ...f, [k]: e.target.value }))} style={S.mInp} /></div>
            ))}
            {resError && <div style={{ fontSize: 12, color: '#e87a7a', marginBottom: 10 }}>{resError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewRes(false)} style={S.btn()}>取消</button>
              <button onClick={handleCreateRes} style={S.btn('primary')}>确认预约</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
