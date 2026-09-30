import React from 'react';

// Scrim + centered panel. Header (title + optional subtitle), body, right-aligned footer.
export function Modal({ open = true, title, subtitle, width = 440, onClose, footer, closeButton, children, style, ...rest }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 'var(--radius-xl)', width, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', overflowX: 'hidden', animation: 'fadeIn .2s ease', ...style }} {...rest}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          {closeButton ? <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: 'var(--muted-foreground)', cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button> : null}
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        {footer ? <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>{footer}</div> : null}
      </div>
    </div>
  );
}
