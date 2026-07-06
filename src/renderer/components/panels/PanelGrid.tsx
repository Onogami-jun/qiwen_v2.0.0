/**
 * PanelGrid — 面板系统根容器
 * 加载/持久化布局，递归渲染面板树，挂载 DragOverlay
 */
import React, { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { initLayout } from '../../store/slices/panelLayoutSlice';
import type { PanelNode, LeafPanel, SplitPanel as SplitPanelType } from './types';
import SplitPane from './SplitPane';
import EditorPanel from './EditorPanel';
import ChatPanel from './ChatPanel';
import DragOverlay from './DragOverlay';
import { ipc } from '../../utils/ipc';

// ── Panel node renderer (exported for SplitPane) ────────────

export function renderPanelNode(
  node: PanelNode, containerId: string,
  editorChildren?: React.ReactNode,
  getDocContent?: () => string,
): React.ReactNode {
  if (node.type === 'split') return <SplitPane node={node as SplitPanelType} containerId={containerId} editorChildren={editorChildren} getDocContent={getDocContent} />;
  const leaf = node as LeafPanel;
  if (leaf.panelType === 'chat') return <ChatPanel node={leaf} getDocumentContent={getDocContent} />;
  return <EditorPanel node={leaf}>{editorChildren}</EditorPanel>;
}

// ── Props ────────────────────────────────────────────────────

interface Props { documentId: string; children: React.ReactNode; getDocumentContent?: () => string; }

const PanelGrid: React.FC<Props> = ({ documentId, children, getDocumentContent }) => {
  const dispatch = useDispatch<AppDispatch>();
  const tree = useSelector((s: RootState) => (s as any).panelLayout?.tree) as PanelNode | null;
  const loadedId = useSelector((s: RootState) => (s as any).panelLayout?.loadedDocumentId) as string | null;

  // Init layout
  useEffect(() => {
    if (documentId === loadedId) return; let c = false;
    (async () => {
      let saved: PanelNode | null = null;
      try { const json = await ipc.invoke<string | null>('db:getPanelLayout', documentId); if (json) saved = JSON.parse(json); } catch {}
      if (!c) dispatch(initLayout({ documentId, savedTree: saved }));
    })();
    return () => { c = true; };
  }, [documentId, loadedId, dispatch]);

  // Persist on change (debounced)
  const persist = useCallback(async (t: PanelNode) => { try { await ipc.invoke('db:savePanelLayout', { documentId, layoutJson: JSON.stringify(t) }); } catch {} }, [documentId]);
  useEffect(() => { if (tree && documentId) { const tm = setTimeout(() => persist(tree), 500); return () => clearTimeout(tm); } }, [tree, documentId, persist]);

  if (!tree) return <div style={{ flex: 1 }}>{children}</div>;

  return (
    <div className="pn-grid">
      {renderPanelNode(tree, 'root', children, getDocumentContent)}
      <DragOverlay />
    </div>
  );
};

export default React.memo(PanelGrid);
