/**
 * ErrorBoundary.tsx — 全局错误边界
 * v1.2.0: 防止 React 渲染错误导致整个白屏
 * 支持：分区域隔离、崩溃上报、一键重载
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  name?: string; // 区域名，用于定位问题
  fallback?: ReactNode; // 自定义降级 UI
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = Date.now().toString(36).toUpperCase();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { name = 'Unknown', onError } = this.props;
    console.error(`[ErrorBoundary:${name}]`, error, info.componentStack);
    onError?.(error, info);

    // 上报到主进程（如果 IPC 可用）
    try {
      const { ipcRenderer } = window.require?.('electron') || {};
      if (ipcRenderer) {
        ipcRenderer.invoke('crash:report', {
          type: 'renderer_error',
          message: error.message,
          stack: error.stack,
          context: { component: name, componentStack: info.componentStack?.slice(0, 1000) },
        }).catch(() => {});
      }
    } catch {}
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: '' });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { error, errorId } = this.state;
    const { name = '此区域' } = this.props;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, minHeight: 200, background: 'var(--bg-base, #1a1a1a)',
        border: '1px solid rgba(232,122,122,0.3)', borderRadius: 12,
        color: 'var(--text-primary, #e0e0d8)', fontFamily: 'inherit',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{name}遇到了问题</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8a8a84)', marginBottom: 4 }}>
          错误 ID: {errorId}
        </div>
        {error?.message && (
          <div style={{ fontSize: 12, color: '#e87a7a', marginBottom: 20, maxWidth: 400, textAlign: 'center', wordBreak: 'break-all' }}>
            {error.message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={this.handleReset}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border, #333)', background: 'var(--bg-surface2, #252525)', color: 'var(--text-primary, #e0e0d8)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            重试
          </button>
          <button
            onClick={this.handleReload}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent, #c8a96e)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            重新加载应用
          </button>
        </div>
      </div>
    );
  }
}

/**
 * withErrorBoundary HOC — 快速包装任意组件
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  name?: string,
): React.FC<P> {
  return (props: P) => (
    <ErrorBoundary name={name || WrappedComponent.displayName || WrappedComponent.name}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
}
