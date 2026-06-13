import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupGlobalErrorCapture } from './utils/logger';

// 全局错误捕获 — 必须在 React 挂载前调用
setupGlobalErrorCapture();

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
