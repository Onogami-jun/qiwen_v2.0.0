import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Document, DocumentMeta } from '../../../shared/types';
import { ipc } from '../../utils/ipc';

interface DocumentsState {
  items: Record<string, DocumentMeta>;
  openDocuments: Record<string, Document>;
  failedDocIds: Record<string, boolean>;
  tree: DocumentMeta[];
  loading: boolean;
  saving: Record<string, boolean>;
  error: string | null;
}

const initialState: DocumentsState = {
  items: {},
  openDocuments: {},
  failedDocIds: {},
  tree: [],
  loading: false,
  saving: {},
  error: null,
};

export const fetchDocuments = createAsyncThunk(
  'documents/fetchAll',
  async ({ workspaceId, parentId }: { workspaceId: string; parentId?: string }) => {
    return ipc.invoke<DocumentMeta[]>('documents:list', { workspaceId, parentId });
  }
);

export const fetchDocument = createAsyncThunk(
  'documents/fetchOne',
  async (id: string, { rejectWithValue }) => {
    const doc = await ipc.invoke<Document | null>('documents:get', { id });
    if (!doc) return rejectWithValue('Document not found: ' + id);
    return doc;
  }
);

export const createDocument = createAsyncThunk(
  'documents/create',
  async (payload: { workspaceId: string; parentId?: string; title?: string; isFolder?: boolean }) => {
    return ipc.invoke<Document>('documents:create', payload);
  }
);

export const updateDocument = createAsyncThunk(
  'documents/update',
  async ({ id, ...data }: { id: string; title?: string; content?: string; tags?: string[] }) => {
    await ipc.invoke('documents:update', { id, ...data });
    return { id, ...data, updatedAt: Date.now() };
  }
);

export const deleteDocument = createAsyncThunk(
  'documents/delete',
  async (id: string) => {
    await ipc.invoke('documents:delete', { id });
    return id;
  }
);

export const searchDocuments = createAsyncThunk(
  'documents/search',
  async ({ workspaceId, query }: { workspaceId: string; query: string }) => {
    return ipc.invoke<DocumentMeta[]>('documents:search', { workspaceId, query });
  }
);

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setDocumentContent: (state, action: PayloadAction<{ id: string; content: string }>) => {
      const { id, content } = action.payload;
      if (state.openDocuments[id]) {
        state.openDocuments[id].content = content;
        state.openDocuments[id].updatedAt = Date.now();
      }
    },
    setSaving: (state, action: PayloadAction<{ id: string; saving: boolean }>) => {
      state.saving[action.payload.id] = action.payload.saving;
    },
    closeDocument: (state, action: PayloadAction<string>) => {
      delete state.openDocuments[action.payload];
      delete state.failedDocIds[action.payload];
    },
    syncDocumentToTree: (state, action: PayloadAction<{ id: string; updatedAt: number }>) => {
      const { id, updatedAt } = action.payload;
      const item = state.items[id];
      if (!item) return;
      const treeDoc = state.tree.find(d => d.id === id);
      if (treeDoc) {
        treeDoc.updatedAt = updatedAt;
      } else {
        // 文档首次保存后加入 tree（新建文档 createDocument 已经加了，这里处理边缘情况）
        state.tree.unshift({ ...item, updatedAt });
      }
      state.items[id] = { ...item, updatedAt };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => { state.loading = true; })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        const docs = action.payload;
        // IPC 返回 null/undefined（如 DB 未就绪）时不覆盖 tree，避免文档库清空
        if (!Array.isArray(docs)) return;
        // 返回空数组且 tree 已有数据时，保留现有 tree（防止竞态导致清空）
        if (docs.length === 0 && state.tree.length > 0) return;
        state.tree = docs;
        for (const doc of docs) {
          state.items[doc.id] = doc;
        }
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load documents';
      })
      .addCase(fetchDocument.fulfilled, (state, action) => {
        if (action.payload) {
          state.openDocuments[action.payload.id] = action.payload;
          state.items[action.payload.id] = action.payload;
          delete state.failedDocIds[action.payload.id];
        }
      })
      .addCase(fetchDocument.rejected, (state, action) => {
        // 记录加载失败的文档 id，EditorArea 据此显示错误而非无限 loading
        const id = action.meta.arg;
        state.failedDocIds[id] = true;
      })
      .addCase(createDocument.fulfilled, (state, action) => {
        const doc = action.payload;
        state.items[doc.id] = doc;
        state.tree.unshift(doc);
        state.openDocuments[doc.id] = doc;
      })
      .addCase(updateDocument.fulfilled, (state, action) => {
        const { id, title, content, updatedAt } = action.payload;
        const now = updatedAt || Date.now();
        // 更新 openDocuments
        if (state.openDocuments[id]) {
          if (title !== undefined) state.openDocuments[id].title = title;
          if (content !== undefined) state.openDocuments[id].content = content;
          state.openDocuments[id].updatedAt = now;
        }
        // 更新 items
        if (state.items[id]) {
          if (title !== undefined) state.items[id].title = title;
          state.items[id].updatedAt = now;
        }
        // 同步更新 tree（文档库列表）
        const treeDoc = state.tree.find(d => d.id === id);
        if (treeDoc) {
          if (title !== undefined) treeDoc.title = title;
          treeDoc.updatedAt = now;
        } else if (state.items[id]) {
          state.tree.unshift({ ...state.items[id] });
        }
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        const id = action.payload;
        delete state.items[id];
        delete state.openDocuments[id];
        state.tree = state.tree.filter(d => d.id !== id);
      });
  },
});

export const { setDocumentContent, setSaving, closeDocument, syncDocumentToTree } = documentsSlice.actions;
export default documentsSlice.reducer;
