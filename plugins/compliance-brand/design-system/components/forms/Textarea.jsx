import React from 'react';
import { controlStyle } from './Input.jsx';

export function Textarea({ rows = 3, style, ...rest }) {
  return <textarea rows={rows} style={{ ...controlStyle, padding: '9px 12px', resize: 'vertical', fontFamily: 'var(--font)', ...style }} {...rest} />;
}
