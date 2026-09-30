import React from 'react';

// Native checkbox tinted with accent-color; label sits inline at 13–14px.
export function Checkbox({ label, size = 'md', style, ...rest }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: size === 'sm' ? 7 : 8, fontSize: size === 'sm' ? 13 : 14, color: 'var(--secondary-foreground)', cursor: 'pointer', ...style }}>
      <input type="checkbox" style={{ accentColor: 'var(--primary)', margin: 0 }} {...rest} />
      {label}
    </label>
  );
}
