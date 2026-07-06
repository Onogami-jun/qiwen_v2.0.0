/**
 * actionExecutor.ts — AI Action 执行器
 *
 * 从 ChatPanel 抽出的执行逻辑，负责：
 * 1. 按类型执行 action
 * 2. 安全操作自动执行，确认操作返回待确认状态
 * 3. 面板操作通过 Redux dispatch 管理
 */
import type { ParsedAction } from './actionParser';
import { getSafety } from './actionParser';
import * as Bridge from './editorBridge';

export interface ExecResult {
  /** Human-readable result message */
  message: string;
  /** Whether execution succeeded */
  success: boolean;
  /** If true, the action needs user confirmation before executing */
  needsConfirm: boolean;
  /** The action itself (for confirm UI rendering) */
  action: ParsedAction;
}

/**
 * Execute a single action. Returns result + whether it needs confirmation.
 *
 * If needsConfirm is true, the caller should show ActionConfirm card.
 * Once user accepts, call executeConfirmAction() with the same action.
 */
export function tryExecuteAction(action: ParsedAction, autoMode: boolean): ExecResult {
  const safety = getSafety(action.type);

  // Safe actions or auto-mode: execute immediately
  if (safety === 'safe' || autoMode) {
    return executeNow(action);
  }

  // Confirm actions: return needsConfirm=true
  return { message: '', success: false, needsConfirm: true, action };
}

/** Execute an action immediately (no confirmation) */
export function executeNow(action: ParsedAction): ExecResult {
  let r: Bridge.ActionResult = { success: false, message: '' };

  switch (action.type) {
    case 'append':
      r = Bridge.actionAppend(action.payload.title || '', action.content);
      break;
    case 'insert':
      r = Bridge.actionInsert(action.content);
      break;
    case 'replace':
      r = Bridge.actionReplace(action.payload.target || '', action.content);
      break;
    case 'rewrite':
      r = Bridge.actionRewrite(action.payload.target || '', action.content);
      break;
    case 'delete':
      r = Bridge.actionDelete(action.payload.target || '');
      break;
    default:
      r = { success: true, message: '' };
  }

  return { message: r.message, success: r.success, needsConfirm: false, action };
}

/** Execute a confirmed action (user clicked Accept) */
export function executeConfirmAction(action: ParsedAction): ExecResult {
  let r: Bridge.ActionResult = { success: false, message: '' };

  switch (action.type) {
    case 'replace':
      r = Bridge.actionReplace(action.payload.target || '', action.content);
      break;
    case 'rewrite':
      r = Bridge.actionRewrite(action.payload.target || '', action.content);
      break;
    case 'delete':
      r = Bridge.actionDelete(action.payload.target || '');
      break;
    default:
      r = { success: true, message: '' };
  }

  return { message: r.message, success: r.success, needsConfirm: false, action };
}
