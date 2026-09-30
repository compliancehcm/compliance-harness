import React from 'react';
import { IconButton } from '../core/IconButton.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';
import { BrandMark } from '../core/BrandMark.jsx';
import { NavItem } from './NavItem.jsx';

// Sticky app bar: 12px vertical padding, card background, hairline bottom border.
// In 'sidebar' layout it shows the collapse toggle + screen title; in 'topo' layout
// it carries the brand lockup and the horizontal nav.
export function AppHeader({ layout = 'sidebar', title, items = [], activeKey, onSelect, onToggleNav, persona, onPersonaChange, notificationCount, onNotifications, avatar, redwoodStripe, stripeAsset = 'assets/redwood-stripe.svg', style, ...rest }) {
  return (
    <React.Fragment>
      {redwoodStripe ? <div aria-hidden="true" style={{ height: 'var(--redwood-band-height,8px)', flexShrink: 0, backgroundImage: `url('${stripeAsset}')`, backgroundSize: 'auto 8px', backgroundRepeat: 'repeat-x', backgroundColor: 'var(--redwood-band-accent,#2c5266)' }}></div> : null}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px clamp(12px,3vw,28px)', background: 'var(--card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 5, ...style }} {...rest}>
        {layout === 'sidebar' ? (
          <React.Fragment>
            <IconButton icon="painel" label="Recolher ou expandir menu" onClick={onToggleNav} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <BrandMark size="md" subtitle={null} />
            <nav aria-label="Menu principal" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 12, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {items.map(it => <NavItem key={it.key} variant="top" icon={it.icon} label={it.label} active={activeKey === it.key} onClick={() => onSelect && onSelect(it.key)} />)}
            </nav>
          </React.Fragment>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {persona ? (
            <React.Fragment>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Visualizar como:</div>
              <SegmentedControl value={persona} onChange={onPersonaChange}
                options={[{ value: 'funcionario', label: 'Funcionário' }, { value: 'gestor', label: 'Líder / Gestor' }]} />
            </React.Fragment>
          ) : null}
          <IconButton icon="sino" label="Notificações" count={notificationCount} onClick={onNotifications} />
          {avatar}
        </div>
      </header>
    </React.Fragment>
  );
}
