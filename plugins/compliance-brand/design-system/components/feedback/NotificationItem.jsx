import React from 'react';

// Row in the notifications popover. Unread = filled primary dot + 600 title.
export function NotificationItem({ title, text, time, read, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderBottom: '1px solid var(--muted)', background: hover ? 'var(--muted)' : 'transparent', ...style }} {...rest}>
      <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-pill)', background: read ? 'transparent' : 'var(--primary)', border: read ? '1px solid var(--border)' : 'none', flexShrink: 0, marginTop: 6 }}></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: read ? 500 : 600, color: 'var(--foreground)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--secondary-foreground)', marginTop: 1, lineHeight: 'var(--leading-body)' }}>{text}</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 3 }}>{time}</div>
      </div>
    </div>
  );
}
