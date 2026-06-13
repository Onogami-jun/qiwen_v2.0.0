import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AppSettings } from '../../../shared/types';
import { ipc } from '../../utils/ipc';

const defaultSettings: AppSettings = {
  theme: 'dark',
  accentColor: '#c8a96e',
  fontSize: 15,
  fontFamily: 'default',
  lineHeight: 1.85,
  editorWidth: 'normal',
  spellCheck: false,
  autoSave: true,
  autoSaveInterval: 3000,
  showWordCount: true,
  showLineNumbers: false,
  focusModeBlur: 70,
  language: 'zh-CN',
  sidebarWidth: 220,
  rightPanelWidth: 260,
};

interface SettingsState extends AppSettings {
  loaded: boolean;
}

const initialState: SettingsState = { ...defaultSettings, loaded: false };

export const loadSettings = createAsyncThunk('settings/load', async () => {
  return ipc.invoke<Partial<AppSettings>>('settings:get-all');
});

export const saveSetting = createAsyncThunk(
  'settings/save',
  async ({ key, value }: { key: keyof AppSettings; value: any }) => {
    await ipc.invoke('settings:set', { key, value });
    return { key, value };
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSetting: (state, action: PayloadAction<{ key: keyof AppSettings; value: any }>) => {
      (state as any)[action.payload.key] = action.payload.value;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.fulfilled, (state, action) => {
        if (action.payload) Object.assign(state, action.payload);
        state.loaded = true;
      })
      .addCase(saveSetting.fulfilled, (state, action) => {
        (state as any)[action.payload.key] = action.payload.value;
      });
  },
});

export const { updateSetting } = settingsSlice.actions;
export default settingsSlice.reducer;
