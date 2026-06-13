import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { setPlugins, togglePlugin, installPlugin } from '../store/slices/pluginsSlice';
import { ALL_PLUGINS, getAvailablePlugins } from './pluginRegistry';
import { Plugin, PluginCategory } from '../../shared/types';
import { UserPluginEditor } from './sdk/UserPluginEditor';

const CATEGORY_LABELS: Record<PluginCategory, string> = {
  research: '学术研究',
  writing:  '写作工具',
  reference:'参考资料',
  export:   '导出格式',
  ai:       '人工智能',
  theme:    '外观主题',
  utility:  '效率工具',
};

const CATEGORY_ICONS: Record<PluginCategory, string> = {
  research: '🔬', writing: '✍️', reference: '📚',
  export: '📤', ai: '🤖', theme: '🎨', utility: '⚙️',
};

export const PluginsView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const installedPlugins = useSelector((s: RootState) => s.plugins.installed);
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const workspaces = useSelector((s: RootState) => s.workspaces.items);

  const workspace = workspaces.find(w => w.id === activeWorkspaceId);
  const profession = workspace?.profession ?? 'general';

  // ── 可用插件：排除掉已安装的 ──────────────────────────
  const installedIds = new Set(installedPlugins.map(p => p.id));
  const available = getAvailablePlugins(profession).filter(p => !installedIds.has(p.id));

  const [tab, setTab] = useState<'installed' | 'available'>('installed');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | 'all'>('all');
  const [detail, setDetail] = useState<Plugin | null>(null);
  // 记录正在安装中的插件 id，用于显示动画
  const [installing, setInstalling] = useState<string | null>(null);
  const [showPluginEditor, setShowPluginEditor] = useState(false);

  const filterPlugins = (list: Plugin[]) => list.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.displayName.includes(q) || p.description.includes(q) || p.tags.some(t => t.includes(q));
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const handleToggle = (plugin: Plugin) => {
    dispatch(togglePlugin(plugin.id));
  };

  const handleInstall = async (plugin: Plugin) => {
    setInstalling(plugin.id);
    // 短暂动画延迟，让用户感知安装过程
    await new Promise(r => setTimeout(r, 600));
    dispatch(installPlugin(plugin));
    setInstalling(null);
    // 安装后切换到「已安装」tab
    setTab('installed');
  };

  const allCategories = Array.from(new Set(ALL_PLUGINS.map(p => p.category)));

  return (
    <>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px 0', flexShrink: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>插件市场</div>
            <button onClick={() => setShowPluginEditor(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500 }}>
              <span>+</span> 创建插件
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {installedPlugins.filter(p => p.isEnabled).length} 个已启用 · 根据职业自动推荐
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)' }}>
          {([['installed', `已安装 ${installedPlugins.length}`], ['available', `可用插件 ${available.length}`]] as const).map(([key, lbl]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 13.5, fontFamily: 'inherit',
              color: tab === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.2s',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left category bar */}
        <div style={{ width: 180, borderRight: '0.5px solid var(--border)', padding: '20px 16px', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.8px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>分类</div>
          {(['all', ...allCategories] as const).map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
              background: selectedCategory === cat ? 'var(--bg-hover)' : 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              color: selectedCategory === cat ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 13, textAlign: 'left', transition: 'all 0.15s',
            }}>
              <span>{cat === 'all' ? '📦' : CATEGORY_ICONS[cat as PluginCategory]}</span>
              {cat === 'all' ? '全部' : CATEGORY_LABELS[cat as PluginCategory]}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', flexShrink: 0 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索插件..."
              style={{
                width: '100%', padding: '9px 14px', background: 'var(--bg-surface2)',
                border: '0.5px solid var(--border)', borderRadius: 9,
                fontSize: 13.5, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
            <PluginGrid
              plugins={filterPlugins(tab === 'installed' ? installedPlugins : available)}
              isInstalled={tab === 'installed'}
              installing={installing}
              onToggle={handleToggle}
              onInstall={handleInstall}
              onDetail={setDetail}
            />
          </div>
        </div>
      </div>

      {/* Detail side panel */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 320,
              background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)',
              display: 'flex', flexDirection: 'column', zIndex: 10,
            }}
          >
            <PluginDetail plugin={detail} isInstalled={installedIds.has(detail.id)} installing={installing === detail.id} onClose={() => setDetail(null)} onInstall={handleInstall} onToggle={handleToggle} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {showPluginEditor && <UserPluginEditor onClose={() => setShowPluginEditor(false)} />}
    </>
  );
};

// ── Plugin Grid ───────────────────────────────────────────
const PluginGrid: React.FC<{
  plugins: Plugin[];
  isInstalled: boolean;
  installing: string | null;
  onToggle: (p: Plugin) => void;
  onInstall: (p: Plugin) => Promise<void>;
  onDetail: (p: Plugin) => void;
}> = ({ plugins, isInstalled, installing, onToggle, onInstall, onDetail }) => {
  if (plugins.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
      <div style={{ fontSize: 28, opacity: 0.3 }}>🔌</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
        {isInstalled ? '没有已安装的插件' : '没有更多可用插件'}
      </div>
    </div>
  );

  return (
    <motion.div layout style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <AnimatePresence>
        {plugins.map(p => (
          <PluginCard
            key={p.id} plugin={p} isInstalled={isInstalled}
            installing={installing === p.id}
            onToggle={onToggle} onInstall={onInstall} onDetail={onDetail}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Plugin Card ───────────────────────────────────────────
const PluginCard: React.FC<{
  plugin: Plugin;
  isInstalled: boolean;
  installing: boolean;
  onToggle: (p: Plugin) => void;
  onInstall: (p: Plugin) => Promise<void>;
  onDetail: (p: Plugin) => void;
}> = ({ plugin: p, isInstalled, installing, onToggle, onInstall, onDetail }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onClick={() => onDetail(p)}
      style={{
        padding: 16, borderRadius: 12, cursor: 'pointer',
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Installing shimmer overlay */}
      {installing && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(200,169,110,0.08), transparent)',
            pointerEvents: 'none', zIndex: 2,
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: 'var(--bg-surface3)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18, border: '0.5px solid var(--border)',
        }}>{p.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>{p.displayName}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>v{p.version}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55, flex: 1 }}>
        {p.description.slice(0, 58)}{p.description.length > 58 ? '...' : ''}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-surface3)', color: 'var(--text-tertiary)' }}>
          {CATEGORY_ICONS[p.category]} {CATEGORY_LABELS[p.category]}
        </span>

        {isInstalled ? (
          <ToggleSwitch enabled={p.isEnabled} onToggle={e => { e.stopPropagation(); onToggle(p); }} />
        ) : (
          <motion.button
            onClick={e => { e.stopPropagation(); onInstall(p); }}
            disabled={installing}
            whileTap={{ scale: 0.94 }}
            style={{
              padding: '5px 12px', borderRadius: 7,
              border: '0.5px solid rgba(200,169,110,0.3)',
              background: installing ? 'rgba(200,169,110,0.12)' : 'rgba(200,169,110,0.06)',
              color: 'var(--accent)', fontSize: 11.5,
              cursor: installing ? 'default' : 'pointer',
              fontFamily: 'inherit', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.2s',
            }}
          >
            {installing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--accent)', borderTopColor: 'transparent' }}
                />
                安装中
              </>
            ) : '安装'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

// ── Toggle Switch ─────────────────────────────────────────
const ToggleSwitch: React.FC<{ enabled: boolean; onToggle: (e: React.MouseEvent) => void }> = ({ enabled, onToggle }) => (
  <motion.div
    onClick={onToggle}
    whileTap={{ scale: 0.92 }}
    style={{
      width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
      background: enabled ? '#c8a96e' : 'var(--bg-surface3)',
      border: `1px solid ${enabled ? '#c8a96e' : 'var(--border)'}`,
      position: 'relative', flexShrink: 0,
    }}
  >
    <motion.div
      layout
      animate={{ left: enabled ? 18 : 2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2,
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }}
    />
  </motion.div>
);

// ── Plugin Detail Panel ───────────────────────────────────
const PluginDetail: React.FC<{
  plugin: Plugin;
  isInstalled: boolean;
  installing: boolean;
  onClose: () => void;
  onInstall: (p: Plugin) => Promise<void>;
  onToggle: (p: Plugin) => void;
}> = ({ plugin: p, isInstalled, installing, onClose, onInstall, onToggle }) => {
  return (<>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>插件详情</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'var(--bg-surface2)',
            border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 26, flexShrink: 0,
          }}>{p.icon}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{p.displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.author} · v{p.version}</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>{p.description}</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {p.tags.map(t => (
            <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-surface2)', color: 'var(--text-tertiary)', border: '0.5px solid var(--border)' }}>{t}</span>
          ))}
        </div>

        {p.permissions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.8px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>权限需求</div>
            {p.permissions.map(perm => (
              <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{perm}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action button */}
      <div style={{ padding: 20, borderTop: '0.5px solid var(--border)' }}>
        {isInstalled ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>已安装</span>
            <ToggleSwitch enabled={p.isEnabled} onToggle={() => onToggle(p)} />
          </div>
        ) : (
          <motion.button
            onClick={() => onInstall(p)}
            disabled={installing}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
              background: installing ? 'rgba(200,169,110,0.3)' : 'linear-gradient(135deg, #c8a96e, #9a7040)',
              color: '#fff', fontSize: 14, fontWeight: 500, cursor: installing ? 'default' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {installing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }}
                />
                正在安装...
              </>
            ) : '安装插件'}
          </motion.button>
        )}
      </div>
    </div>
  </>);
};