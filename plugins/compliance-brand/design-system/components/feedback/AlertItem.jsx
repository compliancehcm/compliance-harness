import React from 'react';

// Red soft-tint alert row (alertas de ponto) and the login error box share this treatment.
export function AlertItem({ title, description, children, style, ...rest }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--danger-soft-bg)', border: '1px solid var(--danger-soft-border)', borderRadius: 'var(--radius-lg)', ...style }} {...rest}>
      <div style={{ minWidth: 0 }}>
        {title ? <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger-soft-fg-strong)' }}>{title}</div> : null}
        {description ? <div style={{ fontSize: 13, color: 'var(--danger-soft-fg)' }}>{description}</div> : null}
        {children}
      </div>
    </div>
  );
}
