/**
 * PanelGrid — 面板系统根容器（浮动窗口版）
 */
import React, { useEffect, useRef } from 'react';
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

export function renderPanelNode(node: PanelNode, path: string, ec?: React.ReactNode, gdc?: () => string): React.ReactNode {
  if (node.type === 'split') return <SplitPane node={node} path={path} editorChildren={ec} getDocContent={gdc} />;
  return (node as LeafPanel).panelType === 'chat'
    ? <ChatPanel node={node as LeafPanel} gdc={gdc} />
    : <EditorPanel node={node as LeafPanel}>{ec}</EditorPanel>;
}

interface Props { documentId: string; children: React.ReactNode; getDocumentContent?: () => string; }

const PanelGrid: React.FC<Props> = ({ documentId, children, getDocumentContent }) => {
  const dispatch = useDispatch<AppDispatch>();
  const tree = useSelector((s: RootState) => (s as any).panelLayout?.tree) as PanelNode | null;
  const floating = useSelector((s: RootState) => (s as any).panelLayout?.floatingPanels as FloatingPanelState[] | undefined) || [];
  const loadedId = useSelector((s: RootState) => (s as any).panelLayout?.loadedDocumentId) as string | null;

  const tRef = useRef(tree); const fRef = useRef(floating);
  tRef.current = tree; fRef.current = floating;

  useEffect(() => {
    if (documentId === loadedId) return; let c = false;
    (async () => {
      let st: PanelNode | null = null; let sf: FloatingPanelState[] | undefined;
      try {
        const json = await ipc.invoke<string | null>('db:getPanelLayout', documentId);
        if (json) {
          const p = JSON.parse(json);
          if (p?.tree) { st = p.tree; sf = p.floatingPanels; }
          else if (p?.type) st = p;
        }
      } catch {}
      if (!c) dispatch(initLayout({ documentId, savedTree: st, savedFloating: sf }));
    })();
    return () => { c = true; };
  }, [documentId, loadedId, dispatch]);

  useEffect(() => {
    if (tree && documentId) {
      const tm = setTimeout(async () => {
        try { await ipc.invoke('db:savePanelLayout', { documentId, layoutJson: JSON.stringify({ tree: tRef.current, floatingPanels: fRef.current }) }); } catch {}
      }, 600);
      return () => clearTimeout(tm);
    }
  }, [tree, floating, documentId]);

  if (!tree) return <div style={{ flex: 1 }}>{children}</div>;
  return <div className="pn-grid">{renderPanelNode(tree, 'root', children, getDocumentContent)}<FloatingLayer editorChildren={children} getDocContent={getDocumentContent} /><DragOverlay /></div>;
};

export default React.memo(PanelGrid);
