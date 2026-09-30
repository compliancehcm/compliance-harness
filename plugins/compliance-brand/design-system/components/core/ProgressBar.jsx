import React from 'react';

// 8px muted track with a primary bar. `offset` positions the bar (escala de férias timeline).
// tone="accent" is the amber bar; on="dark" swaps the track for a translucent white one
// (use inside the primary StatCard or the sidebar).
export function ProgressBar({ value = 100, offset = 0, tone = 'primary', on = 'light', style, ...rest }) {
  const fills = { primary: 'var(--primary)', accent: 'var(--accent)', success: 'var(--success)', danger: 'var(--danger)' };
  return (
    <div style={{ flex: 1, minWidth: 120, height: 8, background: on === 'dark' ? 'var(--nav-progress-track)' : 'var(--muted)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', ...style }} {...rest}>
      <div style={{ height: '100%', borderRadius: 'var(--radius-pill)', background: fills[tone] || fills.primary, width: value + '%', marginLeft: offset + '%' }}></div>
    </div>
  );
}
