import React from 'react';

// The one container in the system: white surface, hairline border, 12px radius, no shadow.
export function Card({ title, action, padding = 20, children, style, ...rest }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding, ...style }} {...rest}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
          {title ? <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--heading)' }}>{title}</div> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
