import React from 'react';

// Stroke-icon set used across the Portal. 24×24 grid, stroke-width 2, round caps —
// paths copied verbatim from Portal do Trabalhador.dc.html (Lucide geometry).
export const iconPaths = {
  dash: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  ponto: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M12 6v6l4 2'],
  holerite: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M16 13H8M16 17H8'],
  ferias: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  vagas: ['M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z', 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'],
  olho: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z'],
  painel: ['M9 3v18'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  sino: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  check: ['M20 6 9 17l-5-5'],
  sair: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  sso: ['M8 21h8', 'M12 18v3']
};
// Icons that also need a <rect> or <circle> primitive
const extras = {
  olho: <circle cx="12" cy="12" r="3"></circle>,
  painel: <rect x="3" y="3" width="18" height="18" rx="2"></rect>,
  sso: <rect x="3" y="4" width="18" height="14" rx="2"></rect>
};

export function Icon({ name, size = 16, strokeWidth = 2, style, ...rest }) {
  const paths = iconPaths[name] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }} {...rest}>
      {extras[name]}
      {paths.map((d, i) => <path key={i} d={d}></path>)}
    </svg>
  );
}
