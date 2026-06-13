import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Plugin } from '../../../shared/types';

interface PluginsState {
  installed: Plugin[];
  loading: boolean;
  initialized: boolean;
}

const pluginsSlice = createSlice({
  name: 'plugins',
  initialState: {
    installed: [] as Plugin[],
    loading: false,
    initialized: false,
  } as PluginsState,
  reducers: {
    setPlugins: (state, action: PayloadAction<Plugin[]>) => {
      state.installed = action.payload;
      state.initialized = true;
    },
    // 启动时同步：更新已安装插件的元数据，不影响用户的 isEnabled 设置
    syncInstalledMetadata: (state, action: PayloadAction<Plugin[]>) => {
      const registry = action.payload;
      state.installed = state.installed.map(p => {
        const latest = registry.find(r => r.id === p.id);
        if (latest) return { ...latest, isEnabled: p.isEnabled, isInstalled: true, installedAt: p.installedAt };
        return p;
      });
      state.initialized = true;
    },
    togglePlugin: (state, action: PayloadAction<string>) => {
      const p = state.installed.find(p => p.id === action.payload);
      if (p) p.isEnabled = !p.isEnabled;
    },
    installPlugin: (state, action: PayloadAction<Plugin>) => {
      const exists = state.installed.find(p => p.id === action.payload.id);
      if (!exists) {
        state.installed.push({ ...action.payload, isInstalled: true, isEnabled: true, installedAt: Date.now() });
      }
    },
    uninstallPlugin: (state, action: PayloadAction<string>) => {
      state.installed = state.installed.filter(p => p.id !== action.payload);
    },
    updatePluginSettings: (state, action: PayloadAction<{ id: string; settings: Record<string, any> }>) => {
      const p = state.installed.find(p => p.id === action.payload.id);
      if (p) p.settings = { ...p.settings, ...action.payload.settings };
    },
  },
});

export const { setPlugins, syncInstalledMetadata, togglePlugin, installPlugin, uninstallPlugin, updatePluginSettings } = pluginsSlice.actions;
export default pluginsSlice.reducer;
