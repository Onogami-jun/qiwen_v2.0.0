/**
 * editorBridge 扩展 — PPT/白板/思维导图注册模板
 *
 * 把对应代码段粘贴到各个编辑器的 useEffect 里即可。
 * 每个编辑器需要暴露 getText/getHTML/insert/findAndReplace/getSelection。
 */

import { registerEditor, unregisterEditor } from './editorBridge';

// ── 在 SlidesView.tsx 的 useEffect 中粘贴 ────────────────────

export function registerPPTEditor(getContent: () => string, insertContent: (html: string) => void) {
  registerEditor('ppt', {
    getText: () => getContent(),
    getHTML: () => getContent(),
    insert: (c: string) => { try { insertContent(c); return true; } catch { return false; } },
    replaceAll: (h: string) => { try { insertContent(h); return true; } catch { return false; } },
    findAndReplace: (s: string, r: string) => { const t = getContent(); if (t.includes(s)) { insertContent(t.split(s).join(r)); return true; } return false; },
    getSelection: () => '',
  });
  return () => unregisterEditor('ppt');
}

// 使用方式（粘贴到 SlidesView.tsx）：
// useEffect(() => {
//   const getContent = () => JSON.stringify(currentSlide?.content || '');
//   const insertContent = (html: string) => { /* 写入当前幻灯片 */ };
//   return registerPPTEditor(getContent, insertContent);
// }, [currentSlide]);

// ── 在 WhiteboardView.tsx 的 useEffect 中粘贴 ────────────────

export function registerWhiteboardEditor(getData: () => string, setData: (json: string) => void) {
  registerEditor('whiteboard', {
    getText: () => getData(),
    getHTML: () => getData(),
    insert: (c: string) => { try { setData(c); return true; } catch { return false; } },
    replaceAll: (h: string) => { try { setData(h); return true; } catch { return false; } },
    findAndReplace: (s: string, r: string) => { const t = getData(); if (t.includes(s)) { setData(t.split(s).join(r)); return true; } return false; },
    getSelection: () => '',
  });
  return () => unregisterEditor('whiteboard');
}

// 使用方式（粘贴到 WhiteboardView.tsx）：
// useEffect(() => {
//   const getData = () => JSON.stringify(canvasData || {});
//   const setData = (json: string) => { /* 更新画布数据 */ };
//   return registerWhiteboardEditor(getData, setData);
// }, [canvasData]);

// ── 在 MindMapView.tsx 的 useEffect 中粘贴 ──────────────────

export function registerMindMapEditor(getData: () => string, setData: (json: string) => void) {
  registerEditor('mindmap', {
    getText: () => getData(),
    getHTML: () => getData(),
    insert: (c: string) => { try { setData(c); return true; } catch { return false; } },
    replaceAll: (h: string) => { try { setData(h); return true; } catch { return false; } },
    findAndReplace: (s: string, r: string) => { const t = getData(); if (t.includes(s)) { setData(t.split(s).join(r)); return true; } return false; },
    getSelection: () => '',
  });
  return () => unregisterEditor('mindmap');
}

// 使用方式（粘贴到 MindMapView.tsx）：
// useEffect(() => {
//   const getData = () => JSON.stringify(mindMapNodes || {});
//   const setData = (json: string) => { /* 更新思维导图节点 */ };
//   return registerMindMapEditor(getData, setData);
// }, [mindMapNodes]);
