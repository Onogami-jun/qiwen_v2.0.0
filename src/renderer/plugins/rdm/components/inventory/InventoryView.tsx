import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSamples, createSample, updateSampleQty, setCurrentSample } from '../../store/slices/rdmSlice';
import type { Sample } from '../../types';

const css = `
  .inv-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg-primary, #0d0d0d); }

  /* toolbar */
  .inv-toolbar {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px;
    border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.07));
    flex-shrink: 0;
    background: var(--bg-primary, #0d0d0d);
  }
  .inv-search {
    flex: 1; max-width: 360px;
    background: var(--bg-surface, #111);
    border: 0.5px solid var(--border, rgba(255,255,255,0.08));
    border-radius: 8px;
    color: var(--text-primary, #f0ede8);
    font-size: 12.5px;
    padding: 7px 12px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }
  .inv-search:focus { border-color: var(--accent, #c8a96e); }
  .inv-search::placeholder { color: var(--text-tertiary, #6e6e73); }

  .inv-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 14px; border-radius: 8px; cursor: pointer;
    font-size: 12px; font-family: inherit; font-weight: 500;
    border: 0.5px solid transparent; transition: opacity 0.15s;
    white-space: nowrap;
  }
  .inv-btn:hover { opacity: 0.85; }
  .inv-btn-primary {
    background: linear-gradient(135deg, #c8a96e, #9a7040);
    color: #fff;
  }
  .inv-btn-ghost {
    background: transparent;
    border-color: var(--border, rgba(255,255,255,0.1));
    color: var(--text-secondary, #a0a09a);
  }
  .inv-btn-ghost:hover { background: rgba(255,255,255,0.04); }

  /* table */
  .inv-body { flex: 1; overflow: auto; }
  .inv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .inv-th {
    padding: 9px 16px;
    text-align: left; font-size: 10.5px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--text-tertiary, #6e6e73);
    border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-primary, #0d0d0d);
    position: sticky; top: 0; z-index: 1;
  }
  .inv-td {
    padding: 11px 16px;
    border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.05));
    color: var(--text-primary, #f0ede8);
    vertical-align: middle;
  }
  .inv-tr:hover .inv-td { background: rgba(255,255,255,0.02); }

  .inv-name { font-weight: 500; font-size: 13px; }
  .inv-sub { font-size: 10.5px; color: var(--text-tertiary, #6e6e73); margin-top: 2px; }
  .inv-badge {
    display: inline-block; font-size: 10px; font-weight: 500;
    padding: 1px 6px; border-radius: 4px; margin-top: 3px;
  }
  .inv-badge-danger { background: rgba(232,122,122,0.12); color: #e87a7a; }
  .inv-qty { font-weight: 600; font-size: 13px; }
  .inv-empty {
    text-align: center; padding: 60px 0;
    color: var(--text-tertiary, #6e6e73); font-size: 13px;
  }
  .inv-empty-icon { font-size: 28px; margin-bottom: 10px; opacity: 0.4; }

  /* modal */
  .inv-modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.65);
    display: flex; align-items: center; justify-content: center; z-index: 1000;
    backdrop-filter: blur(2px);
  }
  .inv-modal-box {
    background: var(--bg-surface, #161616);
    border: 0.5px solid var(--border, rgba(255,255,255,0.1));
    border-radius: 14px; padding: 26px; width: 480px;
    max-height: 82vh; overflow: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  .inv-modal-title { font-size: 15px; font-weight: 600; margin-bottom: 20px; color: var(--text-primary, #f0ede8); }
  .inv-field { margin-bottom: 12px; }
  .inv-field label { display: block; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; color: var(--text-tertiary, #6e6e73); margin-bottom: 4px; text-transform: uppercase; }
  .inv-field-inp {
    width: 100%; background: var(--bg-surface, #111);
    border: 0.5px solid var(--border, rgba(255,255,255,0.1));
    border-radius: 8px; color: var(--text-primary, #f0ede8);
    font-size: 13px; padding: 8px 12px; font-family: inherit;
    outline: none; box-sizing: border-box; transition: border-color 0.15s;
  }
  .inv-field-inp:focus { border-color: var(--accent, #c8a96e); }
  .inv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .inv-modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
  .inv-error { font-size: 12px; color: #e87a7a; margin-bottom: 10px; }
  .inv-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; margin-bottom: 16px; color: var(--text-secondary, #a0a09a); }
`;

const emptyForm = {
  name: '', type: '', batchNo: '', casNo: '', supplier: '',
  storageCondition: '', quantity: 0, unit: 'g', expiryDate: '',
  location: '', isHazardous: false, lowStockThreshold: '',
};

export const InventoryView: React.FC<{ currentUser?: string }> = ({ currentUser = 'user' }) => {
  const dispatch = useDispatch<any>();
  const { samples, loading } = useSelector((s: any) => s.rdm);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showOp, setShowOp] = useState<Sample | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [opForm, setOpForm] = useState({ operation: 'out', quantity: '', remark: '' });
  const [saving, setSaving] = useState(false);
  const [opError, setOpError] = useState('');

  useEffect(() => { dispatch(fetchSamples({ search })); }, [search]);

  const set = (k: string) => (e: any) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await dispatch(createSample({
        ...form, quantity: Number(form.quantity),
        lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
      }));
      setShowNew(false); setForm(emptyForm);
    } finally { setSaving(false); }
  };

  const handleOp = async () => {
    if (!showOp || !opForm.quantity) return;
    const qty = Number(opForm.quantity);
    const delta = opForm.operation === 'in' || opForm.operation === 'return' ? qty : -qty;
    setOpError('');
    try {
      await dispatch(updateSampleQty({
        sampleId: showOp.id, delta,
        operation: opForm.operation as any, operator: currentUser, remark: opForm.remark,
      }));
      dispatch(fetchSamples({ search }));
      setShowOp(null); setOpForm({ operation: 'out', quantity: '', remark: '' });
    } catch (e: any) { setOpError(e.message || '操作失败'); }
  };

  const qtyColor = (s: Sample) => {
    if (s.lowStockThreshold && s.quantity <= s.lowStockThreshold) return '#e87a7a';
    if (s.expiryDate && new Date(s.expiryDate) <= new Date(Date.now() + 30 * 86400000)) return '#e8a020';
    return 'var(--text-primary, #f0ede8)';
  };

  return (
    <>
      <style>{css}</style>
      <div className="inv-wrap">

        {/* 工具栏 */}
        <div className="inv-toolbar">
          <input
            className="inv-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索样品名称、CAS号、条形码…"
          />
          <button className="inv-btn inv-btn-primary" onClick={() => setShowNew(true)}>
            + 新增样品
          </button>
        </div>

        {/* 表格 */}
        <div className="inv-body">
          <table className="inv-table">
            <thead>
              <tr>
                {['名称', '类型 / 批号', '库存', '单位', '储存位置', '有效期', '操作'].map(h => (
                  <th key={h} className="inv-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="inv-td" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中…</td></tr>
              )}
              {!loading && samples.length === 0 && (
                <tr>
                  <td colSpan={7} className="inv-td">
                    <div className="inv-empty">
                      <div className="inv-empty-icon">◎</div>
                      暂无样品，点击「新增样品」添加
                    </div>
                  </td>
                </tr>
              )}
              {samples.map((s: Sample) => (
                <tr key={s.id} className="inv-tr">
                  <td className="inv-td">
                    <div className="inv-name">{s.name}</div>
                    {s.casNo && <div className="inv-sub">CAS {s.casNo}</div>}
                    {s.isHazardous && <span className="inv-badge inv-badge-danger">危险品</span>}
                  </td>
                  <td className="inv-td">
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{s.type || '—'}</div>
                    {s.batchNo && <div className="inv-sub">{s.batchNo}</div>}
                  </td>
                  <td className="inv-td">
                    <span className="inv-qty" style={{ color: qtyColor(s) }}>{s.quantity}</span>
                  </td>
                  <td className="inv-td" style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{s.unit}</td>
                  <td className="inv-td" style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{s.location || '—'}</td>
                  <td className="inv-td" style={{
                    color: s.expiryDate && new Date(s.expiryDate) <= new Date(Date.now() + 30 * 86400000)
                      ? '#e8a020' : 'var(--text-secondary)',
                    fontSize: 12.5,
                  }}>
                    {s.expiryDate || '—'}
                  </td>
                  <td className="inv-td">
                    <button className="inv-btn inv-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setShowOp(s)}>出入库</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 新增样品弹窗 */}
        {showNew && (
          <div className="inv-modal" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
            <div className="inv-modal-box">
              <div className="inv-modal-title">新增样品</div>

              <div className="inv-field">
                <label>名称 *</label>
                <input className="inv-field-inp" value={form.name} onChange={set('name')} placeholder="样品名称" />
              </div>
              <div className="inv-grid-2">
                <div className="inv-field">
                  <label>类型</label>
                  <input className="inv-field-inp" value={form.type} onChange={set('type')} />
                </div>
                <div className="inv-field">
                  <label>批号</label>
                  <input className="inv-field-inp" value={form.batchNo} onChange={set('batchNo')} />
                </div>
              </div>
              <div className="inv-grid-2">
                <div className="inv-field">
                  <label>CAS号</label>
                  <input className="inv-field-inp" value={form.casNo} onChange={set('casNo')} />
                </div>
                <div className="inv-field">
                  <label>供应商</label>
                  <input className="inv-field-inp" value={form.supplier} onChange={set('supplier')} />
                </div>
              </div>
              <div className="inv-grid-2">
                <div className="inv-field">
                  <label>初始数量</label>
                  <input className="inv-field-inp" type="number" value={form.quantity} onChange={set('quantity')} />
                </div>
                <div className="inv-field">
                  <label>单位</label>
                  <input className="inv-field-inp" value={form.unit} onChange={set('unit')} placeholder="g / mL / 个…" />
                </div>
              </div>
              <div className="inv-grid-2">
                <div className="inv-field">
                  <label>储存位置</label>
                  <input className="inv-field-inp" value={form.location} onChange={set('location')} />
                </div>
                <div className="inv-field">
                  <label>储存条件</label>
                  <input className="inv-field-inp" value={form.storageCondition} onChange={set('storageCondition')} />
                </div>
              </div>
              <div className="inv-grid-2">
                <div className="inv-field">
                  <label>有效期</label>
                  <input className="inv-field-inp" type="date" value={form.expiryDate} onChange={set('expiryDate')} />
                </div>
                <div className="inv-field">
                  <label>低库存阈值</label>
                  <input className="inv-field-inp" type="number" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} />
                </div>
              </div>
              <label className="inv-checkbox-row">
                <input type="checkbox" checked={form.isHazardous} onChange={set('isHazardous')} />
                标记为危险品
              </label>

              <div className="inv-modal-footer">
                <button className="inv-btn inv-btn-ghost" onClick={() => setShowNew(false)}>取消</button>
                <button className="inv-btn inv-btn-primary" onClick={handleCreate} disabled={saving}>
                  {saving ? '保存中…' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 出入库弹窗 */}
        {showOp && (
          <div className="inv-modal" onClick={e => e.target === e.currentTarget && setShowOp(null)}>
            <div className="inv-modal-box" style={{ width: 360 }}>
              <div className="inv-modal-title">出入库操作</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 18 }}>
                {showOp.name} &nbsp;·&nbsp; 当前库存 <strong style={{ color: 'var(--accent, #c8a96e)' }}>{showOp.quantity} {showOp.unit}</strong>
              </div>

              <div className="inv-field">
                <label>操作类型</label>
                <select className="inv-field-inp" value={opForm.operation}
                  onChange={e => setOpForm(f => ({ ...f, operation: e.target.value }))}>
                  <option value="in">入库</option>
                  <option value="out">出库</option>
                  <option value="return">归还</option>
                  <option value="dispose">废弃</option>
                  <option value="adjust">盘点调整</option>
                </select>
              </div>
              <div className="inv-field">
                <label>数量（{showOp.unit}）</label>
                <input className="inv-field-inp" type="number" min="0" step="0.01"
                  value={opForm.quantity} onChange={e => setOpForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="inv-field">
                <label>备注（可选）</label>
                <input className="inv-field-inp" value={opForm.remark}
                  onChange={e => setOpForm(f => ({ ...f, remark: e.target.value }))} />
              </div>

              {opError && <div className="inv-error">{opError}</div>}
              <div className="inv-modal-footer">
                <button className="inv-btn inv-btn-ghost" onClick={() => setShowOp(null)}>取消</button>
                <button className="inv-btn inv-btn-primary" onClick={handleOp}>确认</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
