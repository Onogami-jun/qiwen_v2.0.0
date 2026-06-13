/**
 * 科研数据管理平台 — 插件版主入口（重设计版）
 */

import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import rdmReducer from './store/slices/rdmSlice';
import { Dashboard } from './components/dashboard/Dashboard';
import { ELNView } from './components/eln/ELNView';
import { InventoryView } from './components/inventory/InventoryView';
import { ProjectsView } from './components/projects/ProjectsView';
import { InstrumentsView } from './components/instruments/InstrumentsView';
import { ApprovalsView } from './components/approvals/ApprovalsView';
import { ReportsView } from './components/reports/ReportsView';
import { AuditView } from './components/audit/AuditView';

// 懒初始化：只在组件首次渲染时创建 rdmStore，不在模块加载时初始化
// 避免未使用该插件的用户也承担 Redux store 创建的开销
let _rdmStore: ReturnType<typeof configureStore> | null = null;
function getRdmStore() {
  if (!_rdmStore) {
    _rdmStore = configureStore({ reducer: { rdm: rdmReducer } });
  }
  return _rdmStore;
}

type NavItem = { id: string; icon: string; label: string; section: string };

const NAV: NavItem[] = [
  { id: 'dashboard',   icon: '◈',  label: '总览',    section: '工作台' },
  { id: 'eln',         icon: '⬡',  label: '实验记录', section: '工作台' },
  { id: 'inventory',   icon: '◎',  label: '样品库存', section: '工作台' },
  { id: 'projects',    icon: '▦',  label: '项目管理', section: '工作台' },
  { id: 'instruments', icon: '◉',  label: '仪器预约', section: '管理' },
  { id: 'approvals',   icon: '✦',  label: '审批管理', section: '管理' },
  { id: 'reports',     icon: '▤',  label: '报表',     section: '管理' },
  { id: 'audit',       icon: '◑',  label: '审计日志', section: '管理' },
];

const css = `
  .rdm-root {
    display: flex;
    height: 100%;
    overflow: hidden;
    font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
    background: var(--bg-primary, #0d0d0d);
    color: var(--text-primary, #f0ede8);
  }

  /* ── 侧边导航 ───────────────────────────── */
  .rdm-nav {
    width: 188px;
    flex-shrink: 0;
    background: var(--bg-surface, #111);
    border-right: 0.5px solid var(--border, rgba(255,255,255,0.07));
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .rdm-nav-brand {
    padding: 18px 16px 14px;
    border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.07));
    flex-shrink: 0;
  }
  .rdm-nav-brand-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--accent, #c8a96e);
    text-transform: uppercase;
  }
  .rdm-nav-brand-sub {
    font-size: 10px;
    color: var(--text-tertiary, #6e6e73);
    margin-top: 2px;
    letter-spacing: 0.03em;
  }

  .rdm-nav-body {
    flex: 1;
    overflow-y: auto;
    padding: 10px 8px;
    scrollbar-width: none;
  }
  .rdm-nav-body::-webkit-scrollbar { display: none; }

  .rdm-nav-section-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--text-tertiary, #6e6e73);
    text-transform: uppercase;
    padding: 8px 8px 4px;
    opacity: 0.7;
  }

  .rdm-nav-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 1px;
    transition: background 0.12s, color 0.12s;
    position: relative;
  }
  .rdm-nav-item:hover {
    background: rgba(255,255,255,0.04);
  }
  .rdm-nav-item.active {
    background: rgba(200,169,110,0.12);
  }
  .rdm-nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 2.5px;
    height: 16px;
    background: var(--accent, #c8a96e);
    border-radius: 0 2px 2px 0;
  }
  .rdm-nav-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.12s;
  }
  .rdm-nav-item.active .rdm-nav-icon,
  .rdm-nav-item:hover .rdm-nav-icon {
    opacity: 1;
  }
  .rdm-nav-label {
    font-size: 12.5px;
    font-weight: 400;
    color: var(--text-secondary, #a0a09a);
    transition: color 0.12s;
    letter-spacing: 0.01em;
  }
  .rdm-nav-item.active .rdm-nav-label {
    color: var(--accent, #c8a96e);
    font-weight: 500;
  }
  .rdm-nav-item:hover .rdm-nav-label {
    color: var(--text-primary, #f0ede8);
  }

  /* ── 主内容区 ──────────────────────────── */
  .rdm-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .rdm-header {
    height: 46px;
    flex-shrink: 0;
    border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-surface, #111);
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 10px;
  }
  .rdm-header-icon {
    font-size: 15px;
    opacity: 0.8;
  }
  .rdm-header-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #f0ede8);
    letter-spacing: 0.01em;
  }
  .rdm-header-divider {
    width: 0.5px;
    height: 14px;
    background: var(--border, rgba(255,255,255,0.1));
    margin: 0 4px;
  }
  .rdm-header-badge {
    font-size: 10px;
    color: var(--text-tertiary, #6e6e73);
    letter-spacing: 0.04em;
    margin-left: auto;
  }

  .rdm-content {
    flex: 1;
    overflow: hidden;
    background: var(--bg-primary, #0d0d0d);
  }
`;

function RdmApp({ currentUser }: { currentUser?: string }) {
  const [active, setActive] = useState('dashboard');

  const renderContent = () => {
    switch (active) {
      case 'dashboard':   return <Dashboard />;
      case 'eln':         return <ELNView currentUser={currentUser} />;
      case 'inventory':   return <InventoryView currentUser={currentUser} />;
      case 'projects':    return <ProjectsView currentUser={currentUser} />;
      case 'instruments': return <InstrumentsView currentUser={currentUser} />;
      case 'approvals':   return <ApprovalsView currentUser={currentUser} />;
      case 'reports':     return <ReportsView />;
      case 'audit':       return <AuditView />;
      default: return null;
    }
  };

  const current = NAV.find(n => n.id === active);

  // Group nav items by section
  const sections = ['工作台', '管理'];

  return (
    <>
      <style>{css}</style>
      <div className="rdm-root">
        {/* ── 侧边栏 ── */}
        <nav className="rdm-nav">
          <div className="rdm-nav-brand">
            <div className="rdm-nav-brand-title">科研平台</div>
            <div className="rdm-nav-brand-sub">Research Data Manager</div>
          </div>

          <div className="rdm-nav-body">
            {sections.map(section => (
              <div key={section}>
                <div className="rdm-nav-section-label">{section}</div>
                {NAV.filter(item => item.section === section).map(item => (
                  <div
                    key={item.id}
                    className={`rdm-nav-item${active === item.id ? ' active' : ''}`}
                    onClick={() => setActive(item.id)}
                  >
                    <span className="rdm-nav-icon">{item.icon}</span>
                    <span className="rdm-nav-label">{item.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </nav>

        {/* ── 主区域 ── */}
        <div className="rdm-main">
          <div className="rdm-header">
            <span className="rdm-header-icon">{current?.icon}</span>
            <span className="rdm-header-title">{current?.label}</span>
            <div className="rdm-header-divider" />
            <span className="rdm-header-badge">科研数据管理平台</span>
          </div>
          <div className="rdm-content">
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
}

export const RdmPlugin: React.FC<{ currentUser?: string }> = ({ currentUser }) => (
  <Provider store={getRdmStore()}>
    <RdmApp currentUser={currentUser} />
  </Provider>
);

// ── 侧边栏嵌入版（精简） ─────────────────────────────────────
export const RdmSidebarPanel: React.FC = () => {
  const [active, setActive] = useState<'dashboard' | 'eln' | 'projects' | 'inventory'>('dashboard');

  const tabs = [
    { id: 'dashboard' as const, icon: '◈', label: '总览' },
    { id: 'eln'       as const, icon: '⬡', label: '实验' },
    { id: 'projects'  as const, icon: '▦', label: '项目' },
    { id: 'inventory' as const, icon: '◎', label: '库存' },
  ];

  const renderContent = () => {
    switch (active) {
      case 'dashboard': return (
        <Provider store={getRdmStore()}><Dashboard /></Provider>
      );
      case 'eln': return (
        <Provider store={getRdmStore()}><ELNView /></Provider>
      );
      case 'projects': return (
        <Provider store={getRdmStore()}><ProjectsView /></Provider>
      );
      case 'inventory': return (
        <Provider store={getRdmStore()}><InventoryView /></Provider>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 标题 */}
      <div style={{
        padding: '12px 16px 8px',
        borderBottom: '0.5px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          数据管理
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>科研数据管理平台</div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              flex: 1, padding: '8px 4px', fontSize: 10.5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: active === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${active === tab.id ? 'var(--accent)' : 'transparent'}`,
              transition: 'all 0.15s', letterSpacing: 0.2,
              fontFamily: 'inherit', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, scrollbarWidth: 'none' }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default RdmPlugin;
