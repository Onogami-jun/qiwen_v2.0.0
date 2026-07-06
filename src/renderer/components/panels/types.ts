/**
 * Panel System Shared Types
 */
export type PanelType = 'editor' | 'chat';

export interface LeafPanel { id: string; type: 'leaf'; panelType: PanelType; title: string; }
export interface SplitPanel { id: string; type: 'split'; direction: 'horizontal' | 'vertical'; sizes: number[]; children: PanelNode[]; }
export type PanelNode = LeafPanel | SplitPanel;
export type DropEdge = 'left' | 'right' | 'top' | 'bottom';

// ── Chat Message ────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system';

/** Extra data attached to a message for rich rendering */
export interface ChatMetadata {
  /** Message display type hint */
  kind?: 'normal' | 'plan' | 'thinking' | 'step_result';
  /** Task plan data (when kind=plan) */
  plan?: { title: string; steps: AgentStep[] };
  /** Thinking content for collapsible block */
  thinking?: string;
  /** Content stripped of XML tags */
  pureContent?: string;
}

export interface AgentStep {
  id: string;
  title: string;
  status: 'pending' | 'doing' | 'done';
}

export interface ChatMessage {
  id: string;
  documentId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** Optional metadata for rich rendering (plan / thinking / etc.) */
  meta?: ChatMetadata;
}

// ── Helpers ──────────────────────────────────────────────────

let _counter = 0;
export function uid(): string { return `pn_${Date.now()}_${++_counter}`; }
export function msgId(): string { return `msg_${Date.now()}_${++_counter}`; }

export function createDefaultLayout(): SplitPanel {
  return {
    id: uid(), type: 'split', direction: 'horizontal', sizes: [60, 40],
    children: [
      { id: uid(), type: 'leaf', panelType: 'editor', title: '编辑器' },
      { id: uid(), type: 'leaf', panelType: 'chat', title: 'AI 对话' },
    ],
  };
}

export function findNodeById(root: PanelNode, id: string): PanelNode | null {
  if (root.id === id) return root;
  if (root.type === 'split') for (const c of root.children) { const r = findNodeById(c, id); if (r) return r; }
  return null;
}
