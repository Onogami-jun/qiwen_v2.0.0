/**
 * panelLayoutSlice — 面板布局 Redux Slice
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ── Types ────────────────────────────────────────────────────

export type PanelType = 'editor' | 'chat';
export interface LeafPanel { id: string; type: 'leaf'; panelType: PanelType; title: string; }
export interface SplitPanel { id: string; type: 'split'; direction: 'horizontal' | 'vertical'; sizes: number[]; children: PanelNode[]; }
export type PanelNode = LeafPanel | SplitPanel;
export type DropEdge = 'left' | 'right' | 'top' | 'bottom';

export interface PanelLayoutState {
  tree: PanelNode | null;
  dragState: { sourcePanelId: string; mouseX: number; mouseY: number; targetContainerId: string | null; dropEdge: DropEdge | null; } | null;
  activePanelId: string | null;
  loadedDocumentId: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

let _c = 0;
function uid(): string { return `pn_${Date.now()}_${++_c}_${Math.random().toString(36).slice(2,6)}`; }

function cloneNode(n: PanelNode): PanelNode {
  if (n.type === 'leaf') return { ...n };
  return { ...n, sizes: [...n.sizes], children: n.children.map(cloneNode) };
}

function createDefault(): SplitPanel {
  return {
    id: uid(), type: 'split', direction: 'horizontal', sizes: [60, 40],
    children: [
      { id: uid(), type: 'leaf', panelType: 'editor', title: '编辑器' },
      { id: uid(), type: 'leaf', panelType: 'chat', title: 'AI 对话' },
    ],
  };
}

function findParent(root: PanelNode, childId: string): { parent: SplitPanel; idx: number } | null {
  function walk(n: PanelNode): { parent: SplitPanel; idx: number } | null {
    if (n.type !== 'split') return null;
    for (let i = 0; i < n.children.length; i++) {
      if (n.children[i].id === childId) return { parent: n, idx: i };
      const r = walk(n.children[i]); if (r) return r;
    }
    return null;
  }
  if (root.id === childId) return null;
  return walk(root);
}

function hasOtherEditor(tree: PanelNode, excludeId: string): boolean {
  if (tree.type === 'leaf') return tree.panelType === 'editor' && tree.id !== excludeId;
  return tree.children.some(c => hasOtherEditor(c, excludeId));
}

function normalize(node: PanelNode): void {
  if (node.type !== 'split') return;
  if (node.children.length === 0) return;
  const total = node.sizes.reduce((a, b) => a + b, 0);
  if (total <= 0 || Math.abs(total - 100) > 1) {
    const sum = node.sizes.reduce((a, b) => a + b, 0) || node.children.length * 50;
    node.sizes = node.sizes.map(s => Math.max(10, (s / sum) * 100));
    const total2 = node.sizes.reduce((a, b) => a + b, 0);
    if (Math.abs(total2 - 100) > 0.5) {
      const maxI = node.sizes.indexOf(Math.max(...node.sizes));
      node.sizes[maxI] += (100 - total2);
    }
  }
  node.children.forEach(normalize);
}

// ── Slice ────────────────────────────────────────────────────

const panelLayoutSlice = createSlice({
  name: 'panelLayout',
  initialState: (): PanelLayoutState => ({ tree: null, dragState: null, activePanelId: null, loadedDocumentId: null }),
  reducers: {

    initLayout(s, a: PayloadAction<{ documentId: string; savedTree: PanelNode | null }>) {
      s.loadedDocumentId = a.payload.documentId;
      s.tree = a.payload.savedTree || createDefault();
      function firstEditor(n: PanelNode): string | null {
        if (n.type === 'leaf') return n.panelType === 'editor' ? n.id : null;
        for (const c of n.children) { const r = firstEditor(c); if (r) return r; }
        return null;
      }
      s.activePanelId = firstEditor(s.tree);
    },

    setTree(s, a: PayloadAction<PanelNode>) { s.tree = a.payload; },

    splitPanel(s, a: PayloadAction<{
      targetId: string; direction: 'horizontal' | 'vertical';
      newPanelType: PanelType; position: DropEdge;
    }>) {
      if (!s.tree) return;
      const { targetId, direction, newPanelType, position } = a.payload;

      const newPanel: LeafPanel = {
        id: uid(), type: 'leaf', panelType: newPanelType,
        title: newPanelType === 'chat' ? 'AI 对话' : '编辑器',
      };

      const first = position === 'left' || position === 'top';

      if (s.tree.id === targetId && s.tree.type === 'leaf') {
        const old = cloneNode(s.tree);
        s.tree = {
          id: uid(), type: 'split', direction, sizes: [50, 50],
          children: first ? [newPanel, old] : [old, newPanel],
        };
        normalize(s.tree);
        return;
      }

      const found = findParent(s.tree, targetId);
      if (!found) return;
      const { parent, idx } = found;
      const existing = parent.children[idx];
      const children: PanelNode[] = first
        ? [newPanel, cloneNode(existing)]
        : [cloneNode(existing), newPanel];
      parent.children[idx] = {
        id: uid(), type: 'split', direction, sizes: [50, 50], children,
      };
      normalize(s.tree);
    },

    closePanel(s, a: PayloadAction<string>) {
      if (!s.tree) return;
      const panelId = a.payload;
      if (!hasOtherEditor(s.tree, panelId)) return;
      if (s.tree.id === panelId) return;

      const found = findParent(s.tree, panelId);
      if (!found) return;

      const { parent, idx } = found;
      const sibling = parent.children[idx === 0 ? 1 : 0];

      const gp = findParent(s.tree, parent.id);
      if (!gp) {
        s.tree = sibling;
        normalize(s.tree);
        return;
      }

      gp.parent.children[gp.idx] = sibling;
      if (gp.parent.children.length <= 1 && gp.parent.id === s.tree!.id) {
        s.tree = sibling;
      }
      normalize(s.tree);

      gp.parent.sizes.splice(gp.idx, 1);
      if (gp.parent.sizes.length === 0) {
        gp.parent.sizes = gp.parent.children.map(() => 100 / gp.parent.children.length);
      }
      normalize(s.tree);
    },

    resizePanel(s, a: PayloadAction<{ splitId: string; sizes: number[] }>) {
      if (!s.tree) return;
      function walk(n: PanelNode) {
        if (n.id === a.payload.splitId && n.type === 'split') { n.sizes = a.payload.sizes; return; }
        if (n.type === 'split') n.children.forEach(walk);
      }
      walk(s.tree);
    },

    setActivePanel(s, a: PayloadAction<string | null>) { s.activePanelId = a.payload; },

    startDrag(s, a: PayloadAction<{ panelId: string; mouseX: number; mouseY: number }>) {
      s.dragState = {
        sourcePanelId: a.payload.panelId,
        mouseX: a.payload.mouseX,
        mouseY: a.payload.mouseY,
        targetContainerId: null,
        dropEdge: null,
      };
    },
    updateDrag(s, a: PayloadAction<{ mouseX: number; mouseY: number; targetContainerId: string | null; dropEdge: DropEdge | null }>) {
      if (s.dragState) Object.assign(s.dragState, a.payload);
    },
    endDrag(s) { s.dragState = null; },
  },
});

export const { initLayout, setTree, splitPanel, closePanel, resizePanel, setActivePanel, startDrag, updateDrag, endDrag } = panelLayoutSlice.actions;
export default panelLayoutSlice.reducer;
