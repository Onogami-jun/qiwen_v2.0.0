import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DocumentTitleProps {
  title: string;
  onChange: (title: string) => void;
  tags?: string[];
  updatedAt?: number;
}

export const DocumentTitle: React.FC<DocumentTitleProps> = ({ title, onChange, tags = [], updatedAt }) => {
  const [localTitle, setLocalTitle] = useState(title);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.replace(/\n/g, '');
    setLocalTitle(val);
    onChange(val);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [onChange]);

  const relativeTime = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: zhCN })
    : null;

  return (
    <div style={{ marginBottom: 4 }}>
      <textarea
        ref={inputRef}
        value={localTitle}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="无标题"
        rows={1}
        style={{
          width: '100%', resize: 'none', overflow: 'hidden',
          fontFamily: '"Noto Serif SC", "Georgia", serif',
          fontSize: 30, fontWeight: 300, lineHeight: 1.3,
          color: 'var(--text-primary)',
          background: 'transparent', border: 'none', outline: 'none',
          caretColor: 'var(--accent)', letterSpacing: -0.3,
          display: 'block', padding: 0, marginBottom: 10,
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 28 }}>
        {relativeTime && <span>{relativeTime}</span>}
        {tags.map(tag => (
          <motion.span
            key={tag}
            whileHover={{ scale: 1.05 }}
            style={{
              padding: '2px 8px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(var(--accent-rgb), 0.1)',
              color: 'var(--accent)', fontSize: 11,
              border: '0.5px solid rgba(var(--accent-rgb), 0.2)',
              cursor: 'pointer',
            }}
          >
            {tag}
          </motion.span>
        ))}
        <motion.button
          whileHover={{ color: 'var(--accent)' }}
          style={{
            background: 'none', border: '0.5px dashed var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '1px 7px', cursor: 'pointer',
            fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'inherit',
          }}
        >
          + 标签
        </motion.button>
      </div>
    </div>
  );
};
