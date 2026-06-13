/**
 * i18n/index.ts — 软件内国际化系统
 *
 * 使用方式：
 *   import { useT, t } from '../../i18n';
 *
 *   // 在组件里（响应语言切换）
 *   const T = useT();
 *   <div>{T('common.save')}</div>
 *
 *   // 在组件外（不响应切换，仅当前语言）
 *   t('common.save')
 */

import { useSelector } from 'react-redux';
import { useCallback } from 'react';
import { RootState } from '../store';
import zhRaw from './zh';
import enRaw from './en';

// 强制转为 Record<string, string>，避免 TS 用字面量类型推断导致 string 索引报错
const zh = zhRaw as Record<string, string>;
const en = enRaw as Record<string, string>;
const dicts: Record<string, Record<string, string>> = { 'zh-CN': zh, 'en-US': en };

// ── 非 hook 版本（用于工具函数、插件等组件外场景）────────────
let _currentLang = 'zh-CN';

export function setLang(lang: string) {
  _currentLang = lang;
}

/** 组件外使用，不响应语言切换 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = dicts[_currentLang] || zh;
  let text = dict[key] || zh[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

// ── React hook 版本（响应语言切换，用于组件内）───────────────
export function useT() {
  const language = useSelector((s: RootState) => s.settings.language);

  const translate = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const dict = dicts[language] || zh;
    let text = dict[key] || zh[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [language]);

  return translate;
}

/** 监听语言设置变化，同步 _currentLang */
export function useSyncLang() {
  const language = useSelector((s: RootState) => s.settings.language);
  setLang(language);
}
