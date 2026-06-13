import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import appReducer from './slices/appSlice';
import documentsReducer from './slices/documentsSlice';
import workspacesReducer from './slices/workspacesSlice';
import editorReducer from './slices/editorSlice';
import settingsReducer from './slices/settingsSlice';
import referencesReducer from './slices/referencesSlice';
import pluginsReducer from './slices/pluginsSlice';
import aiReducer from './slices/aiSlice';
import templatesReducer from './slices/templatesSlice';
import presentationsReducer from './slices/presentationsSlice';
import authReducer from './slices/authSlice';

const appPersistConfig = {
  key: 'qiwen-app',
  storage,
  // 持久化 tabs 和 activeTabId，重启后自动恢复已打开的文档标签
  whitelist: ['sidebarOpen', 'activeWorkspaceId', 'tabs', 'activeTabId'],  // activeView 不持久化，避免重启后直接进入未就绪的视图导致白屏
};

// ── plugins 持久化，安装/启用状态跨会话保留 ──────────────
const pluginsPersistConfig = {
  key: 'qiwen-plugins',
  storage,
};

const rootReducer = combineReducers({
  app:        persistReducer(appPersistConfig, appReducer),
  documents:  documentsReducer,
  workspaces: workspacesReducer,
  editor:     editorReducer,
  settings:   persistReducer({ key: 'qiwen-settings', storage }, settingsReducer),
  references: referencesReducer,
  plugins:    persistReducer(pluginsPersistConfig, pluginsReducer),
  ai:         aiReducer,
  auth:       authReducer,
  templates:     templatesReducer,
  presentations: presentationsReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
