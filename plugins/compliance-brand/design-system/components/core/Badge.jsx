import React from 'react';

const tones = {
  success: { background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' },
  danger: { background: 'var(--status-danger-bg)', color: 'var(--status-danger-fg)' },
  warning: { background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' },
  info: { background: 'var(--status-info-bg)', color: 'var(--status-info-fg)' },
  purple: { background: 'var(--status-purple-bg)', color: 'var(--status-purple-fg)' },
  neutral: { background: 'var(--muted)', color: 'var(--secondary-foreground)' }
};

// Portuguese status vocabulary → tone, exactly as the Portal maps it.
export function toneForStatus(status) {
  if (['Aprovada', 'Aprovado', 'Concluída', 'OK'].includes(status)) return 'success';
  if (['Rejeitada', 'Rejeitado', 'Inconsistente'].includes(status)) return 'danger';
  return 'warning';
}

export function Badge({ tone = 'warning', status, children, style, ...rest }) {
  const t = tones[status ? toneForStatus(status) : tone] || tones.warning;
  return (
    <span style={{ ...t, borderRadius: 'var(--radius-pill)', padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...style }} {...rest}>
      {children ?? status}
    </span>
  );
}
