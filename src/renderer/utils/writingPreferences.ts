/**
 * writingPreferences — 跨文档写作偏好
 * 存储用户的写作风格/语气/篇幅等偏好，跨文档共享。
 * 在构建 AI prompt 时自动注入。
 */
import { ipc } from './ipc';

// ── Cache ────────────────────────────────────────────────────

let _cache: Record<string, string> | null = null;

async function ensureCache(): Promise<Record<string, string>> {
  if (_cache) return _cache;
  try {
    _cache = await ipc.invoke<Record<string, string>>('db:getAllWritingPreferences');
  } catch {
    _cache = {};
  }
  return _cache;
}

// ── API ──────────────────────────────────────────────────────

export async function getPreference(key: string): Promise<string> {
  const p = await ensureCache();
  return p[key] ?? '';
}

export async function setPreference(key: string, value: string): Promise<void> {
  const p = await ensureCache();
  p[key] = value;
  try { await ipc.invoke('db:setWritingPreference', { key, value }); } catch {}
}

export async function getAllPreferences(): Promise<Record<string, string>> {
  return ensureCache();
}

export function invalidateCache(): void { _cache = null; }

// ── System Prompt Builder ────────────────────────────────────

export async function buildSystemPrompt(): Promise<string> {
  const p = await ensureCache();
  const lines: string[] = [];

  if (p['style']) lines.push(`- 写作风格：${p['style']}`);
  if (p['tone']) lines.push(`- 语气：${p['tone']}`);
  if (p['length_preference']) lines.push(`- 篇幅偏好：${p['length_preference']}`);
  if (p['language']) lines.push(`- 语言：${p['language']}`);
  if (p['custom_instructions']) lines.push(`- 自定义要求：${p['custom_instructions']}`);

  if (lines.length === 0) return '';

  return `你是一个AI写作助手。请根据以下用户偏好来调整你的写作建议：

${lines.join('\n')}`;
}

export const PREF_KEYS = {
  style: 'style',
  tone: 'tone',
  lengthPreference: 'length_preference',
  language: 'language',
  customInstructions: 'custom_instructions',
} as const;
