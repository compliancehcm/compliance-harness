import React from 'react';

// Label + control wrapper. Two label styles exist in the product:
// stacked flex-column with 6px gap (login) and block label with 5px margin (modals).
export function Field({ label, htmlFor, hint, layout = 'stack', children, style, ...rest }) {
  if (layout === 'block') {
    return (
      <div style={style} {...rest}>
        {label ? <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 5 }}>{label}</label> : null}
        {children}
        {hint ? <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{hint}</div> : null}
      </div>
    );
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }} {...rest}>
      {label ? <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span> : null}
      {children}
      {hint ? <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{hint}</span> : null}
    </label>
  );
}
