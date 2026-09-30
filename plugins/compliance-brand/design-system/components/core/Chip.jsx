import React from 'react';

// Outline pill for neutral metadata: tipo de holerite, regime de contratação.
export function Chip({ children, style, ...rest }) {
  return (
    <span style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 10px', fontSize: 12, fontWeight: 500, color: 'var(--secondary-foreground)', whiteSpace: 'nowrap', ...style }} {...rest}>{children}</span>
  );
}
