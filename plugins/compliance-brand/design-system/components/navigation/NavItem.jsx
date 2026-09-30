import React from 'react';
import { Icon } from '../core/Icon.jsx';

// One nav row in three layouts: 'sidebar' (expanded), 'rail' (64px collapsed),
// 'top' (horizontal bar), 'drop' (mobile dropdown).
export function NavItem({ icon, label, active, badge, variant = 'sidebar', onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const layouts = {
    sidebar: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-lg)', border: 'none', background: 'transparent', fontSize: 14, fontWeight: 500, color: 'var(--nav-fg)', cursor: 'pointer', textAlign: 'left', width: '100%' },
    rail: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 0', borderRadius: 'var(--radius-lg)', border: 'none', background: 'transparent', color: 'var(--nav-fg)', cursor: 'pointer', width: '100%' },
    top: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-lg)', border: 'none', background: 'transparent', fontSize: 14, fontWeight: 500, color: 'var(--nav-fg)', cursor: 'pointer', whiteSpace: 'nowrap' },
    drop: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', borderRadius: 'var(--radius-sm)', padding: '10px 10px', fontSize: 14, fontWeight: 500, color: 'var(--secondary-foreground)', cursor: 'pointer', textAlign: 'left' }
  };
  const activeStyles = {
    sidebar: { background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', fontWeight: 600 },
    rail: { background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', fontWeight: 600 },
    top: { background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', fontWeight: 600 },
    drop: { background: 'var(--muted)', color: 'var(--foreground)', fontWeight: 600 }
  };
  const s = { ...layouts[variant], ...(active ? activeStyles[variant] : null), ...(hover && !active ? { background: variant === 'drop' ? 'var(--muted)' : 'var(--nav-hover)' } : null), ...style };
  return (
    <button type="button" onClick={onClick} title={label} style={s}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}>
      <Icon name={icon} size={variant === 'sidebar' || variant === 'rail' ? 16 : 15} />
      {variant !== 'rail' ? <span style={{ whiteSpace: 'nowrap' }}>{label}</span> : null}
      {badge && variant !== 'rail' ? <span style={{ marginLeft: 'auto', background: 'var(--nav-badge-bg)', color: 'var(--nav-badge-fg)', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-pill)', padding: '1px 7px' }}>{badge}</span> : null}
    </button>
  );
}
