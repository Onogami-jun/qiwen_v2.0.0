/**
 * panelLayoutSlice — 面板布局 + 浮动窗口
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PanelType = 'editor' | 'chat';
export interface LeafPanel { id: string; type: 'leaf'; panelType: PanelType; title: string; }
export interface SplitPanel { id: string; type: 'split'; direction: 'horizontal' | 'vertical'; sizes: number[]; children: PanelNode[]; }
export type PanelNode = LeafPanel | SplitPanel;
export type DropEdge = 'left' | 'right' | 'top' | 'bottom';

export interface FloatingPanelState {
  id: string; panelType: PanelType; title: string;
  x: number; y: number; width: number; height: number; zIndex: number;
}

export interface PanelLayoutState {
  tree: PanelNode | null;
  floatingPanels: FloatingPanelState[];
  dragState: { sourcePanelId: string; mouseX: number; mouseY: number; targetContainerId: string | null; dropEdge: DropEdge | null; } | null;
  activePanelId: string | null;
  loadedDocumentId: string | null;
}

let _c = 0;
function uid(): string { return `pn_${Date.now()}_${++_c}_${Math.random().toString(36).slice(2,6)}`; }
function cloneNode(n: PanelNode): PanelNode { return n.type === 'leaf' ? { ...n } : { ...n, sizes: [...n.sizes], children: n.children.map(cloneNode) }; }

function createDefault(): SplitPanel {
  return { id: uid(), type: 'split', direction: 'horizontal', sizes: [60, 40], children: [
    { id: uid(), type: 'leaf', panelType: 'editor', title: '编辑器' },
    { id: uid(), type: 'leaf', panelType: 'chat', title: 'AI 对话' },
  ]};
}

function findParent(root: PanelNode, childId: string): { parent: SplitPanel; idx: number } | null {
  function walk(n: PanelNode): { parent: SplitPanel; idx: number } | null {
    if (n.type !== 'split') return null;
    for (let i = 0; i < n.children.length; i++) { if (n.children[i].id === childId) return { parent: n, idx: i }; const r = walk(n.children[i]); if (r) return r; }
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
  if (node.type !== 'split' || node.children.length === 0) return;
  const n = node.children.length;
  const sum = node.sizes.reduce((a, b) => a + b, 0) || n * 50;
  node.sizes = node.sizes.map(s => Math.max(10, (s / sum) * 100));
  const t2 = node.sizes.reduce((a, b) => a + b, 0);
  if (Math.abs(t2 - 100) > 0.5) { const mi = node.sizes.indexOf(Math.max(...node.sizes)); node.sizes[mi] += (100 - t2); }
  node.children.forEach(normalize);
}

const panelLayoutSlice = createSlice({
  name: 'panelLayout',
  initialState: (): PanelLayoutState => ({ tree: null, floatingPanels: [], dragState: null, activePanelId: null, loadedDocumentId: null }),
  reducers: {

    initLayout(s, a: PayloadAction<{ documentId: string; savedTree: PanelNode | null; savedFloating?: FloatingPanelState[] }>) {
      s.loadedDocumentId = a.payload.documentId;
      s.tree = a.payload.savedTree || createDefault();
      s.floatingPanels = a.payload.savedFloating || [];
      function firstEditor(n: PanelNode): string | null {
        if (n.type === 'leaf') return n.panelType === 'editor' ? n.id : null;
        for (const c of n.children) { const r = firstEditor(c); if (r) return r; }
        return null;
      }
      s.activePanelId = firstEditor(s.tree);
    },

    setTree(s, a: PayloadAction<PanelNode>) { s.tree = a.payload; },

    splitPanel(s, a: PayloadAction<{ targetId: string; direction: 'horizontal' | 'vertical'; newPanelType: PanelType; position: DropEdge }>) {
      if (!s.tree) return; const { targetId, direction, newPanelType, position } = a.payload;
      const newPanel: LeafPanel = { id: uid(), type: 'leaf', panelType: newPanelType, title: newPanelType === 'chat' ? 'AI 对话' : '编辑器' };
      const first = position === 'left' || position === 'top';
      if (s.tree.id === targetId && s.tree.type === 'leaf') { s.tree = { id: uid(), type: 'split', direction, sizes: [50, 50], children: first ? [newPanel, cloneNode(s.tree)] : [cloneNode(s.tree), newPanel] }; normalize(s.tree); return; }
      const f = findParent(s.tree, targetId); if (!f) return;
      const children: PanelNode[] = first ? [newPanel, cloneNode(f.parent.children[f.idx])] : [cloneNode(f.parent.children[f.idx]), newPanel];
      f.parent.children[f.idx] = { id: uid(), type: 'split', direction, sizes: [50, 50], children };
      normalize(s.tree);
    },

    closePanel(s, a: PayloadAction<string>) {
      if (!s.tree) return; const pid = a.payload;
      if (!hasOtherEditor(s.tree, pid)) return;
      if (s.tree.id === pid) return;
      const f = findParent(s.tree, pid); if (!f) return;
      const sib = f.parent.children[f.idx === 0 ? 1 : 0];
      const gp = findParent(s.tree, f.parent.id);
      if (!gp) { s.tree = sib; normalize(s.tree); return; }
      gp.parent.children[gp.idx] = sib;
      if (gp.parent.children.length <= 1 && gp.parent.id === s.tree!.id) s.tree = sib;
      gp.parent.sizes.splice(gp.idx, 1);
      if (gp.parent.sizes.length === 0) gp.parent.sizes = gp.parent.children.map(() => 100 / gp.parent.children.length);
      normalize(s.tree);
    },

    resizePanel(s, a: PayloadAction<{ splitId: string; sizes: number[] }>) {
      if (!s.tree) return;
      function walk(n: PanelNode) { if (n.id === a.payload.splitId && n.type === 'split') { n.sizes = a.payload.sizes; return; } if (n.type === 'split') n.children.forEach(walk); }
      walk(s.tree);
    },

    detachPanel(s, a: PayloadAction<{ panelId: string; x: number; y: number }>) {
      if (!s.tree) return; const { panelId, x, y } = a.payload;
      function findLeaf(n: PanelNode): LeafPanel | null { if (n.id === panelId && n.type === 'leaf') return n; if (n.type === 'split') for (const c of n.children) { const r = findLeaf(c); if (r) return r; } return null; }
      const leaf = findLeaf(s.tree); if (!leaf) return;
      if (leaf.panelType === 'editor' && !hasOtherEditor(s.tree, panelId)) return;
      if (s.tree.id === panelId) return;
      const f = findParent(s.tree, panelId);
      if (f) { const sib = f.parent.children[f.idx === 0 ? 1 : 0]; const gp = findParent(s.tree, f.parent.id); if (!gp) { s.tree = sib; } else { gp.parent.children[gp.idx] = sib; gp.parent.sizes.splice(gp.idx, 1); } normalize(s.tree); }
      const maxZ = s.floatingPanels.reduce((m, p) => Math.max(m, p.zIndex), 0);
      s.floatingPanels.push({ id: leaf.id, panelType: leaf.panelType, title: leaf.title, x, y, width: 420, height: 360, zIndex: maxZ + 1 });
    },

    reattachPanel(s, a: PayloadAction<{ floatingId: string; targetId: string; position: DropEdge }>) {
      const idx = s.floatingPanels.findIndex(p => p.id === a.payload.floatingId);
      if (idx < 0 || !s.tree) return;
      const fp = s.floatingPanels[idx]; s.floatingPanels.splice(idx, 1);
      const direction = (a.payload.position === 'left' || a.payload.position === 'right') ? 'horizontal' : 'vertical';
      const first = a.payload.position === 'left' || a.payload.position === 'top';
      const newPanel: LeafPanel = { id: fp.id, type: 'leaf', panelType: fp.panelType, title: fp.title };
      function splitAt(n: PanelNode): boolean {
        if (n.id === a.payload.targetId && n.type === 'leaf') return true;
        if (n.type === 'split') { for (let i = 0; i < n.children.length; i++) { if (n.children[i].id === a.payload.targetId && n.children[i].type === 'leaf') { n.children[i] = { id: uid(), type: 'split', direction, sizes: [50, 50], children: first ? [newPanel, cloneNode(n.children[i])] : [cloneNode(n.children[i]), newPanel] }; return true; } if (splitAt(n.children[i])) return true; } }
        return false;
      }
      if (s.tree!.id === a.payload.targetId && s.tree!.type === 'leaf') { s.tree = { id: uid(), type: 'split', direction, sizes: [50, 50], children: first ? [newPanel, cloneNode(s.tree!)] : [cloneNode(s.tree!), newPanel] }; }
      else splitAt(s.tree!);
      normalize(s.tree!);
    },

    moveFloating(s, a: PayloadAction<{ id: string; x: number; y: number }>) { const p = s.floatingPanels.find(x => x.id === a.payload.id); if (p) { p.x = a.payload.x; p.y = a.payload.y; } },
    resizeFloating(s, a: PayloadAction<{ id: string; width: number; height: number }>) { const p = s.floatingPanels.find(x => x.id === a.payload.id); if (p) { p.width = Math.max(250, a.payload.width); p.height = Math.max(150, a.payload.height); } },
    focusFloating(s, a: PayloadAction<string>) { const maxZ = s.floatingPanels.reduce((m, p) => Math.max(m, p.zIndex), 0); const p = s.floatingPanels.find(x => x.id === a.payload); if (p) p.zIndex = maxZ + 1; s.activePanelId = a.payload; },
    closeFloating(s, a: PayloadAction<string>) { s.floatingPanels = s.floatingPanels.filter(p => p.id !== a.payload); },
    setFloatingPanels(s, a: PayloadAction<FloatingPanelState[]>) { s.floatingPanels = a.payload; },

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

export const {
  initLayout, setTree, splitPanel, closePanel, resizePanel,
  detachPanel, reattachPanel, moveFloating, resizeFloating, focusFloating, closeFloating, setFloatingPanels,
  setActivePanel, startDrag, updateDrag, endDrag,
} = panelLayoutSlice.actions;
export default panelLayoutSlice.reducer;
