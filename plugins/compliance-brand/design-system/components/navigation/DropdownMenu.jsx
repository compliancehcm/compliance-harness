import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Popover surface used for the user menu, notifications and the mobile nav.
// Click-away scrim, 10px radius, 0 8px 30px shadow.
export function DropdownMenu({ open = true, onClose, width = 220, anchor = { right: 16, top: 60 }, scrim = 'transparent', header, footer, children, style, ...rest }) {
  if (!open) return null;
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: scrim }}></div>
      <div style={{ position: 'fixed', zIndex: 71, width, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-menu)', boxShadow: 'var(--shadow-popover)', overflow: 'hidden', ...anchor, ...style }} {...rest}>
        {header ? <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{header}</div> : null}
        <div style={{ padding: 6 }}>{children}</div>
        {footer ? <div style={{ padding: 6, borderTop: '1px solid var(--border)' }}>{footer}</div> : null}
      </div>
    </React.Fragment>
  );
}

export function MenuSection({ label, children }) {
  return (
    <React.Fragment>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', padding: '6px 8px 4px' }}>{label}</div>
      {children}
    </React.Fragment>
  );
}

export function MenuItem({ label, selected, icon, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: hover ? 'var(--muted)' : 'transparent', borderRadius: 'var(--radius-sm)', padding: 8, fontSize: 14, fontWeight: selected ? 600 : 400, color: icon ? 'var(--secondary-foreground)' : 'var(--foreground)', cursor: 'pointer', textAlign: 'left', ...style }} {...rest}>
      {icon
        ? <Icon name={icon} size={14} />
        : <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}>{selected ? <Icon name="check" size={14} strokeWidth={2.5} /> : null}</span>}
      <span>{label}</span>
    </button>
  );
}
