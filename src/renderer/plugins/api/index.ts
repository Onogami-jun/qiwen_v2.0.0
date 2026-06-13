/**
 * plugins/api/index.ts
 * 插件 API 服务层 — 统一管理所有外部 API 调用
 *
 * 使用方式：
 *   import { drugApi, icdApi, doiApi } from '../api';
 *
 * API Key 配置：
 *   在软件「设置 → 高级 → API 配置」中填入各服务的 key
 *   key 为空时自动使用内置 mock 数据，填入后调用真实接口
 */

export { drugApi, type DrugInfo } from './drugApi';
export { icdApi, type ICDCode } from './icdApi';
export { doiApi, type ReferenceInfo } from './doiApi';
export { legalApi, type LegalClause } from './legalApi';
export { semanticApi, type Paper } from './semanticApi';
export { readabilityApi } from './readabilityApi';
