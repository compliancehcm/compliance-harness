import React from 'react';
import { NavItem } from './NavItem.jsx';
import { BrandMark } from '../core/BrandMark.jsx';
import { Avatar } from '../core/Avatar.jsx';

// Sticky 240px rail that collapses to 64px. Brand lockup on top, nav in the middle,
// user row pinned to the bottom over a hairline.
export function Sidebar({ items = [], activeKey, collapsed, user, onSelect, onUserClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <aside style={{ width: collapsed ? 64 : 240, flexShrink: 0, background: 'var(--nav-bg)', borderRight: '1px solid var(--nav-border)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box', transition: 'width .2s ease', overflow: 'hidden', ...style }} {...rest}>
      <div style={collapsed ? { display: 'flex', justifyContent: 'center', padding: '20px 0 16px' } : { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 16px' }}>
        <BrandMark size="md" tone="nav" showText={!collapsed} />
      </div>
      <nav aria-label="Menu principal" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px' }}>
        {items.map(it => (
          <NavItem key={it.key} icon={it.icon} label={it.label} badge={!collapsed && it.badge} active={activeKey === it.key}
            variant={collapsed ? 'rail' : 'sidebar'} onClick={() => onSelect && onSelect(it.key)} />
        ))}
      </nav>
      {user ? (
        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--nav-border)' }}>
          <div onClick={onUserClick} title={user.name} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10, padding: 8, borderRadius: 'var(--radius-lg)', cursor: 'pointer', background: hover ? 'var(--nav-hover)' : 'transparent' }}>
            <Avatar name={user.name} tone="nav" />
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--nav-fg-strong)' }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--nav-fg)', whiteSpace: 'nowrap' }}>{user.role}</div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
