import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { closeTab, setActiveTab, openTab } from '../../store/slices/appSlice';
import { createDocument } from '../../store/slices/documentsSlice';

export const TabBar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { tabs, activeTabId, activeWorkspaceId } = useSelector((s: RootState) => s.app);

  const handleNewTab = async () => {
    if (!activeWorkspaceId) return;
    const doc = await dispatch(createDocument({ workspaceId: activeWorkspaceId, title: '无标题' })).unwrap();
    dispatch(openTab({ documentId: doc.id, title: doc.title }));
  };

  return (
    <div style={{
      height: 'var(--tabbar-height)',
      borderBottom: '0.5px solid var(--border)',
      display: 'flex', alignItems: 'flex-end',
      padding: '0 12px', gap: 2,
      background: 'var(--bg-surface)',
      flexShrink: 0,
    }}>
      <AnimatePresence initial={false}>
        {tabs.map((tab) => (
          <motion.div
            key={tab.id}
            layout
            initial={{ opacity: 0, scaleX: 0.8, y: 4 }}
            animate={{ opacity: 1, scaleX: 1, y: 0 }}
            exit={{ opacity: 0, scaleX: 0.8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => dispatch(setActiveTab(tab.id))}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: '7px 7px 0 0',
              fontSize: 12.5, cursor: 'pointer',
              maxWidth: 160, position: 'relative',
              border: '0.5px solid transparent',
              borderBottom: 'none',
              background: activeTabId === tab.id ? 'var(--bg-surface2)' : 'transparent',
              color: activeTabId === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderColor: activeTabId === tab.id ? 'var(--border)' : 'transparent',
              marginBottom: activeTabId === tab.id ? '-0.5px' : 0,
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {/* Dirty indicator */}
            {tab.isDirty && (
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent)', flexShrink: 0,
              }} />
            )}
            {!tab.isDirty && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            )}

            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {tab.title || '无标题'}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); dispatch(closeTab(tab.id)); }}
              title="关闭"
              style={{
                width: 16, height: 16, borderRadius: '50%',
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: 'var(--text-tertiary)',
                opacity: activeTabId === tab.id ? 0.5 : 0.3,
                transition: 'opacity 0.15s, background 0.15s, color 0.15s',
                flexShrink: 0, lineHeight: 1,
              }}
              onMouseEnter={e => {
                const btn = e.currentTarget;
                btn.style.opacity = '1';
                btn.style.background = 'rgba(255,100,100,0.15)';
                btn.style.color = '#ff6b6b';
              }}
              onMouseLeave={e => {
                const btn = e.currentTarget;
                btn.style.opacity = activeTabId === tab.id ? '0.5' : '0.3';
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-tertiary)';
              }}
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>



      <motion.button
        whileHover={{ background: 'var(--bg-surface3)', color: 'var(--text-primary)' }}
        whileTap={{ scale: 0.95 }}
        onClick={handleNewTab}
        style={{
          width: 26, height: 26, borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: 'var(--text-tertiary)', border: 'none',
          background: 'transparent', cursor: 'pointer', marginBottom: 4,
          transition: 'all 0.15s', marginLeft: 2,
        }}
      >
        +
      </motion.button>
    </div>
  );
};
