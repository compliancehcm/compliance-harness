import React from 'react';

export function iniciais(nome = '') {
  return nome.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

// Initials circle. No photography anywhere in the product.
export function Avatar({ name, initials, size = 32, tone = 'muted', style, ...rest }) {
  const t = tone === 'nav'
    ? { background: 'var(--nav-active-bg)', color: 'var(--nav-fg-strong)' }
    : { background: 'var(--muted)', color: 'var(--secondary-foreground)' };
  return (
    <div style={{ width: size, height: size, flexShrink: 0, borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size <= 28 ? 12 : 13, fontWeight: 600, ...t, ...style }} {...rest}>
      {initials || iniciais(name)}
    </div>
  );
}
