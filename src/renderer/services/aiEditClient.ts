/**
 * AI 编辑功能共用的客户端层。
 *
 * 重构背景：文档(AIPanel)/PPT(AiEditChatPanel)/白板(WhiteboardAiEditPanel)/
 * 思维导图(MindMapAiEditPanel) 四个 AI 编辑面板，原本各自复制了一份几乎一样的
 * getApiKey/getModel 实现，以及对主进程 `ai:chat-stream` IPC 通道完全相同的
 * 调用方式。这里统一成唯一实现，行为跟之前保持完全一致——包括 localStorage
 * 取不到时退回 sessionStorage 这个细节（之前只有文档面板这边有这层兜底，
 * 其他三个面板没有；现在四个面板共享同一份，相当于顺手把这个小差异也抹平了）。
 */

export const API_KEY_STORAGE = 'qiwen_doubao_apikey';
export const MODEL_STORAGE = 'qiwen_doubao_model';
export const BUILTIN_API_KEY = 'ark-0f0fd51c-1395-45bd-9df0-29a195257d96-5ab55';
export const BUILTIN_MODEL = 'doubao-seed-2-0-pro-260215';

function safeGet(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  } catch {}
  try {
    return sessionStorage.getItem(key);
  } catch {}
  return null;
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return;
  } catch {}
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

/** 设置面板里展示"用户自己填的 key"时用——取不到就是空字符串，不会被偷偷换成内置 key */
export function getStoredApiKeyRaw(): string {
  return safeGet(API_KEY_STORAGE) || '';
}

export function getApiKey(): string {
  return safeGet(API_KEY_STORAGE) || BUILTIN_API_KEY;
}

export function saveApiKey(key: string) {
  const trimmed = key.trim();
  if (trimmed) safeSet(API_KEY_STORAGE, trimmed);
  else safeRemove(API_KEY_STORAGE);
}

export function getModel(): string {
  return safeGet(MODEL_STORAGE) || BUILTIN_MODEL;
}

export function saveModel(model: string) {
  safeSet(MODEL_STORAGE, model);
}

/**
 * 统一的"非流式"AI 调用——四个编辑面板用的都是同一种模式：发一个完整 prompt，
 * 等一个完整结果回来，再在本地各自做 diff（不是对话 tab 那种逐字打字机效果）。
 *
 * signal 不会真的去中断已经发出去的 IPC 请求（底层 invoke 没有取消能力），
 * 只是请求回来后如果已经被 abort 就直接丢弃结果——跟原来四份各自实现的行为一致，
 * 这里只是给丢弃这件事一个统一、可识别的方式：抛一个 name === 'AbortError' 的错误，
 * 调用方原来怎么 catch 这一种情况，现在还是一样的 catch 写法。
 */
export async function callAiEditModel(prompt: string, signal?: AbortSignal): Promise<string> {
  const api = (window as any).electronAPI;
  if (!api?.invoke) throw new Error('请在桌面应用中使用 AI 功能');

  const result: string = await api.invoke('ai:chat-stream', {
    messages: [{ role: 'user', content: prompt }],
    apiKey: getApiKey(),
    model: getModel(),
  });

  if (signal?.aborted) {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }
  if (!result) throw new Error('AI 返回了空响应，请重试');
  return result;
}
