import React, { useRef } from 'react';
import { AiEditShell } from '../shared/AiEditShell';
import { DiffStatusBadge, WordDiffText } from '../shared/DiffPrimitives';
import { useAiEditSession } from '../../hooks/useAiEditSession';

/**
 * MindMapAiEditPanel —— 思维导图的对话式 AI 编辑面板。
 *
 * 跟 PPT 那边的 AiEditChatPanel 是同一套交互模型（先看 diff 再确认应用），
 * 但思维导图的结构是一棵树，不是一个扁平数组，所以 diff 和 schema 都是递归的：
 * 把 { nodes: Record<id, Node>, rootId } 转成嵌套 JSON 喂给 AI，
 * AI 返回的也是嵌套 JSON（保留 id 的节点=保留，没 id 的=新增，原来存在但这次没出现的=删除），
 * 解析时按 id 递归比对，重建出新的 nodes Record。
 *
 * 新节点不需要算坐标——MindMapView.tsx 里的 layoutTree() 本来就会在每次渲染前
 * 根据树结构重新计算所有节点位置，这里随便给个占位坐标即可，跟现有的 addChild() 一样。
 *
 * 会话状态机和外壳 UI 复用 useAiEditSession / AiEditShell（四个 AI 编辑面板共用）。
 */

interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  children: string[];
  collapsed?: boolean;
}

interface NestedNode {
  id?: string;
  text: string;
  children?: NestedNode[];
}

interface DiffRow {
  depth: number;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  oldText?: string;
  newText?: string;
}

interface PendingData {
  rows: DiffRow[];
  finalNodes: Record<string, MindNode>;
}

function toNested(nodes: Record<string, MindNode>, id: string): NestedNode {
  const n = nodes[id];
  return {
    id: n.id,
    text: n.text,
    children: (n.children || []).map(cid => toNested(nodes, cid)),
  };
}

export const MindMapAiEditPanel: React.FC<{
  nodes: Record<string, MindNode>;
  rootId: string;
  onApply: (newNodes: Record<string, MindNode>) => void;
  onClose: () => void;
}> = ({ nodes, rootId, onApply, onClose }) => {
  // 跟原实现一样用 useRef 计数器，保证整个面板挂载期间单调递增，
  // 避免同一毫秒内连续两次生成时 newId() 撞车。
  const uidCounter = useRef(0);
  const newId = () => `ai_${Date.now()}_${uidCounter.current++}`;

  const session = useAiEditSession<PendingData>({
    buildPrompt: (text) => {
      const currentTree = toNested(nodes, rootId);
      return `你是一个思维导图编辑助手。下面会给你当前的完整思维导图结构（嵌套 JSON，每个节点有 id、text、children）和用户希望做的修改。

请输出修改后的完整思维导图结构（同样的嵌套 JSON 格式），规则：
- 保留下来的已有节点（不管文字有没有改），必须原样带上它原来的 "id" 字段
- 新增的节点不要包含 "id" 字段
- 不需要修改的节点，text 原样返回
- 用户要求删除某个节点时，直接不要把它（及其所有子节点）包含在返回结果里
- 根节点必须保留（可以改文字，但结构上必须是返回 JSON 的最顶层）
- 只返回 JSON 本身，不要任何解释文字或代码块包裹符号

当前思维导图结构：
${JSON.stringify(currentTree, null, 2)}

用户的修改要求：${text}`;
    },

    parseResponse: (result) => {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 返回格式异常，请重试');
      const newTree = JSON.parse(jsonMatch[0]) as NestedNode;

      const rows: DiffRow[] = [];
      const finalNodes: Record<string, MindNode> = {};
      const usedOldIds = new Set<string>();

      // 递归比对：根节点强制沿用原 rootId，避免根节点被意外当成"新节点"导致整棵树丢失关联
      const walk = (newNode: NestedNode, depth: number, forcedId?: string): string => {
        const oldNode = forcedId ? nodes[forcedId] : newNode.id ? nodes[newNode.id] : undefined;
        const id = forcedId || (oldNode ? oldNode.id : newId());

        if (oldNode) usedOldIds.add(oldNode.id);

        const childIds: string[] = (newNode.children || []).map(child => walk(child, depth + 1));

        const changed = !oldNode || oldNode.text !== newNode.text;
        rows.push({
          depth,
          status: !oldNode ? 'added' : changed ? 'modified' : 'unchanged',
          oldText: oldNode?.text,
          newText: newNode.text,
        });

        finalNodes[id] = {
          id,
          text: newNode.text,
          x: oldNode?.x ?? 0,
          y: oldNode?.y ?? 0,
          color: oldNode?.color,
          children: childIds,
          collapsed: oldNode?.collapsed,
        };
        return id;
      };

      walk(newTree, 0, rootId);

      // 原树里没被走到的节点 = 被删除（深度直接归到顶层用于展示）
      Object.values(nodes).forEach(n => {
        if (!usedOldIds.has(n.id)) {
          rows.push({ depth: 0, status: 'removed', oldText: n.text });
        }
      });

      return { rows, finalNodes };
    },

    onApply: (pending) => {
      onApply(pending.finalNodes);
    },
  });

  return (
    <AiEditShell
      variant="floating"
      onClose={onClose}
      instruction={session.instruction}
      onInstructionChange={session.setInstruction}
      onGenerate={session.generate}
      onStop={session.stop}
      loading={session.loading}
      error={session.error}
      emptyLine1="描述你想对这张思维导图做的修改"
      emptyLine2='比如"给XX节点下面加3个子节点"或"把右边那枝删掉"'
      hasPendingDiff={session.hasPendingDiff}
      pendingInstruction={session.pendingInstruction}
      onApply={session.apply}
      onDiscard={session.discard}
      history={session.history}
    >
      <div
        style={{
          padding: '8px 10px',
          background: 'var(--bg-surface2)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 10,
        }}
      >
        {session.pendingData?.rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', paddingLeft: row.depth * 14, fontSize: 12 }}>
            <DiffStatusBadge status={row.status} style={{ marginTop: 1 }} />
            {row.status === 'modified' ? (
              <span style={{ lineHeight: 1.6 }}>
                <WordDiffText oldText={row.oldText || ''} newText={row.newText || ''} />
              </span>
            ) : (
              <span
                style={{
                  color: row.status === 'removed' ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  textDecoration: row.status === 'removed' ? 'line-through' : 'none',
                }}
              >
                {row.status === 'removed' ? row.oldText : row.newText}
              </span>
            )}
          </div>
        ))}
      </div>
    </AiEditShell>
  );
};

export default MindMapAiEditPanel;
