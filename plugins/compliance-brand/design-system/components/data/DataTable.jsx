import React from 'react';

// Grid "table": uppercase 12px head on --background, 14px rows divided by --muted.
// Columns are fr ratios; minWidth keeps it scrollable instead of wrapping.
export function DataTable({ columns = [], rows = [], minWidth = 560, onRowClick, style, ...rest }) {
  const template = columns.map(c => c.width || '1fr').join(' ');
  const cell = { display: 'grid', gridTemplateColumns: template, gap: 12, minWidth, boxSizing: 'border-box' };
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflowX: 'auto', ...style }} {...rest}>
      <div style={{ ...cell, padding: '10px 20px', background: 'var(--background)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-eyebrow)' }}>
        {columns.map(c => <div key={c.key}>{c.label}</div>)}
      </div>
      {rows.map((r, i) => <Row key={i} row={r} columns={columns} cell={cell} onClick={onRowClick && (() => onRowClick(r))} />)}
    </div>
  );
}

function Row({ row, columns, cell, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...cell, padding: onClick ? '14px 20px' : '12px 20px', borderBottom: '1px solid var(--muted)', fontSize: 14, alignItems: 'center', cursor: onClick ? 'pointer' : 'default', background: onClick && hover ? 'var(--background)' : 'transparent' }}>
      {columns.map(c => <div key={c.key} style={c.style}>{c.render ? c.render(row) : row[c.key]}</div>)}
    </div>
  );
}
