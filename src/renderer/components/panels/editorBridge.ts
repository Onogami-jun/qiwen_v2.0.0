/**
 * editorBridge.ts — 四编辑器统一接口 + 实时视觉反馈
 */
export interface EditorOps {
  getText(): string;
  getHTML(): string;
  insert(content: string): boolean;
  replaceAll(html: string): boolean;
  findAndReplace(search: string, replacement: string): boolean;
  getSelection(): string;
}

type EditorType = 'document' | 'ppt' | 'whiteboard' | 'mindmap';
const registry = new Map<EditorType, EditorOps>();

export function registerEditor(type: EditorType, ops: EditorOps): void { registry.set(type, ops); }
export function unregisterEditor(type: EditorType): void { registry.delete(type); }
export function getActiveEditor(): EditorOps | null { return registry.get('document') || registry.get('ppt') || registry.get('whiteboard') || registry.get('mindmap'); }

export interface ActionResult { success: boolean; message: string; }

// ── Flash highlight on the editor area ──────────────────────

let _flashTimer: ReturnType<typeof setTimeout> | null = null;

/** Briefly pulse-highlight the editor to show AI just made a change */
export function flashEditorChange(): void {
  const el = document.querySelector('.ProseMirror') as HTMLElement | null;
  if (!el) return;
  el.style.transition = 'box-shadow 0.2s ease-out';
  el.style.boxShadow = '0 0 0 3px var(--accent, #c8a96e)';
  if (_flashTimer) clearTimeout(_flashTimer);
  _flashTimer = setTimeout(() => {
    el.style.boxShadow = '0 0 0 0px transparent';
    _flashTimer = null;
  }, 600);
}

// ── Scroll editor to show latest change ─────────────────────

export function scrollToChange(): void {
  const el = document.querySelector('.ProseMirror') as HTMLElement | null;
  if (!el) return;
  // Scroll to the cursor position (end of inserted content)
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// ── Action implementations ──────────────────────────────────

export function actionAppend(title: string, content: string): ActionResult {
  const ed = registry.get('document');
  if (!ed) return { success: false, message: '文档编辑器未就绪' };
  try {
    const heading = title ? `<h2>${title}</h2>\n` : '';
    ed.insert(heading + content + '\n\n');
    flashEditorChange(); scrollToChange();
    return { success: true, message: `已追加：${title || '内容'}` };
  } catch (e: any) { return { success: false, message: e?.message || '追加失败' }; }
}

export function actionInsert(content: string): ActionResult {
  const ed = registry.get('document');
  if (!ed) return { success: false, message: '文档编辑器未就绪' };
  try { ed.insert(content); flashEditorChange(); scrollToChange(); return { success: true, message: '已插入' }; }
  catch (e: any) { return { success: false, message: e?.message || '插入失败' }; }
}

export function actionReplace(search: string, replacement: string): ActionResult {
  const ed = registry.get('document');
  if (!ed) return { success: false, message: '文档编辑器未就绪' };
  try {
    const found = ed.findAndReplace(search, replacement);
    if (found) { flashEditorChange(); return { success: true, message: '已替换' }; }
    return { success: false, message: '未找到匹配文本' };
  } catch (e: any) { return { success: false, message: e?.message || '替换失败' }; }
}

export function actionRewrite(target: string, content: string): ActionResult {
  const ed = registry.get('document');
  if (!ed) return { success: false, message: '文档编辑器未就绪' };
  try {
    const found = ed.findAndReplace(target, content);
    flashEditorChange();
    if (found) return { success: true, message: '已改写' };
    ed.insert(`\n${content}\n`);
    return { success: true, message: '未找到原文，已追加为新内容' };
  } catch (e: any) { return { success: false, message: e?.message || '改写失败' }; }
}

export function actionDelete(target: string): ActionResult {
  const ed = registry.get('document');
  if (!ed) return { success: false, message: '文档编辑器未就绪' };
  try {
    const found = ed.findAndReplace(target, '');
    if (found) { flashEditorChange(); return { success: true, message: '已删除' }; }
    return { success: false, message: '未找到匹配文本' };
  } catch (e: any) { return { success: false, message: e?.message || '删除失败' }; }
}
