import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ipc } from '../../utils/ipc';

export interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
  description: string;
  tags: string[];
  isBuiltin: boolean;
  use_count: number;
  created_at: number;
  updated_at: number;
}

interface TemplatesState {
  items: Template[];
  loading: boolean;
  activeCategory: string;
}

const initialState: TemplatesState = {
  items: [],
  loading: false,
  activeCategory: 'all',
};

export const fetchTemplates = createAsyncThunk('templates/fetchAll', async (category?: string) => {
  return ipc.invoke<Template[]>('templates:list', { category });
});

export const createTemplate = createAsyncThunk('templates/create', async (
  payload: { title: string; content: string; category: string; description?: string; tags?: string[] }
) => {
  return ipc.invoke<Template>('templates:create', payload);
});

export const updateTemplate = createAsyncThunk('templates/update', async (
  payload: { id: string; title?: string; content?: string; category?: string; description?: string; tags?: string[] }
) => {
  await ipc.invoke('templates:update', payload);
  return payload;
});

export const deleteTemplate = createAsyncThunk('templates/delete', async (id: string) => {
  await ipc.invoke('templates:delete', { id });
  return id;
});

export const useTemplate = createAsyncThunk('templates/use', async (id: string) => {
  const content = await ipc.invoke<string>('templates:use', { id });
  return { id, content };
});

const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    setActiveCategory(state, action: PayloadAction<string>) {
      state.activeCategory = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => { state.loading = true; })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchTemplates.rejected, (state) => { state.loading = false; })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.items = state.items.filter(t => t.id !== action.payload);
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const idx = state.items.findIndex(t => t.id === action.payload.id);
        if (idx >= 0) Object.assign(state.items[idx], action.payload);
      })
      .addCase(useTemplate.fulfilled, (state, action) => {
        const t = state.items.find(t => t.id === action.payload.id);
        if (t) t.use_count = (t.use_count || 0) + 1;
      });
  },
});

export const { setActiveCategory } = templatesSlice.actions;
export default templatesSlice.reducer;
