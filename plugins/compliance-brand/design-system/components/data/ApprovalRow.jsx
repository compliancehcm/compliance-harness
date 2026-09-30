import React from 'react';
import { Button } from '../core/Button.jsx';
import { Badge } from '../core/Badge.jsx';

// The approval / request primitive: tinted row on --row-bg, title in --row-title,
// optional 3px status rail on the left edge, Rejeitar/Aprovar pair on the right.
// Once decided the buttons are replaced by the status badge — never both.
const rails = { pending: 'var(--rail-pending)', done: 'var(--rail-done)', info: 'var(--primary)' };

export function ApprovalRow({ leading, tag, title, detail, status, rail, approveLabel = 'Aprovar', rejectLabel = 'Rejeitar', onApprove, onReject, style, ...rest }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--row-bg)', border: '1px solid var(--border-subtle)', borderLeft: rail ? '3px solid ' + (rails[rail] || rail) : '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', ...style }} {...rest}>
      {leading}
      {tag}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--row-title)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{detail}</div>
      </div>
      {status
        ? <Badge status={status} />
        : (
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="secondary" size="sm" onClick={onReject}>{rejectLabel}</Button>
            <Button variant="primary" size="sm" style={{ fontWeight: 500 }} onClick={onApprove}>{approveLabel}</Button>
          </div>
        )}
    </div>
  );
}
