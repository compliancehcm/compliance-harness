import React from 'react';

// Persona switch in the header: muted 3px-padded track, active pill is a white card with a 1px shadow.
export function SegmentedControl({ options = [], value, onChange, style, ...rest }) {
  const base = { border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' };
  const act = { ...base, background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, boxShadow: 'var(--shadow-segment)' };
  return (
    <div style={{ display: 'flex', background: 'var(--muted)', borderRadius: 'var(--radius-lg)', padding: 3, gap: 2, ...style }} {...rest}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <button key={v} type="button" onClick={() => onChange && onChange(v)} style={v === value ? act : base}>{l}</button>;
      })}
    </div>
  );
}
