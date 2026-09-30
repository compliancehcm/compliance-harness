import React from 'react';

const colors = {
  Presente: 'var(--presence-present)',
  'Home office': 'var(--presence-remote)',
  Ausente: 'var(--presence-absent)',
  'Férias': 'var(--presence-vacation)'
};

// Team roster line: 8px colour dot, name + cargo, status on the right.
export function PersonRow({ name, role, status, style, ...rest }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', ...style }} {...rest}>
      <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-pill)', background: colors[status] || 'var(--muted-foreground)', flexShrink: 0 }}></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{role}</div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{status}</span>
    </div>
  );
}
