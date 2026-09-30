import React from 'react';

// Bottom-right confirmation. Always a short sentence, often ending in ✓. Auto-dismiss ~2.6s.
export function Toast({ message, style, ...rest }) {
  if (!message) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 'var(--radius-menu)', padding: '12px 18px', fontSize: 14, fontWeight: 500, zIndex: 60, boxShadow: 'var(--shadow-toast)', animation: 'fadeIn .2s ease', ...style }} {...rest}>{message}</div>
  );
}
