import React from 'react';

/* The product has no logo file. The mark IS a rounded square holding the letter C,
   in --primary, next to the two-line lockup "Compliance HCM / Portal do Trabalhador".
   Sizes seen in the source: 44/11px radius (login), 32/8px (sidebar), 28/7px (mobile). */
const presets = { sm: { box: 28, radius: 7, font: 13 }, md: { box: 32, radius: 8, font: 14 }, lg: { box: 44, radius: 11, font: 19 } };

export function BrandMark({ size = 'md', showText = true, subtitle = 'Portal do Trabalhador', title = 'Compliance HCM', stacked = false, tone = 'primary', style, ...rest }) {
  const p = presets[size] || presets.md;
  const t = tone === 'nav'
    ? { background: 'var(--nav-badge-bg)', color: 'var(--nav-badge-fg)' }
    : { background: 'var(--primary)', color: 'var(--primary-foreground)' };
  return (
    <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: 'center', gap: stacked ? 10 : 10, ...style }} {...rest}>
      <div style={{ width: p.box, height: p.box, flexShrink: 0, borderRadius: p.radius, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: p.font, ...t }}>C</div>
      {showText && (
        <div style={{ minWidth: 0, textAlign: stacked ? 'center' : 'left' }}>
          <div style={{ fontSize: size === 'lg' ? 18 : 14, fontWeight: size === 'lg' ? 700 : 600, lineHeight: 1.2, letterSpacing: size === 'lg' ? 'var(--tracking-brand)' : 'normal', whiteSpace: 'nowrap', color: tone === 'nav' ? 'var(--nav-fg-strong)' : 'inherit' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: size === 'lg' ? 13 : 12, color: tone === 'nav' ? 'var(--nav-fg)' : 'var(--muted-foreground)', whiteSpace: 'nowrap', marginTop: size === 'lg' ? 2 : 0 }}>{subtitle}</div> : null}
        </div>
      )}
    </div>
  );
}
