import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { clearNotification } from '../../store/slices/appSlice';

export const Notification: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const notification = useSelector((s: RootState) => s.app.notification);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => dispatch(clearNotification()), 3500);
    return () => clearTimeout(timer);
  }, [notification, dispatch]);

  const colors = {
    success: { bg: 'rgba(var(--color-success-rgb), 0.1)', border: 'rgba(var(--color-success-rgb), 0.25)', text: 'var(--color-success)' },
    error:   { bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.25)', text: '#ff6b6b' },
    info:    { bg: 'rgba(74,158,255,0.1)',  border: 'rgba(74,158,255,0.25)',  text: '#4a9eff' },
    warning: { bg: 'rgba(240,167,66,0.1)',  border: 'rgba(240,167,66,0.25)',  text: '#f0a742' },
  };

  return (
    <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 9000, pointerEvents: 'none' }}>
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius-lg)',
              background: colors[notification.type].bg,
              border: `0.5px solid ${colors[notification.type].border}`,
              color: colors[notification.type].text,
              fontSize: 13.5, backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
