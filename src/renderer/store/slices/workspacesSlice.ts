import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Workspace } from '../../../shared/types';
import { ipc } from '../../utils/ipc';

interface WorkspacesState {
  items: Workspace[];
  loading: boolean;
}

const initialState: WorkspacesState = { items: [], loading: false };

export const fetchWorkspaces = createAsyncThunk('workspaces/fetchAll', async () => {
  return ipc.invoke<Workspace[]>('workspaces:list');
});

export const createWorkspace = createAsyncThunk(
  'workspaces/create',
  async (payload: Partial<Workspace>) => {
    return ipc.invoke<Workspace>('workspaces:create', payload);
  }
);

export const deleteWorkspace = createAsyncThunk(
  'workspaces/delete',
  async (id: string) => {
    await ipc.invoke('workspaces:delete', { id });
    return id;
  }
);

const workspacesSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkspaces.pending, (state) => { state.loading = true; })
      .addCase(fetchWorkspaces.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(createWorkspace.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(deleteWorkspace.fulfilled, (state, action) => {
        state.items = state.items.filter(w => w.id !== action.payload);
      });
  },
});

export default workspacesSlice.reducer;
