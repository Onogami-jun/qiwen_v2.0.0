import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Reference } from '../../../shared/types';
import { ipc } from '../../utils/ipc';

interface ReferencesState {
  items: Reference[];
  total: number;
  page: number;
  loading: boolean;
  selectedId: string | null;
}

const initialState: ReferencesState = { items: [], total: 0, page: 1, loading: false, selectedId: null };

export const fetchReferences = createAsyncThunk(
  'references/fetchAll',
  async (params: { workspaceId: string; page?: number; search?: string }) => {
    return ipc.invoke<{ items: Reference[]; total: number; page: number }>('references:list', params);
  }
);

export const createReference = createAsyncThunk(
  'references/create',
  async (data: Partial<Reference>) => {
    return ipc.invoke<Reference>('references:create', data);
  }
);

export const deleteReference = createAsyncThunk(
  'references/delete',
  async (id: string) => {
    await ipc.invoke('references:delete', { id });
    return id;
  }
);

const referencesSlice = createSlice({
  name: 'references',
  initialState,
  reducers: {
    selectReference: (state, action) => { state.selectedId = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReferences.pending, (state) => { state.loading = true; })
      .addCase(fetchReferences.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload?.items ?? [];
        state.total = action.payload?.total ?? 0;
        state.page = action.payload?.page ?? 1;
      })
      .addCase(fetchReferences.rejected, (state) => {
        state.loading = false;
        state.items = [];
      })
      .addCase(createReference.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total++;
      })
      .addCase(deleteReference.fulfilled, (state, action) => {
        state.items = state.items.filter(r => r.id !== action.payload);
        state.total--;
      });
  },
});

export const { selectReference } = referencesSlice.actions;
export default referencesSlice.reducer;
