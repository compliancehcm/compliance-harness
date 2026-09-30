import React from 'react';
import { Icon } from './Icon.jsx';

// 34×34 bordered square used in the header (menu toggle, bell) — optionally with a count dot.
export function IconButton({ icon, count, label, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: hover ? 'var(--muted)' : 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--secondary-foreground)', ...style }} {...rest}>
      {typeof icon === 'string' ? <Icon name={icon} size={16} /> : icon}
      {count ? (
        <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, boxSizing: 'border-box', background: 'var(--danger)', color: '#ffffff', borderRadius: 'var(--radius-pill)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{count}</span>
      ) : null}
    </button>
  );
}
