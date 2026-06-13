/**
 * UserPluginEditor.tsx
 * 用户自建插件编辑器
 * 提供代码编辑器让用户用 React JSX 编写自己的插件
 */
import React, { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { installPlugin } from '../../store/slices/pluginsSlice';

const TEMPLATE = `// 启文插件模板 — 在这里编写你的插件
// 文档: https://bitwool.cn/docs/plugin-dev

const MyPlugin = ({ ctx }) => {
  const [input, setInput] = React.useState('');
  const [result, setResult] = React.useState('');

  const handleRun = () => {
    const content = ctx.getContent();
    // 在这里处理文档内容...
    const wordCount = content.replace(/<[^>]+>/g, '').length;
    setResult('文档字符数：' + wordCount);
    ctx.notify('分析完成', 'success');
  };

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        我的自定义插件
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="输入参数..."
        style={{ width: '100%', height: 28, padding: '0 8px', borderRadius: 6,
          background: 'var(--bg-surface3)', border: '0.5px solid var(--border)',
          color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none',
          boxSizing: 'border-box', marginBottom: 8 }}
      />
      <button
        onClick={handleRun}
        style={{ width: '100%', height: 28, borderRadius: 6, border: 'none',
          background: 'var(--accent)', color: '#fff', cursor: 'pointer',
          fontSize: 12, fontFamily: 'inherit', marginBottom: 10 }}>
        运行
      </button>
      {result && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px',
          background: 'var(--bg-surface3)', borderRadius: 6 }}>
          {result}
        </div>
      )}
    </div>
  );
};`;

const META_TEMPLATE = {
  id: 'user-plugin-' + Date.now(),
  name: '我的插件',
  version: '1.0.0',
  description: '',
  icon: '🔧',
  author: '',
  category: 'utility' as const,
};

export const UserPluginEditor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [code, setCode] = useState(TEMPLATE);
  const [meta, setMeta] = useState(META_TEMPLATE);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'code' | 'meta'>('code');

  const handleSave = useCallback(() => {
    setError('');
    if (!meta.name.trim()) { setError('插件名称不能为空'); return; }
    if (!meta.id.trim()) { setError('插件 ID 不能为空'); return; }

    try {
      // 验证代码语法（基础检查）
      if (!code.includes('const') && !code.includes('function')) {
        setError('插件代码需要包含组件定义');
        return;
      }

      // 注册为用户插件
      const plugin = {
        id: meta.id,
        name: meta.id,
        displayName: meta.name,
        version: meta.version,
        description: meta.description || '用户自建插件',
        author: meta.author || '用户',
        category: meta.category,
        tags: ['用户插件'],
        isEnabled: true,
        isInstalled: true,
        isPaid: false,
        price: 0,
        icon: meta.icon,
        entryPoint: `user:${meta.id}`,
        permissions: ['read-documents', 'write-documents'] as any,
        settings: {},
        settingsSchema: [],
        installedAt: Date.now(),
        updatedAt: Date.now(),
        // 存储用户代码
        _userCode: code,
      };

      // 存储到 localStorage
      const userPlugins = JSON.parse(localStorage.getItem('qiwen-user-plugins') || '[]');
      const existing = userPlugins.findIndex((p: any) => p.id === meta.id);
      if (existing >= 0) userPlugins[existing] = plugin;
      else userPlugins.push(plugin);
      localStorage.setItem('qiwen-user-plugins', JSON.stringify(userPlugins));

      dispatch(installPlugin(plugin as any));
      onClose();
    } catch (e: any) {
      setError('保存失败：' + e.message);
    }
  }, [code, meta, dispatch, onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 680, height: 560, background: 'var(--bg-surface)', border: '0.5px solid var(--border-md)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        {/* 标题栏 */}
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>创建自定义插件</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>使用 React 编写你自己的启文插件</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          {(['code', 'meta'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: tab === t ? 'var(--accent)' : 'var(--text-tertiary)', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, fontFamily: 'inherit', transition: 'color 0.15s' }}>
              {t === 'code' ? '插件代码' : '插件信息'}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {tab === 'code' ? (
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                spellCheck={false}
                style={{ width: '100%', height: '100%', padding: '14px 16px', border: 'none', background: '#0d0d12', color: '#d4d0ca', fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box' as const, tabSize: 2 }}
              />
            </div>
          ) : (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'name', label: '插件名称 *', placeholder: '我的插件', type: 'text' },
                { key: 'id', label: '插件 ID *', placeholder: 'my-plugin', type: 'text' },
                { key: 'version', label: '版本号', placeholder: '1.0.0', type: 'text' },
                { key: 'description', label: '描述', placeholder: '插件功能描述...', type: 'text' },
                { key: 'author', label: '作者', placeholder: '你的名字', type: 'text' },
                { key: 'icon', label: '图标（emoji）', placeholder: '🔧', type: 'text' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ width: 110, fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</label>
                  <input
                    value={(meta as any)[key]}
                    onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ flex: 1, height: 32, padding: '0 10px', borderRadius: 7, background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent-border)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                  />
                </div>
              ))}
              <div style={{ padding: '10px 14px', background: 'rgba(200,169,110,0.06)', borderRadius: 8, border: '0.5px solid var(--accent-border)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                💡 插件代码使用 React JSX 编写。组件接收 <code style={{ color: 'var(--accent)' }}>ctx</code> 参数，包含读写文档、插入内容、显示通知等 API。
                <br />
                <a href="https://bitwool.cn/docs/plugin-dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>查看开发文档 →</a>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div style={{ padding: '12px 18px', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {error ? (
            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>保存后插件将出现在插件市场中</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ height: 30, padding: '0 14px', borderRadius: 7, border: '0.5px solid var(--border-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>取消</button>
            <button onClick={handleSave} style={{ height: 30, padding: '0 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500 }}>保存插件</button>
          </div>
        </div>
      </div>
    </div>
  );
};
