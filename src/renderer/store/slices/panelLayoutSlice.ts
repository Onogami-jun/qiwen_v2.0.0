/**
 * panelLayoutSlice — 面板布局 Redux Slice
 * 管理面板树、拖拽状态、活动面板
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ── Types (inline to avoid circular deps) ────────────────────

export type PanelType = 'editor' | 'chat';

export interface LeafPanel {
  id: string;
  type: 'leaf';
  panelType: PanelType;
  title: string;
}

export interface SplitPanel {
  id: string;
  type: 'split';
  direction: 'horizontal' | 'vertical';
  sizes: number[];
  children: PanelNode[];
}

export type PanelNode = LeafPanel | SplitPanel;

export type DropEdge = 'left' | 'right' | 'top' | 'bottom';

export interface PanelLayoutState {
  tree: PanelNode | null;
  dragState: {
    sourcePanelId: string;
    mouseX: number;
    mouseY: number;
    targetContainerId: string | null;
    dropEdge: DropEdge | null;
  } | null;
  activePanelId: string | null;
  loadedDocumentId: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string { return `pn_${Date.now()}_${++_idCounter}`; }

function cloneLeaf(n: PanelNode): PanelNode {
  return n.type === 'leaf' ? { ...n } : { ...n, sizes: [...n.sizes], children: n.children.map(cloneLeaf) as PanelNode[] };
}

function createDefaultLayout(): SplitPanel {
  return {
    id: uid(), type: 'split', direction: 'horizontal', sizes: [60, 40],
    children: [
      { id: uid(), type: 'leaf', panelType: 'editor', title: '编辑器' },
      { id: uid(), type: 'leaf', panelType: 'chat', title: 'AI 对话' },
    ],
  };
}

function findParent(tree: PanelNode, childId: string): { parent: SplitPanel; idx: number } | null {
  function walk(n: PanelNode): { parent: SplitPanel; idx: number } | null {
    if (n.type === 'split') {
      for (let i = 0; i < n.children.length; i++) {
        if (n.children[i].id === childId) return { parent: n, idx: i };
        const r = walk(n.children[i]); if (r) return r;
      }
    }
    return null;
  }
  return walk(tree);
}

function hasAnotherEditor(tree: PanelNode, excludeId: string): boolean {
  if (tree.type === 'leaf') return tree.panelType === 'editor' && tree.id !== excludeId;
  return tree.children.some(c => hasAnotherEditor(c, excludeId));
}

function normalizeSizes(tree: PanelNode): void {
  if (tree.type === 'leaf') return;
  const total = tree.sizes.reduce((a, b) => a + b, 0);
  if (total === 0 || Math.abs(total - 100) > 0.1) {
    tree.sizes = tree.children.map(() => 100 / tree.children.length);
  }
  tree.children.forEach(normalizeSizes);
}

// ── Slice ────────────────────────────────────────────────────

const panelLayoutSlice = createSlice({
  name: 'panelLayout',
  initialState: (): PanelLayoutState => ({
    tree: null, dragState: null, activePanelId: null, loadedDocumentId: null,
  }),
  reducers: {
    initLayout(state, action: PayloadAction<{ documentId: string; savedTree: PanelNode | null }>) {
      const { documentId, savedTree } = action.payload;
      state.loadedDocumentId = documentId;
      state.tree = savedTree || createDefaultLayout();
    },

    setTree(state, action: PayloadAction<PanelNode>) { state.tree = action.payload; },

    splitPanel(state, action: PayloadAction<{
      targetId: string; direction: 'horizontal' | 'vertical';
      newPanelType: PanelType; position: DropEdge;
    }>) {
      if (!state.tree) return;
      const { targetId, direction, newPanelType, position } = action.payload;
      const found = findParent(state.tree, targetId);
      const isFirst = position === 'left' || position === 'top';

      const newPanel: LeafPanel = {
        id: uid(), type: 'leaf', panelType: newPanelType,
        title: newPanelType === 'chat' ? 'AI 对话' : '编辑器',
      };

      if (!found) {
        if (state.tree.type === 'leaf' && state.tree.id === targetId) {
          const children: [PanelNode, PanelNode] = isFirst
            ? [newPanel, cloneLeaf(state.tree)] : [cloneLeaf(state.tree), newPanel];
          state.tree = { id: uid(), type: 'split', direction, sizes: [50, 50], children };
        }
        return;
      }

      const { parent, idx } = found;
      const existing = parent.children[idx];
      const children: [PanelNode, PanelNode] = isFirst
        ? [newPanel, cloneLeaf(existing)] : [cloneLeaf(existing), newPanel];
      parent.children[idx] = { id: uid(), type: 'split', direction, sizes: [50, 50], children };
      normalizeSizes(state.tree);
    },

    closePanel(state, action: PayloadAction<string>) {
      if (!state.tree) return;
      const panelId = action.payload;
      if (!hasAnotherEditor(state.tree, panelId)) return;
      const found = findParent(state.tree, panelId);
      if (!found) return;

      const sibling = found.parent.children[found.idx === 0 ? 1 : 0];
      const gp = findParent(state.tree, found.parent.id);
      if (gp) {
        gp.parent.children[gp.idx] = sibling;
        if (gp.parent.children.length === 1) {
          const ggp = findParent(state.tree, gp.parent.id);
          if (ggp) ggp.parent.children[ggp.idx] = sibling;
        }
      } else {
        state.tree = sibling;
      }
      normalizeSizes(state.tree);
    },

    resizePanel(state, action: PayloadAction<{ splitId: string; sizes: number[] }>) {
      if (!state.tree) return;
      function walk(n: PanelNode) {
        if (n.id === action.payload.splitId && n.type === 'split') { n.sizes = action.payload.sizes; return; }
        if (n.type === 'split') n.children.forEach(walk);
      }
      walk(state.tree);
    },

    setActivePanel(state, action: PayloadAction<string | null>) { state.activePanelId = action.payload; },

    startDrag(state, action: PayloadAction<{ panelId: string; mouseX: number; mouseY: number }>) {
      state.dragState = { sourcePanelId: action.payload.panelId, mouseX: action.payload.mouseX, mouseY: action.payload.mouseY, targetContainerId: null, dropEdge: null };
    },
    updateDrag(state, action: PayloadAction<{ mouseX: number; mouseY: number; targetContainerId: string | null; dropEdge: DropEdge | null }>) {
      if (state.dragState) Object.assign(state.dragState, action.payload);
    },
    endDrag(state) { state.dragState = null; },
  },
});

export const { initLayout, setTree, splitPanel, closePanel, resizePanel, setActivePanel, startDrag, updateDrag, endDrag } = panelLayoutSlice.actions;
export default panelLayoutSlice.reducer;
