import React from 'react';

// KPI tile: 13px muted label, 26–28px bold number, 12–13px muted caption.
// variant="primary" is the highlighted tile (navy fill, white number) — one per KPI strip.
export function StatCard({ label, value, suffix, caption, action, tone, variant = 'default', size = 'md', children, style, ...rest }) {
  const colors = { positive: 'var(--success)', negative: 'var(--danger)' };
  const primary = variant === 'primary';
  const surface = primary
    ? { background: 'var(--primary)', border: '1px solid var(--primary)', color: 'var(--primary-foreground)' }
    : { background: 'var(--card)', border: '1px solid var(--border)' };
  const softFg = primary ? 'var(--primary-muted-foreground)' : 'var(--muted-foreground)';
  return (
    <div style={{ ...surface, borderRadius: 'var(--radius-xl)', padding: size === 'md' ? 16 : 20, ...style }} {...rest}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: size === 'md' ? 13 : 14, color: primary ? 'var(--primary-foreground)' : 'var(--muted-foreground)', fontWeight: primary ? 600 : 500 }}>{label}</div>
        {action}
      </div>
      <div style={{ fontSize: size === 'md' ? 26 : 28, fontWeight: 700, letterSpacing: 'var(--tracking-h1)', marginTop: 4, color: primary ? 'var(--primary-foreground)' : (colors[tone] || 'var(--heading)') }}>
        {value}{suffix ? <span style={{ fontSize: 14, color: softFg, fontWeight: 500 }}>{suffix}</span> : null}
      </div>
      {children ? <div style={{ marginTop: 10 }}>{children}</div> : null}
      {caption ? <div style={{ fontSize: size === 'md' ? 12 : 13, color: softFg, marginTop: children ? 8 : 2 }}>{caption}</div> : null}
    </div>
  );
}
