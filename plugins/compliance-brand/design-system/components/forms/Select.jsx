import React from 'react';
import { controlStyle } from './Input.jsx';

// Native select — the product never uses a custom listbox. 9px vertical padding in modals.
export function Select({ options = [], children, style, ...rest }) {
  return (
    <select style={{ ...controlStyle, padding: '9px 12px', ...style }} {...rest}>
      {children || options.map(o => (
        typeof o === 'string'
          ? <option key={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
