// ── Document types ──────────────────────────────────────
export interface Document {
  id: string;
  title: string;
  content: string;
  contentType: 'markdown' | 'richtext';
  parentId: string | null;
  workspaceId: string;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  wordCount: number;
  charCount: number;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
}

export interface DocumentMeta extends Omit<Document, 'content'> {}

export interface DocumentTree {
  id: string;
  title: string;
  children: DocumentTree[];
  isFolder: boolean;
  parentId: string | null;
}

// ── Workspace ────────────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  profession: ProfessionType;
  createdAt: number;
  updatedAt: number;
}

export type ProfessionType =
  | 'researcher'
  | 'lawyer'
  | 'teacher'
  | 'writer'
  | 'doctor'
  | 'general';

// ── Reference / Library ─────────────────────────────────
export interface Reference {
  id: string;
  workspaceId: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  keywords: string[];
  tags: string[];
  notes: string | null;
  filePath: string | null;
  citationKey: string;
  type: ReferenceType;
  createdAt: number;
  updatedAt: number;
}

export type ReferenceType =
  | 'article'
  | 'book'
  | 'chapter'
  | 'conference'
  | 'thesis'
  | 'report'
  | 'website'
  | 'other';

// ── Plugin system ────────────────────────────────────────
export interface Plugin {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  category: PluginCategory;
  tags: string[];
  isEnabled: boolean;
  isInstalled: boolean;
  isPaid: boolean;
  price: number;
  icon: string;
  entryPoint: string;
  permissions: PluginPermission[];
  settings: Record<string, PluginSettingValue>;
  settingsSchema: PluginSettingSchema[];
  installedAt: number | null;
  updatedAt: number | null;
}

export type PluginCategory =
  | 'research'
  | 'writing'
  | 'reference'
  | 'export'
  | 'ai'
  | 'theme'
  | 'utility';

export type PluginPermission =
  | 'read-documents'
  | 'write-documents'
  | 'read-references'
  | 'network'
  | 'filesystem'
  | 'ai';

export type PluginSettingValue = string | number | boolean | string[];

export interface PluginSettingSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
  default: PluginSettingValue;
  options?: { label: string; value: string }[];
  description?: string;
}

// ── User / Account ───────────────────────────────────────
export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  isLocal: boolean;
  plan: SubscriptionPlan;
  aiTokensUsed: number;
  aiTokensLimit: number;
  createdAt: number;
}

export type SubscriptionPlan = 'free' | 'basic' | 'pro' | 'enterprise';

// ── App settings ─────────────────────────────────────────
export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  editorWidth: 'narrow' | 'normal' | 'wide' | 'full';
  spellCheck: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  showWordCount: boolean;
  showLineNumbers: boolean;
  focusModeBlur: number;
  language: 'zh-CN' | 'en-US';
  sidebarWidth: number;
  rightPanelWidth: number;
}

// ── AI ───────────────────────────────────────────────────
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AIConversation {
  id: string;
  documentId: string | null;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

// ── IPC Events ───────────────────────────────────────────
export type IPCChannel =
  | 'new-document'
  | 'save-document'
  | 'save-as-document'
  | 'open-folder'
  | 'export-pdf'
  | 'export-word'
  | 'find-replace'
  | 'toggle-sidebar'
  | 'focus-mode'
  | 'open-settings'
  | 'show-shortcuts'
  | 'update-available'
  | 'update-downloaded'
  | 'theme-changed';
