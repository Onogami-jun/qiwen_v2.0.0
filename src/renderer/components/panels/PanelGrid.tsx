/**
 * PanelGrid — 面板系统根容器（浮动窗口版）
 */
import React, { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { initLayout } from '../../store/slices/panelLayoutSlice';
import type { PanelNode, LeafPanel, FloatingPanelState } from '../../store/slices/panelLayoutSlice';
import SplitPane from './SplitPane';
import EditorPanel from './EditorPanel';
import ChatPanel from './ChatPanel';
import DragOverlay from './DragOverlay';
import FloatingLayer from './FloatingLayer';
import { ipc } from '../../utils/ipc';

// ── Renderer ─────────────────────────────────────────────────

export function renderPanelNode(node: PanelNode, path: string, editorChildren?: React.ReactNode, getDocContent?: () => string): React.ReactNode {
  if (node.type === 'split') return <SplitPane node={node} path={path} editorChildren={editorChildren} getDocContent={getDocContent} />;
  const leaf = node as LeafPanel;
  if (leaf.panelType === 'chat') return <ChatPanel node={leaf} getDocumentContent={getDocContent} />;
  return <EditorPanel node={leaf}>{editorChildren}</EditorPanel>;
}

// ── Props ────────────────────────────────────────────────────

interface Props { documentId: string; children: React.ReactNode; getDocumentContent?: () => string; }

const PanelGrid: React.FC<Props> = ({ documentId, children, getDocumentContent }) => {
  const dispatch = useDispatch<AppDispatch>();
  const tree = useSelector((s: RootState) => (s as any).panelLayout?.tree) as PanelNode | null;
  const floating = useSelector((s: RootState) => (s as any).panelLayout?.floatingPanels as FloatingPanelState[] | undefined) || [];
  const loadedId = useSelector((s: RootState) => (s as any).panelLayout?.loadedDocumentId) as string | null;

  // Init
  useEffect(() => {
    if (documentId === loadedId) return; let c = false;
    (async () => {
      let savedTree: PanelNode | null = null;
      let savedFloating: FloatingPanelState[] | undefined;
      try {
        const json = await ipc.invoke<string | null>('db:getPanelLayout', documentId);
        if (json) {
          const parsed = JSON.parse(json);
          // Support both old (just tree) and new (tree + floating) format
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.type) {
            savedTree = parsed; // old format: just the tree
          } else if (parsed?.tree) {
            savedTree = parsed.tree;
            savedFloating = parsed.floatingPanels;
          }
        }
      } catch {}
      if (!c) dispatch(initLayout({ documentId, savedTree, savedFloating }));
    })();
    return () => { c = true; };
  }, [documentId, loadedId, dispatch]);

  // Persist — use refs for latest values
  const treeRef = useRef(tree);
  const floatingRef = useRef(floating);
  treeRef.current = tree;
  floatingRef.current = floating;

  useEffect(() => {
    if (tree && documentId) {
      const tm = setTimeout(async () => {
        const payload = { tree: treeRef.current, floatingPanels: floatingRef.current || [] };
        try { await ipc.invoke('db:savePanelLayout', { documentId, layoutJson: JSON.stringify(payload) }); } catch {}
      }, 600);
      return () => clearTimeout(tm);
    }
  }, [tree, floating, documentId]);

  if (!tree) return <div style={{ flex: 1 }}>{children}</div>;

  return (
    <div className="pn-grid">
      {renderPanelNode(tree, 'root', children, getDocumentContent)}
      <FloatingLayer editorChildren={children} getDocContent={getDocumentContent} />
      <DragOverlay />
    </div>
  );
};

export default React.memo(PanelGrid);
