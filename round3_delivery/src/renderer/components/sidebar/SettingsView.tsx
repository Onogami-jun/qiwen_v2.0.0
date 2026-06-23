import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { loadSettings, saveSetting } from '../../store/slices/settingsSlice';
import { AppSettings } from '../../../shared/types';

type SettingSection = 'appearance' | 'editor' | 'workspace' | 'about';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 32 }}>
    <div style={{ fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--border)' }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
  </div>
);

const Row: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface2)', border: '0.5px solid var(--border)' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 400 }}>{label}</div>
      {desc && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>}
    </div>
    <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
  </div>
);

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer', background: value ? 'linear-gradient(135deg, var(--accent), #9a7040)' : 'var(--bg-surface3)', position: 'relative', transition: 'background var(--dur-base) var(--ease-smooth)', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left var(--dur-base) var(--ease-smooth)', boxShadow: 'var(--shadow-sm)' }} />
  </button>
);

const Select: React.FC<{ value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }> = ({ value, options, onChange }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-md)', borderRadius: 'var(--radius-md)', padding: '5px 10px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', minWidth: 100 }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Slider: React.FC<{ value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }> = ({ value, min, max, step = 1, onChange, unit }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: 100, accentColor: 'var(--accent)', cursor: 'pointer' }} />
    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 36, textAlign: 'right' }}>{value}{unit}</span>
  </div>
);

const NAV: { id: SettingSection; label: string; icon: string }[] = [
  { id: 'appearance', label: '外观', icon: '🎨' },
  { id: 'editor', label: '编辑器', icon: '✏️' },
  { id: 'workspace', label: '工作区', icon: '📁' },
  { id: 'about', label: '关于', icon: 'ℹ️' },
];

// ── API Key 输入组件 ────────────────────────────────────────
const ApiKeyInput: React.FC<{ storeKey: string; placeholder: string }> = ({ storeKey, placeholder }) => {
  const [value, setValue] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('qiwen-api-keys') || '{}')[storeKey] || ''; }
    catch { return ''; }
  });
  const [saved, setSaved] = React.useState(false);
  const handleSave = () => {
    try {
      const keys = JSON.parse(localStorage.getItem('qiwen-api-keys') || '{}');
      keys[storeKey] = value;
      localStorage.setItem('qiwen-api-keys', JSON.stringify(keys));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {}
  };
  return (
    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
      <input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} type="password"
        style={{ flex: 1, height: 28, padding: '0 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent-border)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
      />
      <button onClick={handleSave} style={{ height: 28, padding: '0 10px', borderRadius: 'var(--radius-md)', fontSize: 12, cursor: 'pointer', border: 'none', background: saved ? 'var(--color-success)' : 'var(--accent)', color: '#fff', fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.2s' }}>
        {saved ? '✓' : '保存'}
      </button>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((s: RootState) => s.settings);
  const [active, setActive] = useState<SettingSection>('appearance');

  useEffect(() => { dispatch(loadSettings()); }, [dispatch]);

  const save = (key: keyof AppSettings, value: any) => dispatch(saveSetting({ key, value }));

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <div style={{ width: 180, borderRight: '0.5px solid var(--border)', background: 'var(--bg-surface)', padding: '28px 12px', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20, paddingLeft: 10 }}>设置</div>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setActive(n.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 13.5, textAlign: 'left', marginBottom: 2, background: active === n.id ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent', color: active === n.id ? 'var(--accent)' : 'var(--text-secondary)', transition: 'background 0.15s, color 0.15s' }}
            onMouseOver={e => { if (active !== n.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseOut={e => { if (active !== n.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          ><span>{n.icon}</span>{n.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

        {active === 'appearance' && <>
          <Section title="主题">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {(['dark', 'system', 'light'] as AppSettings['theme'][]).map((t, i) => {
                const info = { dark: { label: '深色', bg: '#0a0a0f', ac: 'var(--accent)' }, system: { label: '跟随系统', bg: '#1a1a2e', ac: '#8b7355' }, light: { label: '浅色', bg: '#f5f5f0', ac: '#9a7040' } }[t]!;
                return (
                  <button key={t} onClick={() => save('theme', t)} style={{ padding: '14px', borderRadius: 'var(--radius-lg)', cursor: 'pointer', border: 'none', background: info.bg, outline: settings.theme === t ? `2px solid ${info.ac}` : '0.5px solid var(--border)', outlineOffset: 2, transition: 'outline 0.15s' }}>
                    <div style={{ width: '100%', height: 24, borderRadius: 'var(--radius-md)', background: info.ac, marginBottom: 8, opacity: 0.8 }} />
                    <div style={{ fontSize: 12, color: t === 'light' ? '#555' : '#888' }}>{info.label}</div>
                    {settings.theme === t && <div style={{ fontSize: 10, color: info.ac, marginTop: 4 }}>✓ 已选择</div>}
                  </button>
                );
              })}
            </div>
          </Section>
          <Section title="强调色">
            <Row label="界面强调色" desc="用于高亮选中项和按钮">
              <div style={{ display: 'flex', gap: 8 }}>
                {['var(--accent)', '#4a9eff', '#b88af0', 'var(--color-success)', '#ff6b6b', '#f0a742'].map(color => (
                  <button key={color} onClick={() => save('accentColor', color)} style={{ width: 22, height: 22, borderRadius: '50%', background: color, border: settings.accentColor === color ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: 'none', flexShrink: 0, boxShadow: settings.accentColor === color ? `0 0 0 2px ${color}` : 'none' }} />
                ))}
              </div>
            </Row>
          </Section>
          <Section title="语言">
            <Row label="界面语言">
              <Select value={settings.language} onChange={v => save('language', v as AppSettings['language'])}
                options={[{ value: 'zh-CN', label: '简体中文' }, { value: 'en-US', label: 'English' }]} />
            </Row>
          </Section>
          <Section title="API 配置">
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.6 }}>
              填入 API Key 后，对应插件将从真实数据库获取数据。留空则使用内置数据。
            </div>
            <Row label="药品数据库 Key">
              <ApiKeyInput storeKey="drugApiKey" placeholder="药智数据 API Key（选填）" />
            </Row>
            <Row label="ICD-11 Client ID">
              <ApiKeyInput storeKey="icdClientId" placeholder="WHO ICD API Client ID（选填）" />
            </Row>
            <Row label="ICD-11 Client Secret">
              <ApiKeyInput storeKey="icdClientSecret" placeholder="WHO ICD API Client Secret（选填）" />
            </Row>
            <Row label="法律数据库 Key">
              <ApiKeyInput storeKey="legalApiKey" placeholder="北大法宝/无讼 API Key（选填）" />
            </Row>
            <Row label="Semantic Scholar Key">
              <ApiKeyInput storeKey="semanticScholarKey" placeholder="申请后可提升配额（选填）" />
            </Row>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
              CrossRef 文献查询无需 Key，始终可用
            </div>
          </Section>
        </>}

        {active === 'editor' && <>
          <Section title="文字">
            <Row label="字体大小">
              <Slider value={settings.fontSize} min={12} max={24} onChange={v => save('fontSize', v)} unit="px" />
            </Row>
            <Row label="行高">
              <Slider value={settings.lineHeight} min={1.4} max={2.4} step={0.1} onChange={v => save('lineHeight', v)} />
            </Row>
            <Row label="字体风格">
              <Select value={settings.fontFamily} onChange={v => save('fontFamily', v)}
                options={[{ value: 'default', label: '默认' }, { value: 'serif', label: '宋体' }, { value: 'mono', label: '等宽' }]} />
            </Row>
            <Row label="编辑区域宽度">
              <Select value={settings.editorWidth} onChange={v => save('editorWidth', v as AppSettings['editorWidth'])}
                options={[{ value: 'narrow', label: '窄' }, { value: 'normal', label: '正常' }, { value: 'wide', label: '宽' }, { value: 'full', label: '全宽' }]} />
            </Row>
          </Section>
          <Section title="行为">
            <Row label="自动保存">
              <Toggle value={settings.autoSave} onChange={v => save('autoSave', v)} />
            </Row>
            <Row label="自动保存间隔">
              <Select value={String(settings.autoSaveInterval)} onChange={v => save('autoSaveInterval', Number(v))}
                options={[{ value: '1000', label: '1秒' }, { value: '3000', label: '3秒' }, { value: '10000', label: '10秒' }, { value: '30000', label: '30秒' }]} />
            </Row>
            <Row label="拼写检查">
              <Toggle value={settings.spellCheck} onChange={v => save('spellCheck', v)} />
            </Row>
            <Row label="显示字数统计">
              <Toggle value={settings.showWordCount} onChange={v => save('showWordCount', v)} />
            </Row>
            <Row label="显示行号">
              <Toggle value={settings.showLineNumbers} onChange={v => save('showLineNumbers', v)} />
            </Row>
          </Section>
          <Section title="专注模式">
            <Row label="背景模糊度" desc="专注模式下背景虚化程度">
              <Slider value={settings.focusModeBlur} min={0} max={100} onChange={v => save('focusModeBlur', v)} unit="%" />
            </Row>
          </Section>
        </>}

        {active === 'workspace' && <>
          <Section title="布局">
            <Row label="侧边栏宽度">
              <Slider value={settings.sidebarWidth} min={180} max={320} step={10} onChange={v => save('sidebarWidth', v)} unit="px" />
            </Row>
            <Row label="右侧面板宽度">
              <Slider value={settings.rightPanelWidth} min={200} max={400} step={10} onChange={v => save('rightPanelWidth', v)} unit="px" />
            </Row>
          </Section>
          <Section title="数据">
            <Row label="数据存储位置" desc="文档数据库保存在 AppData/qiwen 目录">
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>%APPDATA%/qiwen/data</span>
            </Row>
            <Row label="导出所有数据" desc="将所有文档导出为 Markdown 文件">
              <button onClick={() => alert('导出功能即将上线')} style={{ padding: '6px 14px', background: 'var(--bg-surface3)', border: '0.5px solid var(--border-md)', borderRadius: 'var(--radius-md)', fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>导出</button>
            </Row>
          </Section>
        </>}

        {active === 'about' && <>
          <div style={{ textAlign: 'center', padding: '32px 0 40px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 'var(--radius-2xl)', margin: '0 auto 16px', background: 'linear-gradient(135deg, var(--accent), #8b7355)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, color: '#fff', fontFamily: 'var(--font-serif)' }}>文</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>启文</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>版本 1.0.0</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>本地优先的知识管理与写作平台</div>
          </div>
          <Section title="联系我们">
            <Row label="官方网站"><a href="https://bitwool.cn" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>bitwool.cn</a></Row>
            <Row label="意见反馈"><a href="mailto:bitwool@163.com" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>bitwool@163.com</a></Row>
          </Section>
          <Section title="法律">
            <Row label="隐私政策"><a href="https://bitwool.cn/privacy.html" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>查看 →</a></Row>
            <Row label="用户协议"><a href="https://bitwool.cn/terms.html" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>查看 →</a></Row>
            <Row label="版权"><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>© 2024 启文团队</span></Row>
          </Section>
          <Section title="诊断">
            <Row label="运行日志" desc="记录所有错误和操作，帮助排查问题">
              <button onClick={() => logger.openDir()} style={{
                padding: '5px 12px', background: 'var(--bg-surface3)',
                border: '0.5px solid var(--border-md)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>打开日志目录</button>
            </Row>
          </Section>
        </>}
      </div>
    </div>
  );
};
