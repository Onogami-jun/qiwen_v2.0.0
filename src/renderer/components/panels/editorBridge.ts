/** editorBridge.ts — 编辑器操作 + 视觉横幅反馈 */
export interface EditorOps { getText(): string; getHTML(): string; insert(content: string): boolean; replaceAll(html: string): boolean; findAndReplace(search: string, replacement: string): boolean; getSelection(): string; }
type ET = 'document' | 'ppt' | 'whiteboard' | 'mindmap';
const reg = new Map<ET, EditorOps>();
export function registerEditor(t: ET, o: EditorOps): void { reg.set(t, o); }
export function unregisterEditor(t: ET): void { reg.delete(t); }
export interface ActionResult { success: boolean; message: string; }

var _be: HTMLDivElement | null = null;
var _bt: ReturnType<typeof setTimeout> | null = null;
export function showEditorBanner(text: string): void {
  if (!_be) { _be = document.createElement('div'); _be.className = 'pn-edit-banner'; _be.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 20px;border-radius:20px;background:var(--accent,#c8a96e);color:#fff;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.2);opacity:0;transition:opacity .15s;pointer-events:none;white-space:nowrap;'; document.body.appendChild(_be); }
  _be.textContent = text; _be.style.opacity = '1';
}
export function hideEditorBanner(): void { if (_bt) clearTimeout(_bt); _bt = setTimeout(function() { if (_be) _be.style.opacity = '0'; }, 300); }

var _ft: ReturnType<typeof setTimeout> | null = null;
export function flashEditorChange(): void { var el = document.querySelector('.ProseMirror') as HTMLElement | null; if (!el) return; el.style.transition = 'box-shadow .2s ease-out'; el.style.boxShadow = '0 0 0 4px var(--accent, #c8a96e)'; if (_ft) clearTimeout(_ft); _ft = setTimeout(function() { el.style.boxShadow = ''; _ft = null; }, 800); }
export function scrollToChange(): void { var el = document.querySelector('.ProseMirror') as HTMLElement | null; if (!el) return; var sel = window.getSelection(); if (sel && sel.rangeCount) { var rect = sel.getRangeAt(0).getBoundingClientRect(); if (rect.top < 0 || rect.bottom > window.innerHeight) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }

export function actionAppend(title: string, content: string): ActionResult { var ed = reg.get('document'); if (!ed) return { success: false, message: '文档编辑器未就绪' }; try { var h = title ? '<h2>' + title + '</h2>\n' : ''; ed.insert(h + content + '\n\n'); flashEditorChange(); scrollToChange(); return { success: true, message: '已追加：' + (title || '内容') }; } catch (e: any) { return { success: false, message: (e && e.message) || '追加失败' }; } }
export function actionInsert(content: string): ActionResult { var ed = reg.get('document'); if (!ed) return { success: false, message: '文档编辑器未就绪' }; try { ed.insert(content); flashEditorChange(); scrollToChange(); return { success: true, message: '已插入' }; } catch (e: any) { return { success: false, message: (e && e.message) || '插入失败' }; } }
export function actionReplace(search: string, replacement: string): ActionResult { var ed = reg.get('document'); if (!ed) return { success: false, message: '文档编辑器未就绪' }; try { if (ed.findAndReplace(search, replacement)) { flashEditorChange(); return { success: true, message: '已替换' }; } return { success: false, message: '未找到匹配文本' }; } catch (e: any) { return { success: false, message: (e && e.message) || '替换失败' }; } }
export function actionRewrite(target: string, content: string): ActionResult { var ed = reg.get('document'); if (!ed) return { success: false, message: '文档编辑器未就绪' }; try { if (ed.findAndReplace(target, content)) { flashEditorChange(); return { success: true, message: '已改写' }; } ed.insert('\n' + content + '\n'); flashEditorChange(); return { success: true, message: '未找到原文，已追加' }; } catch (e: any) { return { success: false, message: (e && e.message) || '改写失败' }; } }
export function actionDelete(target: string): ActionResult { var ed = reg.get('document'); if (!ed) return { success: false, message: '文档编辑器未就绪' }; try { if (ed.findAndReplace(target, '')) { flashEditorChange(); return { success: true, message: '已删除' }; } return { success: false, message: '未找到匹配文本' }; } catch (e: any) { return { success: false, message: (e && e.message) || '删除失败' }; } }
