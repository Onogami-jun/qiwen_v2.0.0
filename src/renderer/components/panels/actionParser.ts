/**
 * actionParser.ts — 解析 AI 回复中的 <action> XML 标签
 *
 * 标签格式：
 *   <action type="append" title="节标题">内容</action>
 *   <action type="insert">光标处插入内容</action>
 *   <action type="replace" target="原文片段">新内容</action>
 *   <action type="rewrite" target="段落标题">改写内容</action>
 *   <action type="delete" target="段落标题"></action>
 *   <action type="open_panel" panel="ppt"></action>
 *   <action type="close_panel" panel="chat"></action>
 */

export type ActionType =
  | 'append'         // 文档末尾追加段落（安全）
  | 'insert'         // 光标处插入（安全）
  | 'replace'        // 查找替换（需确认）
  | 'rewrite'        // 重写段落（需确认）
  | 'delete'         // 删除段落（需确认）
  | 'update_plan'    // 更新任务计划（安全）
  | 'open_panel'     // 打开面板
  | 'close_panel';   // 关闭面板

export type SafetyLevel = 'safe' | 'confirm' | 'panel';

export interface ParsedAction {
  type: ActionType;
  safety: SafetyLevel;
  payload: Record<string, string>;
  /** The text content between the action tags */
  content: string;
}

/** Determine safety level for an action type */
export function getSafety(type: ActionType): SafetyLevel {
  switch (type) {
    case 'append': case 'insert': case 'update_plan': return 'safe';
    case 'replace': case 'rewrite': case 'delete': return 'confirm';
    case 'open_panel': case 'close_panel': return 'panel';
    default: return 'confirm';
  }
}

/** Parse all <action> tags from AI response text */
export function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  // Match <action type="xxx" key1="val1" key2="val2">content</action>
  const regex = /<action\s+([^>]+)>([\s\S]*?)<\/action>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const attrStr = match[1];
    const content = match[2].trim();

    // Parse attributes: type="xxx" target="yyy" title="zzz" panel="www" direction="hhh"
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2];
    }

    const type = (attrs.type || '') as ActionType;
    if (!type) continue;

    actions.push({
      type,
      safety: getSafety(type),
      payload: attrs,
      content,
    });
  }

  return actions;
}

/** Strip all <action> tags from text, return clean content for display */
export function stripActions(text: string): string {
  return text.replace(/<action\s+[^>]+>[\s\S]*?<\/action>/g, '').trim();
}
