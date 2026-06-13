import React, { useState, Suspense, lazy } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { togglePlugin } from '../store/slices/pluginsSlice';

// ── 懒加载所有插件组件，避免启动时全量加载 810 行的 PluginPanels ──
const FocusTimerPlugin    = lazy(() => import('./PluginPanels').then(m => ({ default: m.FocusTimerPlugin })));
const QuickNotePlugin     = lazy(() => import('./PluginPanels').then(m => ({ default: m.QuickNotePlugin })));
const CitationManagerPlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.CitationManagerPlugin })));
const ClauseLibraryPlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.ClauseLibraryPlugin })));
const LegalCheckerPlugin  = lazy(() => import('./PluginPanels').then(m => ({ default: m.LegalCheckerPlugin })));
const CaseTimelinePlugin  = lazy(() => import('./PluginPanels').then(m => ({ default: m.CaseTimelinePlugin })));
const LessonPlannerPlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.LessonPlannerPlugin })));
const QuizGeneratorPlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.QuizGeneratorPlugin })));
const MindmapPlugin       = lazy(() => import('./PluginPanels').then(m => ({ default: m.MindmapPlugin })));
const MedicalTemplatePlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.MedicalTemplatePlugin })));
const DrugReferencePlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.DrugReferencePlugin })));
const ICDLookupPlugin     = lazy(() => import('./PluginPanels').then(m => ({ default: m.ICDLookupPlugin })));
const ReadabilityPlugin   = lazy(() => import('./PluginPanels').then(m => ({ default: m.ReadabilityPlugin })));
const CharacterTrackerPlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.CharacterTrackerPlugin })));
const StyleCheckerPlugin  = lazy(() => import('./PluginPanels').then(m => ({ default: m.StyleCheckerPlugin })));
const KeywordExtractorPlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.KeywordExtractorPlugin })));
const OutlineBuilderPlugin = lazy(() => import('./PluginPanels').then(m => ({ default: m.OutlineBuilderPlugin })));
const RdmSidebarPanel     = lazy(() => import('./rdm/RdmPlugin').then(m => ({ default: m.RdmSidebarPanel })));

type PluginPanelComponent = React.FC<{ content?: string }>;

const PLUGIN_COMPONENTS: Record<string, PluginPanelComponent> = {
  'focus-timer':       FocusTimerPlugin as PluginPanelComponent,
  'quick-note':        QuickNotePlugin as PluginPanelComponent,
  'citation-manager':  CitationManagerPlugin as PluginPanelComponent,
  'clause-library':    ClauseLibraryPlugin as PluginPanelComponent,
  'legal-checker':     LegalCheckerPlugin as PluginPanelComponent,
  'case-timeline':     CaseTimelinePlugin as PluginPanelComponent,
  'lesson-planner':    LessonPlannerPlugin as PluginPanelComponent,
  'quiz-generator':    QuizGeneratorPlugin as PluginPanelComponent,
  'mindmap-preview':   MindmapPlugin as PluginPanelComponent,
  'medical-template':  MedicalTemplatePlugin as PluginPanelComponent,
  'drug-reference':    DrugReferencePlugin as PluginPanelComponent,
  'icd-lookup':        ICDLookupPlugin as PluginPanelComponent,
  'readability-score': ReadabilityPlugin as PluginPanelComponent,
  'character-tracker': CharacterTrackerPlugin as PluginPanelComponent,
  'style-checker':     StyleCheckerPlugin as PluginPanelComponent,
  'keyword-extractor': KeywordExtractorPlugin as PluginPanelComponent,
  'outline-builder':   OutlineBuilderPlugin as PluginPanelComponent,
  'data-manager':      RdmSidebarPanel as PluginPanelComponent,
};

const SIDEBAR_EXCLUDED = new Set(['word-counter']);

// 轻量 loading 占位
const PluginLoading = () => (
  <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', opacity: 0.5 }}>
    加载中...
  </div>
);

interface PluginSidebarPanelProps {
  documentContent?: string;
}

export const PluginSidebarPanel: React.FC<PluginSidebarPanelProps> = React.memo(({ documentContent = '' }) => {
  const dispatch = useDispatch<AppDispatch>();
  const installed = useSelector((s: RootState) => s.plugins.installed);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activePlugins = installed.filter(p =>
    p.isEnabled && p.isInstalled && !SIDEBAR_EXCLUDED.has(p.id) && PLUGIN_COMPONENTS[p.id]
  );

  if (activePlugins.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 22, opacity: 0.2, marginBottom: 8 }}>🔌</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          没有启用的插件<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>在「插件」中启用</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {activePlugins.map((plugin, i) => {
        const PluginComponent = PLUGIN_COMPONENTS[plugin.id];
        const isCollapsed = collapsed[plugin.id];
        return (
          <div key={plugin.id} style={{
            borderBottom: i < activePlugins.length - 1 ? '0.5px solid var(--border)' : 'none',
          }}>
            {/* 插件标题栏 */}
            <div
              onClick={() => setCollapsed(prev => ({ ...prev, [plugin.id]: !prev[plugin.id] }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 12px', cursor: 'pointer',
                background: 'transparent',
                transition: 'background 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
                {plugin.icon} {plugin.name}
              </span>
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: 'var(--text-tertiary)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {/* 插件内容——懒加载 */}
            {!isCollapsed && (
              <div style={{ padding: '0 0 4px' }}>
                <Suspense fallback={<PluginLoading />}>
                  <PluginComponent content={documentContent} />
                </Suspense>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

PluginSidebarPanel.displayName = 'PluginSidebarPanel';
