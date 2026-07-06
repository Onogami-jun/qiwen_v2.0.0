/**
 * panelLayoutSlice — 面板布局 Redux Slice（稳定版）
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

/** Find parent split + child index. Returns null if node is the root. */
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

/** Check tree has at least one editor besides excludeId. */
function hasOtherEditor(tree: PanelNode, excludeId: string): boolean {
  if (tree.type === 'leaf') return tree.panelType === 'editor' && tree.id !== excludeId;
  return tree.children.some(c => hasOtherEditor(c, excludeId));
}

/** Force all split sizes to sum to 100. */
function normalize(node: PanelNode): void {
  if (node.type !== 'split') return;
  const n = node.children.length;
  if (n === 0) return;
  const total = node.sizes.reduce((a, b) => a + b, 0);
  if (total <= 0 || Math.abs(total - 100) > 1) {
    // Re-distribute evenly from where we are
    const current = [...node.sizes];
    const sum = current.reduce((a, b) => a + b, 0) || n * 50;
    node.sizes = current.map(s => Math.max(10, (s / sum) * 100));
    // Re-normalize if above introduced rounding error
    const total2 = node.sizes.reduce((a, b) => a + b, 0);
    if (Math.abs(total2 - 100) > 0.5) {
      // Add the remainder to the largest panel
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
      // Focus first editor
      function firstEditor(n: PanelNode): string | null {
        if (n.type === 'leaf') return n.panelType === 'editor' ? n.id : null;
        for (const c of n.children) { const r = firstEditor(c); if (r) return r; }
        return null;
      }
      s.activePanelId = firstEditor(s.tree);
    },

    setTree(s, a: PayloadAction<PanelNode>) { s.tree = a.payload; },

    // ── Split ────────────────────────────────────────────

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

      // Case: target is root leaf
      if (s.tree.id === targetId && s.tree.type === 'leaf') {
        const old = cloneNode(s.tree);
        s.tree = {
          id: uid(), type: 'split', direction, sizes: [50, 50],
          children: first ? [newPanel, old] : [old, newPanel],
        };
        normalize(s.tree);
        return;
      }

      // Case: target is inside a split
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

    // ── Close ────────────────────────────────────────────

    closePanel(s, a: PayloadAction<string>) {
      if (!s.tree) return;
      const panelId = a.payload;
      if (!hasOtherEditor(s.tree, panelId)) return; // keep at least one editor

      // Root leaf — can't close
      if (s.tree.id === panelId) return;

      const found = findParent(s.tree, panelId);
      if (!found) return;

      const { parent, idx } = found;
      const sibling = parent.children[idx === 0 ? 1 : 0];

      // Find the grandparent of this split
      const gp = findParent(s.tree, parent.id);
      if (!gp) {
        // Parent was root — sibling becomes new root
        s.tree = sibling;
        normalize(s.tree);
        return;
      }

      // Replace the parent split with the sibling in the grandparent
      gp.parent.children[gp.idx] = sibling;

      // If grandparent now has only 1 child, collapse
      if (gp.parent.children.length <= 1 && gp.parent.id === s.tree!.id) {
        s.tree = sibling;
      }
      normalize(s.tree);

      // Update sizes in ancestors
      gp.parent.sizes.splice(gp.idx, 1);
      if (gp.parent.sizes.length === 0) {
        gp.parent.sizes = gp.parent.children.map(() => 100 / gp.parent.children.length);
      }
      normalize(s.tree);
    },

    // ── Resize ───────────────────────────────────────────

    resizePanel(s, a: PayloadAction<{ splitId: string; sizes: number[] }>) {
      if (!s.tree) return;
      function walk(n: PanelNode) {
        if (n.id === a.payload.splitId && n.type === 'split') { n.sizes = a.payload.sizes; return; }
        if (n.type === 'split') n.children.forEach(walk);
      }
      walk(s.tree);
    },

    // ── Focus ────────────────────────────────────────────

    setActivePanel(s, a: PayloadAction<string | null>) { s.activePanelId = a.payload; },

    // ── Drag ─────────────────────────────────────────────

    startDrag(s, a: PayloadAction<{ panelId: string; mouseX: number; mouseY: number }>) {
      s.dragState = { ...a.payload, targetContainerId: null, dropEdge: null };
    },
    updateDrag(s, a: PayloadAction<{ mouseX: number; mouseY: number; targetContainerId: string | null; dropEdge: DropEdge | null }>) {
      if (s.dragState) Object.assign(s.dragState, a.payload);
    },
    endDrag(s) { s.dragState = null; },
  },
});

export const { initLayout, setTree, splitPanel, closePanel, resizePanel, setActivePanel, startDrag, updateDrag, endDrag } = panelLayoutSlice.actions;
export default panelLayoutSlice.reducer;
