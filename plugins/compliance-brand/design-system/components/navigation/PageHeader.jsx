import React from 'react';

// Screen title block. Dashboard uses 24px; inner screens use 22px with an 18px muted subtitle.
export function PageHeader({ title, subtitle, action, size = 'inner', style, ...rest }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: size === 'dash' ? 24 : 20, flexWrap: 'wrap', ...style }} {...rest}>
      <div>
        <h1 style={{ margin: 0, fontSize: size === 'dash' ? 24 : 22, fontWeight: 700, letterSpacing: 'var(--tracking-h1)', color: 'var(--heading)' }}>{title}</h1>
        {subtitle ? <div style={{ fontSize: size === 'dash' ? 14 : 18, color: 'var(--muted-foreground)', marginTop: size === 'dash' ? 4 : 6, lineHeight: 'var(--leading-snug)', fontWeight: 400 }}>{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}
