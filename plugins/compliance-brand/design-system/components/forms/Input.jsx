import React from 'react';

export const controlStyle = { border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', background: 'var(--card)', color: 'var(--foreground)' };

export function Input({ type = 'text', trailing, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const input = (
    <input type={type} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{ ...controlStyle, ...(trailing ? { padding: '10px 40px 10px 12px' } : null), ...(focus ? { borderColor: 'var(--primary)' } : null), ...style }} {...rest} />
  );
  if (!trailing) return input;
  return (
    <div style={{ position: 'relative' }}>
      {input}
      <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--muted-foreground)' }}>{trailing}</span>
    </div>
  );
}
