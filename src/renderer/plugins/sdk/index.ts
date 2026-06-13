/**
 * QiWen Plugin SDK
 * 启文插件开发工具包
 *
 * 用法：
 *   import { definePlugin, PluginContext } from '@qiwen/plugin-sdk';
 *
 * 插件结构示例：
 *   const myPlugin = definePlugin({
 *     id: 'my-plugin',
 *     name: '我的插件',
 *     version: '1.0.0',
 *     render: (ctx) => <MyComponent ctx={ctx} />,
 *   });
 */

export interface PluginContext {
  /** 读取当前文档内容（HTML） */
  getContent: () => string;
  /** 修改当前文档内容 */
  setContent: (html: string) => void;
  /** 在光标处插入文本 */
  insertText: (text: string) => void;
  /** 在光标处插入 HTML */
  insertHtml: (html: string) => void;
  /** 获取当前选中的文本 */
  getSelection: () => string;
  /** 替换当前选中的文本 */
  replaceSelection: (text: string) => void;
  /** 获取文档元信息 */
  getDocumentMeta: () => {
    id: string;
    title: string;
    wordCount: number;
    tags: string[];
    updatedAt: number;
  };
  /** 显示通知 */
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  /** 读取插件设置 */
  getSetting: <T>(key: string) => T | undefined;
  /** 保存插件设置 */
  setSetting: (key: string, value: any) => void;
  /** 发起网络请求（需要 network 权限） */
  fetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** 插件 ID */
  pluginId: string;
}

export interface PluginDefinition {
  /** 插件唯一 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 版本号 */
  version: string;
  /** 描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 图标（emoji 或 URL） */
  icon?: string;
  /** 分类 */
  category?: 'writing' | 'research' | 'utility' | 'ai' | 'export' | 'theme';
  /** 需要的权限 */
  permissions?: Array<'read-documents' | 'write-documents' | 'network' | 'filesystem'>;
  /** 设置 schema */
  settings?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select';
    default: any;
    options?: Array<{ label: string; value: string }>;
  }>;
  /** 渲染侧边栏面板 */
  render: (ctx: PluginContext) => React.ReactNode;
  /** 激活时调用 */
  onActivate?: (ctx: PluginContext) => void;
  /** 停用时调用 */
  onDeactivate?: () => void;
}

export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}

// ── 插件上下文工厂（内部使用）────────────────────────────
import React from 'react';

export function createPluginContext(
  pluginId: string,
  opts: {
    getContent: () => string;
    setContent: (html: string) => void;
    insertText: (text: string) => void;
    insertHtml: (html: string) => void;
    getSelection: () => string;
    replaceSelection: (text: string) => void;
    getDocumentMeta: () => any;
    notify: (msg: string, type?: string) => void;
    getPluginSettings: (id: string) => Record<string, any>;
    setPluginSetting: (id: string, key: string, val: any) => void;
  }
): PluginContext {
  const settings = opts.getPluginSettings(pluginId);
  return {
    pluginId,
    getContent: opts.getContent,
    setContent: opts.setContent,
    insertText: opts.insertText,
    insertHtml: opts.insertHtml,
    getSelection: opts.getSelection,
    replaceSelection: opts.replaceSelection,
    getDocumentMeta: opts.getDocumentMeta,
    notify: (msg, type = 'info') => opts.notify(msg, type),
    getSetting: (key) => settings?.[key],
    setSetting: (key, val) => opts.setPluginSetting(pluginId, key, val),
    fetch: (url, options) => window.fetch(url, options),
  };
}
