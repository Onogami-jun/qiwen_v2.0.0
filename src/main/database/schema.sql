-- ──启文数据库 Schema v1 ──────────────────────────────────
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT '📁',
  color       TEXT DEFAULT '#c8a96e',
  profession  TEXT DEFAULT 'general',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Documents (content stored separately for performance)
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '无标题',
  content_type TEXT NOT NULL DEFAULT 'markdown',
  parent_id    TEXT REFERENCES documents(id) ON DELETE SET NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  is_folder    INTEGER NOT NULL DEFAULT 0,
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  is_archived  INTEGER NOT NULL DEFAULT 0,
  word_count   INTEGER NOT NULL DEFAULT 0,
  char_count   INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  synced_at    INTEGER
);

CREATE TABLE IF NOT EXISTS document_contents (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  INTEGER NOT NULL
);

-- Document tags
CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  PRIMARY KEY (document_id, tag)
);

-- Document versions (history)
CREATE TABLE IF NOT EXISTS document_versions (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  title       TEXT NOT NULL,
  word_count  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- References (literature library)
CREATE TABLE IF NOT EXISTS references (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  authors      TEXT NOT NULL DEFAULT '[]',  -- JSON array
  year         INTEGER,
  journal      TEXT,
  volume       TEXT,
  issue        TEXT,
  pages        TEXT,
  doi          TEXT,
  url          TEXT,
  abstract     TEXT,
  keywords     TEXT NOT NULL DEFAULT '[]',  -- JSON array
  tags         TEXT NOT NULL DEFAULT '[]',  -- JSON array
  notes        TEXT,
  file_path    TEXT,
  citation_key TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'article',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Plugins
CREATE TABLE IF NOT EXISTS plugins (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  version      TEXT NOT NULL,
  description  TEXT DEFAULT '',
  author       TEXT DEFAULT '',
  category     TEXT DEFAULT 'utility',
  tags         TEXT NOT NULL DEFAULT '[]',
  is_enabled   INTEGER NOT NULL DEFAULT 1,
  is_paid      INTEGER NOT NULL DEFAULT 0,
  price        REAL NOT NULL DEFAULT 0,
  icon         TEXT DEFAULT '🔌',
  entry_point  TEXT NOT NULL,
  permissions  TEXT NOT NULL DEFAULT '[]',
  settings     TEXT NOT NULL DEFAULT '{}',
  installed_at INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- User profile
CREATE TABLE IF NOT EXISTS user_profile (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL DEFAULT '本地用户',
  email          TEXT,
  avatar         TEXT,
  is_local       INTEGER NOT NULL DEFAULT 1,
  plan           TEXT NOT NULL DEFAULT 'free',
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  ai_tokens_limit INTEGER NOT NULL DEFAULT 100000,
  created_at     INTEGER NOT NULL
);

-- App settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          TEXT PRIMARY KEY,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  title       TEXT DEFAULT '新对话',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  timestamp       INTEGER NOT NULL
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_references_workspace ON references(workspace_id);
CREATE INDEX IF NOT EXISTS idx_references_year ON references(year);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id, created_at DESC);

-- Canvases (whiteboard & mindmap)
CREATE TABLE IF NOT EXISTS canvases (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT '无标题',
  type         TEXT NOT NULL DEFAULT 'whiteboard',  -- 'whiteboard' | 'mindmap'
  data         TEXT NOT NULL DEFAULT '{}',           -- JSON blob
  thumbnail    TEXT,                                  -- base64 preview
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canvases_workspace ON canvases(workspace_id, updated_at DESC);
