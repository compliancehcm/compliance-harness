import React from 'react';

const base = {
  border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  whiteSpace: 'nowrap', fontFamily: 'var(--font)'
};
const sizes = {
  sm: { padding: '6px 12px', fontSize: 13, fontWeight: 500 },
  md: { padding: '8px 16px', fontSize: 14 },
  lg: { padding: '10px 18px', fontSize: 14 },
  xl: { padding: '11px', fontSize: 14 }
};
const variants = {
  primary: { background: 'var(--primary)', color: 'var(--primary-foreground)' },
  secondary: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' },
  ghost: { background: 'transparent', color: 'var(--secondary-foreground)' },
  onPrimary: { background: 'var(--card)', color: 'var(--primary)' },
  link: { background: 'none', padding: 0, color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }
};
const hovers = {
  primary: 'var(--primary-hover)', secondary: 'var(--muted)', ghost: 'var(--muted)', onPrimary: 'var(--border)', link: null
};

export function Button({ variant = 'primary', size = 'md', fullWidth, disabled, icon, children, style, onClick, type = 'button', ...rest }) {
  const [hover, setHover] = React.useState(false);
  const hoverBg = hovers[variant];
  const s = {
    ...base, ...sizes[size], ...variants[variant],
    ...(fullWidth ? { width: '100%' } : null),
    ...(hover && hoverBg && !disabled ? { background: hoverBg } : null),
    ...(disabled ? { opacity: .5, cursor: 'not-allowed' } : null),
    ...style
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={s}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}>
      {icon}{children}
    </button>
  );
}
