/* @ds-bundle: {"format":4,"namespace":"ComplianceHCMDesignSystem_dab0b1","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"BrandMark","sourcePath":"components/core/BrandMark.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"ProgressBar","sourcePath":"components/core/ProgressBar.jsx"},{"name":"StatCard","sourcePath":"components/core/StatCard.jsx"},{"name":"ApprovalRow","sourcePath":"components/data/ApprovalRow.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"PersonRow","sourcePath":"components/data/PersonRow.jsx"},{"name":"AlertItem","sourcePath":"components/feedback/AlertItem.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"NotificationItem","sourcePath":"components/feedback/NotificationItem.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"AppHeader","sourcePath":"components/navigation/AppHeader.jsx"},{"name":"DropdownMenu","sourcePath":"components/navigation/DropdownMenu.jsx"},{"name":"MenuSection","sourcePath":"components/navigation/DropdownMenu.jsx"},{"name":"MenuItem","sourcePath":"components/navigation/DropdownMenu.jsx"},{"name":"NavItem","sourcePath":"components/navigation/NavItem.jsx"},{"name":"PageHeader","sourcePath":"components/navigation/PageHeader.jsx"},{"name":"SegmentedControl","sourcePath":"components/navigation/SegmentedControl.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"53952857dc1d","components/core/Badge.jsx":"7d44023d046e","components/core/BrandMark.jsx":"089e3b77c7de","components/core/Button.jsx":"12d716f2ec69","components/core/Card.jsx":"e4c5822b1f1b","components/core/Chip.jsx":"93e8fbce253b","components/core/Icon.jsx":"0ade4b752b78","components/core/IconButton.jsx":"ac6a2a23fd8a","components/core/ProgressBar.jsx":"a6bcfbdfffa1","components/core/StatCard.jsx":"a78a6f6430a0","components/data/ApprovalRow.jsx":"0240def0f2ef","components/data/DataTable.jsx":"521f279a7521","components/data/PersonRow.jsx":"753002ac5dcc","components/feedback/AlertItem.jsx":"04938388afcf","components/feedback/Modal.jsx":"bd9c6a808973","components/feedback/NotificationItem.jsx":"d0da8869bd9d","components/feedback/Toast.jsx":"e6461be1130e","components/forms/Checkbox.jsx":"b1412d8e4eb5","components/forms/Field.jsx":"328481ee6105","components/forms/Input.jsx":"6ad23e5ea11a","components/forms/Select.jsx":"32061f1da7c9","components/forms/Textarea.jsx":"e12d8d9ea590","components/navigation/AppHeader.jsx":"fac24a2162f7","components/navigation/DropdownMenu.jsx":"0562a6224113","components/navigation/NavItem.jsx":"4026e50a845f","components/navigation/PageHeader.jsx":"60a3f222a989","components/navigation/SegmentedControl.jsx":"a08f93896669","components/navigation/Sidebar.jsx":"4a7177076a5c","ui_kits/portal-do-trabalhador/DashFuncionario.jsx":"2241326aa65b","ui_kits/portal-do-trabalhador/DashGestor.jsx":"d4f7fe0f7bde","ui_kits/portal-do-trabalhador/Ferias.jsx":"2f03cc787f94","ui_kits/portal-do-trabalhador/Holerites.jsx":"ffbd94d4d49f","ui_kits/portal-do-trabalhador/Login.jsx":"520a7a61466a","ui_kits/portal-do-trabalhador/Ponto.jsx":"5ad8c73c1559","ui_kits/portal-do-trabalhador/Portal.jsx":"596c041fe496","ui_kits/portal-do-trabalhador/Vagas.jsx":"9912a83480e9","ui_kits/portal-do-trabalhador/data.jsx":"14cfb11a0b48"},"inlinedExternals":[],"unexposedExports":[{"name":"controlStyle","sourcePath":"components/forms/Input.jsx"},{"name":"iconPaths","sourcePath":"components/core/Icon.jsx"},{"name":"iniciais","sourcePath":"components/core/Avatar.jsx"},{"name":"toneForStatus","sourcePath":"components/core/Badge.jsx"}]} */

(() => {

const __ds_ns = (window.ComplianceHCMDesignSystem_dab0b1 = window.ComplianceHCMDesignSystem_dab0b1 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function iniciais(nome = '') {
  return nome.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

// Initials circle. No photography anywhere in the product.
function Avatar({
  name,
  initials,
  size = 32,
  tone = 'muted',
  style,
  ...rest
}) {
  const t = tone === 'nav' ? {
    background: 'var(--nav-active-bg)',
    color: 'var(--nav-fg-strong)'
  } : {
    background: 'var(--muted)',
    color: 'var(--secondary-foreground)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: 'var(--radius-pill)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size <= 28 ? 12 : 13,
      fontWeight: 600,
      ...t,
      ...style
    }
  }, rest), initials || iniciais(name));
}
Object.assign(__ds_scope, { iniciais, Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  success: {
    background: 'var(--status-success-bg)',
    color: 'var(--status-success-fg)'
  },
  danger: {
    background: 'var(--status-danger-bg)',
    color: 'var(--status-danger-fg)'
  },
  warning: {
    background: 'var(--status-warning-bg)',
    color: 'var(--status-warning-fg)'
  },
  info: {
    background: 'var(--status-info-bg)',
    color: 'var(--status-info-fg)'
  },
  purple: {
    background: 'var(--status-purple-bg)',
    color: 'var(--status-purple-fg)'
  },
  neutral: {
    background: 'var(--muted)',
    color: 'var(--secondary-foreground)'
  }
};

// Portuguese status vocabulary → tone, exactly as the Portal maps it.
function toneForStatus(status) {
  if (['Aprovada', 'Aprovado', 'Concluída', 'OK'].includes(status)) return 'success';
  if (['Rejeitada', 'Rejeitado', 'Inconsistente'].includes(status)) return 'danger';
  return 'warning';
}
function Badge({
  tone = 'warning',
  status,
  children,
  style,
  ...rest
}) {
  const t = tones[status ? toneForStatus(status) : tone] || tones.warning;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      ...t,
      borderRadius: 'var(--radius-pill)',
      padding: '3px 10px',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), children ?? status);
}
Object.assign(__ds_scope, { toneForStatus, Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/BrandMark.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The product has no logo file. The mark IS a rounded square holding the letter C,
   in --primary, next to the two-line lockup "Compliance HCM / Portal do Trabalhador".
   Sizes seen in the source: 44/11px radius (login), 32/8px (sidebar), 28/7px (mobile). */
const presets = {
  sm: {
    box: 28,
    radius: 7,
    font: 13
  },
  md: {
    box: 32,
    radius: 8,
    font: 14
  },
  lg: {
    box: 44,
    radius: 11,
    font: 19
  }
};
function BrandMark({
  size = 'md',
  showText = true,
  subtitle = 'Portal do Trabalhador',
  title = 'Compliance HCM',
  stacked = false,
  tone = 'primary',
  style,
  ...rest
}) {
  const p = presets[size] || presets.md;
  const t = tone === 'nav' ? {
    background: 'var(--nav-badge-bg)',
    color: 'var(--nav-badge-fg)'
  } : {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'center',
      gap: stacked ? 10 : 10,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: p.box,
      height: p.box,
      flexShrink: 0,
      borderRadius: p.radius,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: p.font,
      ...t
    }
  }, "C"), showText && /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      textAlign: stacked ? 'center' : 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size === 'lg' ? 18 : 14,
      fontWeight: size === 'lg' ? 700 : 600,
      lineHeight: 1.2,
      letterSpacing: size === 'lg' ? 'var(--tracking-brand)' : 'normal',
      whiteSpace: 'nowrap',
      color: tone === 'nav' ? 'var(--nav-fg-strong)' : 'inherit'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size === 'lg' ? 13 : 12,
      color: tone === 'nav' ? 'var(--nav-fg)' : 'var(--muted-foreground)',
      whiteSpace: 'nowrap',
      marginTop: size === 'lg' ? 2 : 0
    }
  }, subtitle) : null));
}
Object.assign(__ds_scope, { BrandMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/BrandMark.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font)'
};
const sizes = {
  sm: {
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500
  },
  md: {
    padding: '8px 16px',
    fontSize: 14
  },
  lg: {
    padding: '10px 18px',
    fontSize: 14
  },
  xl: {
    padding: '11px',
    fontSize: 14
  }
};
const variants = {
  primary: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)'
  },
  secondary: {
    background: 'var(--card)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--secondary-foreground)'
  },
  onPrimary: {
    background: 'var(--card)',
    color: 'var(--primary)'
  },
  link: {
    background: 'none',
    padding: 0,
    color: 'var(--primary)',
    fontWeight: 500,
    textDecoration: 'underline',
    textUnderlineOffset: 2
  }
};
const hovers = {
  primary: 'var(--primary-hover)',
  secondary: 'var(--muted)',
  ghost: 'var(--muted)',
  onPrimary: 'var(--border)',
  link: null
};
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  disabled,
  icon,
  children,
  style,
  onClick,
  type = 'button',
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const hoverBg = hovers[variant];
  const s = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...(fullWidth ? {
      width: '100%'
    } : null),
    ...(hover && hoverBg && !disabled ? {
      background: hoverBg
    } : null),
    ...(disabled ? {
      opacity: .5,
      cursor: 'not-allowed'
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    style: s,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The one container in the system: white surface, hairline border, 12px radius, no shadow.
function Card({
  title,
  action,
  padding = 20,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding,
      ...style
    }
  }, rest), (title || action) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12
    }
  }, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--heading)'
    }
  }, title) : /*#__PURE__*/React.createElement("span", null), action), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Outline pill for neutral metadata: tipo de holerite, regime de contratação.
function Chip({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--secondary-foreground)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Stroke-icon set used across the Portal. 24×24 grid, stroke-width 2, round caps —
// paths copied verbatim from Portal do Trabalhador.dc.html (Lucide geometry).
const iconPaths = {
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
  olho: /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }),
  painel: /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "2"
  }),
  sso: /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "14",
    rx: "2"
  })
};
function Icon({
  name,
  size = 16,
  strokeWidth = 2,
  style,
  ...rest
}) {
  const paths = iconPaths[name] || [];
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: {
      flexShrink: 0,
      ...style
    }
  }, rest), extras[name], paths.map((d, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: d
  })));
}
Object.assign(__ds_scope, { iconPaths, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// 34×34 bordered square used in the header (menu toggle, bell) — optionally with a count dot.
function IconButton({
  icon,
  count,
  label,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    "aria-label": label,
    title: label,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      width: 34,
      height: 34,
      flexShrink: 0,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: hover ? 'var(--muted)' : 'var(--card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: 'var(--secondary-foreground)',
      ...style
    }
  }, rest), typeof icon === 'string' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }) : icon, count ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 16,
      height: 16,
      boxSizing: 'border-box',
      background: 'var(--danger)',
      color: '#ffffff',
      borderRadius: 'var(--radius-pill)',
      fontSize: 10,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 4px'
    }
  }, count) : null);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// 8px muted track with a primary bar. `offset` positions the bar (escala de férias timeline).
// tone="accent" is the amber bar; on="dark" swaps the track for a translucent white one
// (use inside the primary StatCard or the sidebar).
function ProgressBar({
  value = 100,
  offset = 0,
  tone = 'primary',
  on = 'light',
  style,
  ...rest
}) {
  const fills = {
    primary: 'var(--primary)',
    accent: 'var(--accent)',
    success: 'var(--success)',
    danger: 'var(--danger)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      flex: 1,
      minWidth: 120,
      height: 8,
      background: on === 'dark' ? 'var(--nav-progress-track)' : 'var(--muted)',
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      borderRadius: 'var(--radius-pill)',
      background: fills[tone] || fills.primary,
      width: value + '%',
      marginLeft: offset + '%'
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/core/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// KPI tile: 13px muted label, 26–28px bold number, 12–13px muted caption.
// variant="primary" is the highlighted tile (navy fill, white number) — one per KPI strip.
function StatCard({
  label,
  value,
  suffix,
  caption,
  action,
  tone,
  variant = 'default',
  size = 'md',
  children,
  style,
  ...rest
}) {
  const colors = {
    positive: 'var(--success)',
    negative: 'var(--danger)'
  };
  const primary = variant === 'primary';
  const surface = primary ? {
    background: 'var(--primary)',
    border: '1px solid var(--primary)',
    color: 'var(--primary-foreground)'
  } : {
    background: 'var(--card)',
    border: '1px solid var(--border)'
  };
  const softFg = primary ? 'var(--primary-muted-foreground)' : 'var(--muted-foreground)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      ...surface,
      borderRadius: 'var(--radius-xl)',
      padding: size === 'md' ? 16 : 20,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size === 'md' ? 13 : 14,
      color: primary ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
      fontWeight: primary ? 600 : 500
    }
  }, label), action), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size === 'md' ? 26 : 28,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-h1)',
      marginTop: 4,
      color: primary ? 'var(--primary-foreground)' : colors[tone] || 'var(--heading)'
    }
  }, value, suffix ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: softFg,
      fontWeight: 500
    }
  }, suffix) : null), children ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, children) : null, caption ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size === 'md' ? 12 : 13,
      color: softFg,
      marginTop: children ? 8 : 2
    }
  }, caption) : null);
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/ApprovalRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The approval / request primitive: tinted row on --row-bg, title in --row-title,
// optional 3px status rail on the left edge, Rejeitar/Aprovar pair on the right.
// Once decided the buttons are replaced by the status badge — never both.
const rails = {
  pending: 'var(--rail-pending)',
  done: 'var(--rail-done)',
  info: 'var(--primary)'
};
function ApprovalRow({
  leading,
  tag,
  title,
  detail,
  status,
  rail,
  approveLabel = 'Aprovar',
  rejectLabel = 'Rejeitar',
  onApprove,
  onReject,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      background: 'var(--row-bg)',
      border: '1px solid var(--border-subtle)',
      borderLeft: rail ? '3px solid ' + (rails[rail] || rail) : '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      ...style
    }
  }, rest), leading, tag, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--row-title)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)'
    }
  }, detail)), status ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    status: status
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "sm",
    onClick: onReject
  }, rejectLabel), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    size: "sm",
    style: {
      fontWeight: 500
    },
    onClick: onApprove
  }, approveLabel)));
}
Object.assign(__ds_scope, { ApprovalRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ApprovalRow.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Grid "table": uppercase 12px head on --background, 14px rows divided by --muted.
// Columns are fr ratios; minWidth keeps it scrollable instead of wrapping.
function DataTable({
  columns = [],
  rows = [],
  minWidth = 560,
  onRowClick,
  style,
  ...rest
}) {
  const template = columns.map(c => c.width || '1fr').join(' ');
  const cell = {
    display: 'grid',
    gridTemplateColumns: template,
    gap: 12,
    minWidth,
    boxSizing: 'border-box'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      overflowX: 'auto',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      ...cell,
      padding: '10px 20px',
      background: 'var(--background)',
      borderBottom: '1px solid var(--border)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--muted-foreground)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-eyebrow)'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.key
  }, c.label))), rows.map((r, i) => /*#__PURE__*/React.createElement(Row, {
    key: i,
    row: r,
    columns: columns,
    cell: cell,
    onClick: onRowClick && (() => onRowClick(r))
  })));
}
function Row({
  row,
  columns,
  cell,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...cell,
      padding: onClick ? '14px 20px' : '12px 20px',
      borderBottom: '1px solid var(--muted)',
      fontSize: 14,
      alignItems: 'center',
      cursor: onClick ? 'pointer' : 'default',
      background: onClick && hover ? 'var(--background)' : 'transparent'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.key,
    style: c.style
  }, c.render ? c.render(row) : row[c.key])));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/PersonRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const colors = {
  Presente: 'var(--presence-present)',
  'Home office': 'var(--presence-remote)',
  Ausente: 'var(--presence-absent)',
  'Férias': 'var(--presence-vacation)'
};

// Team roster line: 8px colour dot, name + cargo, status on the right.
function PersonRow({
  name,
  role,
  status,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 0',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 'var(--radius-pill)',
      background: colors[status] || 'var(--muted-foreground)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted-foreground)'
    }
  }, role)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted-foreground)'
    }
  }, status));
}
Object.assign(__ds_scope, { PersonRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/PersonRow.jsx", error: String((e && e.message) || e) }); }

// components/feedback/AlertItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Red soft-tint alert row (alertas de ponto) and the login error box share this treatment.
function AlertItem({
  title,
  description,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      padding: '10px 12px',
      background: 'var(--danger-soft-bg)',
      border: '1px solid var(--danger-soft-border)',
      borderRadius: 'var(--radius-lg)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--danger-soft-fg-strong)'
    }
  }, title) : null, description ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--danger-soft-fg)'
    }
  }, description) : null, children));
}
Object.assign(__ds_scope, { AlertItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/AlertItem.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Scrim + centered panel. Header (title + optional subtitle), body, right-aligned footer.
function Modal({
  open = true,
  title,
  subtitle,
  width = 440,
  onClose,
  footer,
  closeButton,
  children,
  style,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--scrim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--card)',
      borderRadius: 'var(--radius-xl)',
      width,
      maxWidth: '100%',
      maxHeight: '88vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      animation: 'fadeIn .2s ease',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '20px 24px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)',
      marginTop: 2
    }
  }, subtitle) : null), closeButton ? /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      border: 'none',
      background: 'none',
      fontSize: 18,
      color: 'var(--muted-foreground)',
      cursor: 'pointer',
      lineHeight: 1,
      padding: 4
    }
  }, "\u2715") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      padding: '16px 24px',
      borderTop: '1px solid var(--border)'
    }
  }, footer) : null));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/feedback/NotificationItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Row in the notifications popover. Unread = filled primary dot + 600 title.
function NotificationItem({
  title,
  text,
  time,
  read,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      padding: '12px 14px',
      borderBottom: '1px solid var(--muted)',
      background: hover ? 'var(--muted)' : 'transparent',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 'var(--radius-pill)',
      background: read ? 'transparent' : 'var(--primary)',
      border: read ? '1px solid var(--border)' : 'none',
      flexShrink: 0,
      marginTop: 6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: read ? 500 : 600,
      color: 'var(--foreground)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--secondary-foreground)',
      marginTop: 1,
      lineHeight: 'var(--leading-body)'
    }
  }, text), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted-foreground)',
      marginTop: 3
    }
  }, time)));
}
Object.assign(__ds_scope, { NotificationItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/NotificationItem.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Bottom-right confirmation. Always a short sentence, often ending in ✓. Auto-dismiss ~2.6s.
function Toast({
  message,
  style,
  ...rest
}) {
  if (!message) return null;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'fixed',
      bottom: 24,
      right: 24,
      background: 'var(--primary)',
      color: 'var(--primary-foreground)',
      borderRadius: 'var(--radius-menu)',
      padding: '12px 18px',
      fontSize: 14,
      fontWeight: 500,
      zIndex: 60,
      boxShadow: 'var(--shadow-toast)',
      animation: 'fadeIn .2s ease',
      ...style
    }
  }, rest), message);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Native checkbox tinted with accent-color; label sits inline at 13–14px.
function Checkbox({
  label,
  size = 'md',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: size === 'sm' ? 7 : 8,
      fontSize: size === 'sm' ? 13 : 14,
      color: 'var(--secondary-foreground)',
      cursor: 'pointer',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    style: {
      accentColor: 'var(--primary)',
      margin: 0
    }
  }, rest)), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Label + control wrapper. Two label styles exist in the product:
// stacked flex-column with 6px gap (login) and block label with 5px margin (modals).
function Field({
  label,
  htmlFor,
  hint,
  layout = 'stack',
  children,
  style,
  ...rest
}) {
  if (layout === 'block') {
    return /*#__PURE__*/React.createElement("div", _extends({
      style: style
    }, rest), label ? /*#__PURE__*/React.createElement("label", {
      htmlFor: htmlFor,
      style: {
        fontSize: 13,
        fontWeight: 500,
        display: 'block',
        marginBottom: 5
      }
    }, label) : null, children, hint ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)',
        marginTop: 4
      }
    }, hint) : null);
  }
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500
    }
  }, label) : null, children, hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted-foreground)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const controlStyle = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--card)',
  color: 'var(--foreground)'
};
function Input({
  type = 'text',
  trailing,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const input = /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...controlStyle,
      ...(trailing ? {
        padding: '10px 40px 10px 12px'
      } : null),
      ...(focus ? {
        borderColor: 'var(--primary)'
      } : null),
      ...style
    }
  }, rest));
  if (!trailing) return input;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, input, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 6,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      color: 'var(--muted-foreground)'
    }
  }, trailing));
}
Object.assign(__ds_scope, { controlStyle, Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Native select — the product never uses a custom listbox. 9px vertical padding in modals.
function Select({
  options = [],
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    style: {
      ...__ds_scope.controlStyle,
      padding: '9px 12px',
      ...style
    }
  }, rest), children || options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  rows = 3,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    style: {
      ...__ds_scope.controlStyle,
      padding: '9px 12px',
      resize: 'vertical',
      fontFamily: 'var(--font)',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/DropdownMenu.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Popover surface used for the user menu, notifications and the mobile nav.
// Click-away scrim, 10px radius, 0 8px 30px shadow.
function DropdownMenu({
  open = true,
  onClose,
  width = 220,
  anchor = {
    right: 16,
    top: 60
  },
  scrim = 'transparent',
  header,
  footer,
  children,
  style,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      background: scrim
    }
  }), /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'fixed',
      zIndex: 71,
      width,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-menu)',
      boxShadow: 'var(--shadow-popover)',
      overflow: 'hidden',
      ...anchor,
      ...style
    }
  }, rest), header ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderBottom: '1px solid var(--border)'
    }
  }, header) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 6
    }
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 6,
      borderTop: '1px solid var(--border)'
    }
  }, footer) : null));
}
function MenuSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--muted-foreground)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)',
      padding: '6px 8px 4px'
    }
  }, label), children);
}
function MenuItem({
  label,
  selected,
  icon,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      border: 'none',
      background: hover ? 'var(--muted)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
      padding: 8,
      fontSize: 14,
      fontWeight: selected ? 600 : 400,
      color: icon ? 'var(--secondary-foreground)' : 'var(--foreground)',
      cursor: 'pointer',
      textAlign: 'left',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      display: 'inline-flex',
      justifyContent: 'center'
    }
  }, selected ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 14,
    strokeWidth: 2.5
  }) : null), /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { DropdownMenu, MenuSection, MenuItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/DropdownMenu.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// One nav row in three layouts: 'sidebar' (expanded), 'rail' (64px collapsed),
// 'top' (horizontal bar), 'drop' (mobile dropdown).
function NavItem({
  icon,
  label,
  active,
  badge,
  variant = 'sidebar',
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const layouts = {
    sidebar: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 12px',
      borderRadius: 'var(--radius-lg)',
      border: 'none',
      background: 'transparent',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--nav-fg)',
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%'
    },
    rail: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '9px 0',
      borderRadius: 'var(--radius-lg)',
      border: 'none',
      background: 'transparent',
      color: 'var(--nav-fg)',
      cursor: 'pointer',
      width: '100%'
    },
    top: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 12px',
      borderRadius: 'var(--radius-lg)',
      border: 'none',
      background: 'transparent',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--nav-fg)',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    },
    drop: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      border: 'none',
      background: 'transparent',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 10px',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--secondary-foreground)',
      cursor: 'pointer',
      textAlign: 'left'
    }
  };
  const activeStyles = {
    sidebar: {
      background: 'var(--nav-active-bg)',
      color: 'var(--nav-active-fg)',
      fontWeight: 600
    },
    rail: {
      background: 'var(--nav-active-bg)',
      color: 'var(--nav-active-fg)',
      fontWeight: 600
    },
    top: {
      background: 'var(--nav-active-bg)',
      color: 'var(--nav-active-fg)',
      fontWeight: 600
    },
    drop: {
      background: 'var(--muted)',
      color: 'var(--foreground)',
      fontWeight: 600
    }
  };
  const s = {
    ...layouts[variant],
    ...(active ? activeStyles[variant] : null),
    ...(hover && !active ? {
      background: variant === 'drop' ? 'var(--muted)' : 'var(--nav-hover)'
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    title: label,
    style: s,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: variant === 'sidebar' || variant === 'rail' ? 16 : 15
  }), variant !== 'rail' ? /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: 'nowrap'
    }
  }, label) : null, badge && variant !== 'rail' ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      background: 'var(--nav-badge-bg)',
      color: 'var(--nav-badge-fg)',
      fontSize: 12,
      fontWeight: 600,
      borderRadius: 'var(--radius-pill)',
      padding: '1px 7px'
    }
  }, badge) : null);
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Screen title block. Dashboard uses 24px; inner screens use 22px with an 18px muted subtitle.
function PageHeader({
  title,
  subtitle,
  action,
  size = 'inner',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      marginBottom: size === 'dash' ? 24 : 20,
      flexWrap: 'wrap',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: size === 'dash' ? 24 : 22,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-h1)',
      color: 'var(--heading)'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size === 'dash' ? 14 : 18,
      color: 'var(--muted-foreground)',
      marginTop: size === 'dash' ? 4 : 6,
      lineHeight: 'var(--leading-snug)',
      fontWeight: 400
    }
  }, subtitle) : null), action);
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SegmentedControl.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Persona switch in the header: muted 3px-padded track, active pill is a white card with a 1px shadow.
function SegmentedControl({
  options = [],
  value,
  onChange,
  style,
  ...rest
}) {
  const base = {
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--muted-foreground)',
    whiteSpace: 'nowrap'
  };
  const act = {
    ...base,
    background: 'var(--card)',
    color: 'var(--foreground)',
    fontWeight: 600,
    boxShadow: 'var(--shadow-segment)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      background: 'var(--muted)',
      borderRadius: 'var(--radius-lg)',
      padding: 3,
      gap: 2,
      ...style
    }
  }, rest), options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      type: "button",
      onClick: () => onChange && onChange(v),
      style: v === value ? act : base
    }, l);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AppHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Sticky app bar: 12px vertical padding, card background, hairline bottom border.
// In 'sidebar' layout it shows the collapse toggle + screen title; in 'topo' layout
// it carries the brand lockup and the horizontal nav.
function AppHeader({
  layout = 'sidebar',
  title,
  items = [],
  activeKey,
  onSelect,
  onToggleNav,
  persona,
  onPersonaChange,
  notificationCount,
  onNotifications,
  avatar,
  redwoodStripe,
  stripeAsset = 'assets/redwood-stripe.svg',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, redwoodStripe ? /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      height: 'var(--redwood-band-height,8px)',
      flexShrink: 0,
      backgroundImage: `url('${stripeAsset}')`,
      backgroundSize: 'auto 8px',
      backgroundRepeat: 'repeat-x',
      backgroundColor: 'var(--redwood-band-accent,#2c5266)'
    }
  }) : null, /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '12px clamp(12px,3vw,28px)',
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      ...style
    }
  }, rest), layout === 'sidebar' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "painel",
    label: "Recolher ou expandir menu",
    onClick: onToggleNav
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, title)) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.BrandMark, {
    size: "md",
    subtitle: null
  }), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Menu principal",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      marginLeft: 12,
      minWidth: 0,
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }
  }, items.map(it => /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    key: it.key,
    variant: "top",
    icon: it.icon,
    label: it.label,
    active: activeKey === it.key,
    onClick: () => onSelect && onSelect(it.key)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, persona ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)',
      whiteSpace: 'nowrap'
    }
  }, "Visualizar como:"), /*#__PURE__*/React.createElement(__ds_scope.SegmentedControl, {
    value: persona,
    onChange: onPersonaChange,
    options: [{
      value: 'funcionario',
      label: 'Funcionário'
    }, {
      value: 'gestor',
      label: 'Líder / Gestor'
    }]
  })) : null, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "sino",
    label: "Notifica\xE7\xF5es",
    count: notificationCount,
    onClick: onNotifications
  }), avatar)));
}
Object.assign(__ds_scope, { AppHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AppHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Sticky 240px rail that collapses to 64px. Brand lockup on top, nav in the middle,
// user row pinned to the bottom over a hairline.
function Sidebar({
  items = [],
  activeKey,
  collapsed,
  user,
  onSelect,
  onUserClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("aside", _extends({
    style: {
      width: collapsed ? 64 : 240,
      flexShrink: 0,
      background: 'var(--nav-bg)',
      borderRight: '1px solid var(--nav-border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      boxSizing: 'border-box',
      transition: 'width .2s ease',
      overflow: 'hidden',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: collapsed ? {
      display: 'flex',
      justifyContent: 'center',
      padding: '20px 0 16px'
    } : {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '20px 20px 16px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.BrandMark, {
    size: "md",
    tone: "nav",
    showText: !collapsed
  })), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Menu principal",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '8px 12px'
    }
  }, items.map(it => /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    key: it.key,
    icon: it.icon,
    label: it.label,
    badge: !collapsed && it.badge,
    active: activeKey === it.key,
    variant: collapsed ? 'rail' : 'sidebar',
    onClick: () => onSelect && onSelect(it.key)
  }))), user ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      padding: 12,
      borderTop: '1px solid var(--nav-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onUserClick,
    title: user.name,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'flex-start',
      gap: collapsed ? 0 : 10,
      padding: 8,
      borderRadius: 'var(--radius-lg)',
      cursor: 'pointer',
      background: hover ? 'var(--nav-hover)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: user.name,
    tone: "nav"
  }), !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: 'var(--nav-fg-strong)'
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--nav-fg)',
      whiteSpace: 'nowrap'
    }
  }, user.role)))) : null);
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/DashFuncionario.jsx
try { (() => {
const {
  Card,
  StatCard,
  Button,
  Badge
} = window.ComplianceHCMDesignSystem_dab0b1;
function DashFuncionario({
  clock,
  batidas,
  onRegistrar,
  ir,
  abrirHolerite
}) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const h = new Date().getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "Dashboard Funcion\xE1rio",
    style: {
      animation: 'fadeIn .25s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: '-.02em'
    }
  }, saudacao, ", Mariana"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--muted-foreground)',
      marginTop: 4
    }
  }, hoje)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--primary)',
      color: 'var(--primary-foreground)',
      borderRadius: 12,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--primary-muted-foreground)',
      textTransform: 'uppercase',
      letterSpacing: '.08em',
      fontWeight: 600
    }
  }, "Registro de ponto"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 44,
      fontWeight: 700,
      letterSpacing: '-.03em',
      lineHeight: 1.1,
      marginTop: 6,
      fontVariantNumeric: 'tabular-nums'
    }
  }, clock), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--primary-muted-foreground)',
      marginTop: 2
    }
  }, "Jornada prevista: 08:48 \xB7 Realizado hoje: 5h 03min")), /*#__PURE__*/React.createElement(Button, {
    variant: "onPrimary",
    onClick: onRegistrar,
    style: {
      padding: '12px 22px'
    }
  }, "Registrar ponto")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      marginTop: 20,
      paddingTop: 16,
      borderTop: '1px solid var(--primary-hover)',
      flexWrap: 'wrap'
    }
  }, batidas.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: 'var(--presence-on-dark)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums'
    }
  }, b.t), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--primary-muted-foreground)'
    }
  }, b.tipo))))), /*#__PURE__*/React.createElement(Card, {
    title: "\xDAltimo holerite",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "link",
      onClick: () => ir('holerite')
    }, "Ver todos")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--muted-foreground)'
    }
  }, "Junho 2026 \xB7 Mensal"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: '-.02em',
      marginTop: 2
    }
  }, "R$ 6.842,19"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)'
    }
  }, "l\xEDquido \xB7 pago em 30/06/2026")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: abrirHolerite
  }, "Ver detalhes"))), /*#__PURE__*/React.createElement(Card, {
    title: "Avisos do RH"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, window.avisos.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.titulo,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: 'var(--primary)',
      marginTop: 6,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500
    }
  }, a.titulo), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)',
      marginTop: 1
    }
  }, a.data, " \xB7 ", a.resumo))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    size: "lg",
    label: "Banco de horas",
    value: "+ 6h 12min",
    tone: "positive",
    caption: "Atualizado em 27/07 \xB7 compensa\xE7\xE3o at\xE9 30/09"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--muted-foreground)',
      fontWeight: 500
    }
  }, "Saldo de f\xE9rias"), /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    style: {
      fontSize: 13
    },
    onClick: () => ir('ferias')
  }, "Agendar")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: '-.02em',
      marginTop: 4
    }
  }, "22 dias"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)',
      marginTop: 2
    }
  }, "Per\xEDodo aquisitivo vence em 14/03/2027"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '10px 12px',
      background: 'var(--muted)',
      borderRadius: 8,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, "Pr\xF3ximas f\xE9rias:"), " 10/08 \u2013 24/08 ", /*#__PURE__*/React.createElement(Badge, {
    style: {
      marginLeft: 6,
      padding: '1px 8px'
    }
  }, "Aguardando aprova\xE7\xE3o"))), /*#__PURE__*/React.createElement(Card, {
    title: "Atalhos"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, [['ponto', 'Espelho de ponto'], ['ferias', 'Solicitar férias'], ['holerite', 'Holerites'], ['vagas', 'Vagas internas']].map(([k, l]) => /*#__PURE__*/React.createElement(Button, {
    key: l,
    variant: "secondary",
    onClick: () => ir(k),
    style: {
      padding: 10,
      fontSize: 13,
      fontWeight: 500,
      justifyContent: 'flex-start'
    }
  }, l)))))));
}
Object.assign(window, {
  DashFuncionario
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/DashFuncionario.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/DashGestor.jsx
try { (() => {
const {
  Card,
  StatCard,
  Button,
  Badge,
  ApprovalRow,
  PersonRow,
  AlertItem,
  Avatar
} = window.ComplianceHCMDesignSystem_dab0b1;
function DashGestor({
  pendencias,
  decidir,
  ir
}) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const h = new Date().getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const abertas = pendencias.filter(p => !p.status).length;
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "Dashboard Gestor",
    style: {
      animation: 'fadeIn .25s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: '-.02em'
    }
  }, saudacao, ", Ricardo"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--muted-foreground)',
      marginTop: 4
    }
  }, hoje, " \xB7 Equipe Tecnologia \xB7 18 pessoas")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Pend\xEAncias de aprova\xE7\xE3o",
    value: abertas,
    caption: "f\xE9rias, ponto e vagas"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Presentes hoje",
    value: "14",
    suffix: "/18",
    caption: "2 em f\xE9rias \xB7 1 ausente \xB7 1 home office"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Inconsist\xEAncias de ponto",
    value: "3",
    tone: "negative",
    caption: "nos \xFAltimos 7 dias"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Vagas abertas",
    value: "4",
    caption: "37 candidaturas ativas"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Pend\xEAncias de aprova\xE7\xE3o"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, pendencias.map((p, i) => /*#__PURE__*/React.createElement(ApprovalRow, {
    key: i,
    tag: /*#__PURE__*/React.createElement(Badge, {
      tone: window.tagTone[p.tipo]
    }, p.tipo),
    title: p.titulo,
    detail: p.detalhe,
    status: p.status,
    onApprove: () => decidir(i, 'Aprovada', 'Solicitação aprovada ✓'),
    onReject: () => decidir(i, 'Rejeitada', 'Solicitação rejeitada')
  })))), /*#__PURE__*/React.createElement(Card, {
    title: "Equipe hoje"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))',
      gap: '8px 20px'
    }
  }, window.equipeData.map(m => /*#__PURE__*/React.createElement(PersonRow, {
    key: m.nome,
    name: m.nome,
    role: m.cargo,
    status: m.status
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Alertas de ponto"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, window.alertasPonto.map(a => /*#__PURE__*/React.createElement(AlertItem, {
    key: a.nome,
    title: a.nome,
    description: a.motivo
  }))), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    fullWidth: true,
    onClick: () => ir('ponto'),
    style: {
      marginTop: 12,
      padding: 8,
      fontSize: 13,
      fontWeight: 500
    }
  }, "Revisar ajustes de ponto")), /*#__PURE__*/React.createElement(Card, {
    title: "Pessoas em destaque \xB7 Julho"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, window.destaques.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.nome,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: d.nome,
    size: 28
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500
    }
  }, d.nome), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted-foreground)'
    }
  }, d.motivo)))))))));
}
Object.assign(window, {
  DashGestor
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/DashGestor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/Ferias.jsx
try { (() => {
const {
  PageHeader,
  Card,
  Button,
  Badge,
  StatCard,
  ApprovalRow,
  Avatar,
  ProgressBar,
  Modal,
  Field,
  Input,
  Select,
  Textarea,
  Checkbox
} = window.ComplianceHCMDesignSystem_dab0b1;
function Ferias({
  isGestor,
  minhas,
  aprovacoes,
  decidirFerias,
  onSolicitar
}) {
  if (isGestor) {
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "F\xE9rias",
      style: {
        animation: 'fadeIn .25s ease'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      title: "F\xE9rias da equipe",
      subtitle: "Aprova\xE7\xF5es pendentes e escala dos pr\xF3ximos meses"
    }), /*#__PURE__*/React.createElement(Card, {
      title: "Aguardando sua aprova\xE7\xE3o",
      style: {
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, aprovacoes.map((f, i) => /*#__PURE__*/React.createElement(ApprovalRow, {
      key: i,
      rail: f.status ? 'done' : 'pending',
      leading: /*#__PURE__*/React.createElement(Avatar, {
        name: f.nome
      }),
      title: f.nome,
      detail: f.periodo + ' · ' + f.dias + ' dias · saldo ' + f.saldo,
      status: f.status,
      onApprove: () => decidirFerias(i, 'Aprovada', 'Férias aprovadas ✓'),
      onReject: () => decidirFerias(i, 'Rejeitada', 'Férias rejeitadas')
    })))), /*#__PURE__*/React.createElement(Card, {
      title: "Escala de f\xE9rias \xB7 pr\xF3ximos 90 dias"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, window.escalaData.map(e => /*#__PURE__*/React.createElement("div", {
      key: e.nome,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px 12px',
        fontSize: 14,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 150,
        fontWeight: 500
      }
    }, e.nome), /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--muted-foreground)',
        width: 150
      }
    }, e.periodo), /*#__PURE__*/React.createElement(ProgressBar, {
      value: e.len,
      offset: e.ini
    }))))));
  }
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "F\xE9rias",
    style: {
      animation: 'fadeIn .25s ease'
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Minhas f\xE9rias",
    subtitle: /*#__PURE__*/React.createElement(React.Fragment, null, "Saldo de 22 dias \xB7 per\xEDodo aquisitivo vence em ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: 'var(--accent-strong)',
        fontWeight: 700
      }
    }, "14/03/2027")),
    action: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      onClick: onSolicitar
    }, "Solicitar f\xE9rias")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    variant: "primary",
    label: "Saldo de f\xE9rias",
    value: "22 dias",
    caption: "vence em 14/03/2027 \xB7 22 de 30 dias"
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: 73,
    tone: "accent",
    on: "dark"
  })), /*#__PURE__*/React.createElement(StatCard, {
    label: "Dias j\xE1 gozados",
    value: "8",
    caption: "per\xEDodo 2025/2026"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Abono pecuni\xE1rio",
    value: "10 dias",
    caption: "dispon\xEDvel para venda"
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Minhas solicita\xE7\xF5es"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, minhas.map((f, i) => /*#__PURE__*/React.createElement(ApprovalRow, {
    key: i,
    rail: f.status === 'Aprovada' || f.status === 'Concluída' ? 'done' : 'pending',
    title: f.periodo,
    detail: f.dias + ' dias · solicitado em ' + f.solicitado,
    status: f.status
  })))));
}
function FeriasModal({
  onClose,
  onEnviar
}) {
  const [data, setData] = React.useState('');
  const [dias, setDias] = React.useState('15');
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Solicitar f\xE9rias",
    subtitle: "Saldo dispon\xEDvel: 22 dias",
    onClose: onClose,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => onEnviar(data, parseInt(dias, 10))
    }, "Enviar solicita\xE7\xE3o"))
  }, /*#__PURE__*/React.createElement(Field, {
    layout: "block",
    label: "Data de in\xEDcio",
    htmlFor: "dt-inicio"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "dt-inicio",
    type: "date",
    value: data,
    onChange: e => setData(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    layout: "block",
    label: "Quantidade de dias",
    htmlFor: "dias-sel"
  }, /*#__PURE__*/React.createElement("select", {
    id: "dias-sel",
    value: dias,
    onChange: e => setDias(e.target.value),
    style: {
      width: '100%',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '9px 12px',
      fontSize: 14,
      background: 'var(--card)',
      color: 'var(--foreground)'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "30"
  }, "30 dias"), /*#__PURE__*/React.createElement("option", {
    value: "20"
  }, "20 dias"), /*#__PURE__*/React.createElement("option", {
    value: "15"
  }, "15 dias"), /*#__PURE__*/React.createElement("option", {
    value: "10"
  }, "10 dias"), /*#__PURE__*/React.createElement("option", {
    value: "5"
  }, "5 dias"))), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Adiantar 13\xBA sal\xE1rio"
  }), /*#__PURE__*/React.createElement(Field, {
    layout: "block",
    label: "Observa\xE7\xF5es (opcional)",
    htmlFor: "obs"
  }, /*#__PURE__*/React.createElement(Textarea, {
    id: "obs",
    rows: 2
  })));
}
Object.assign(window, {
  Ferias,
  FeriasModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/Ferias.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/Holerites.jsx
try { (() => {
const {
  PageHeader,
  DataTable,
  Chip,
  Modal,
  Button
} = window.ComplianceHCMDesignSystem_dab0b1;
function Holerites({
  onAbrir
}) {
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "Holerite",
    style: {
      animation: 'fadeIn .25s ease'
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Holerites",
    subtitle: "Demonstrativos de pagamento \xB7 clique para ver o detalhe"
  }), /*#__PURE__*/React.createElement(DataTable, {
    minWidth: 560,
    rows: window.holeriteData,
    onRowClick: onAbrir,
    columns: [{
      key: 'mes',
      label: 'Competência',
      width: '1.4fr',
      style: {
        fontWeight: 600
      }
    }, {
      key: 'tipo',
      label: 'Tipo',
      render: r => /*#__PURE__*/React.createElement(Chip, null, r.tipo)
    }, {
      key: 'bruto',
      label: 'Bruto',
      style: {
        color: 'var(--secondary-foreground)'
      }
    }, {
      key: 'liquido',
      label: 'Líquido',
      style: {
        fontWeight: 600
      }
    }, {
      key: 'pago',
      label: 'Pagamento',
      width: '.8fr',
      style: {
        color: 'var(--muted-foreground)'
      }
    }]
  }));
}
function HoleriteModal({
  holerite,
  onClose,
  onBaixar
}) {
  if (!holerite) return null;
  const linha = (item, negativo) => /*#__PURE__*/React.createElement("div", {
    key: item.nome,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      padding: '7px 0',
      borderBottom: '1px solid var(--muted)',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, item.nome, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--primary-muted-foreground)',
      fontSize: 13
    }
  }, item.ref)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 500,
      color: negativo ? 'var(--danger)' : 'inherit'
    }
  }, negativo ? '− ' : '', item.valor));
  const eyebrow = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--muted-foreground)',
    textTransform: 'uppercase',
    letterSpacing: '.05em'
  };
  return /*#__PURE__*/React.createElement(Modal, {
    width: 560,
    closeButton: true,
    onClose: onClose,
    title: 'Holerite · ' + holerite.mes,
    subtitle: holerite.tipo + ' · pago em ' + holerite.pago + ' · Compliance HCM Ltda.',
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Fechar"), /*#__PURE__*/React.createElement(Button, {
      onClick: onBaixar
    }, "Baixar PDF"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...eyebrow,
      marginBottom: 8
    }
  }, "Proventos"), window.proventos.map(p => linha(p, false)), /*#__PURE__*/React.createElement("div", {
    style: {
      ...eyebrow,
      margin: '18px 0 8px'
    }
  }, "Descontos"), window.descontos.map(d => linha(d, true)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 16,
      padding: '14px 16px',
      background: 'var(--muted)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, "L\xEDquido a receber"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, holerite.liquido))));
}
Object.assign(window, {
  Holerites,
  HoleriteModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/Holerites.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/Login.jsx
try { (() => {
const {
  Input,
  Checkbox,
  Button,
  Icon
} = window.ComplianceHCMDesignSystem_dab0b1;
const loginStats = [{
  n: '+1.200',
  l: 'colaboradores ativos'
}, {
  n: '99,9%',
  l: 'de disponibilidade'
}, {
  n: 'ISO 27001',
  l: 'segurança certificada'
}];
function Login({
  onEntrar
}) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [ver, setVer] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const entrar = via => {
    if (via !== 'sso' && (!email.trim() || !senha)) {
      setErro('Informe seu e-mail (ou CPF) e senha.');
      return;
    }
    if (loading) return;
    setLoading(true);
    setTimeout(() => onEntrar(via === 'sso' ? 'Autenticado via SSO corporativo' : 'Bem-vindo(a) de volta!'), via === 'sso' ? 900 : 700);
  };
  const blob = {
    position: 'absolute',
    borderRadius: '50%',
    background: 'rgba(245,166,35,.08)',
    pointerEvents: 'none'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'flex-start',
      background: 'var(--background)',
      color: 'var(--foreground)',
      overflow: 'auto',
      animation: 'fadeIn .25s ease'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      overflow: 'hidden',
      flex: '0 0 46%',
      alignSelf: 'stretch',
      minHeight: '100vh',
      gap: 48,
      background: 'var(--primary)',
      color: 'var(--primary-foreground)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '56px clamp(28px,4vw,64px) 44px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...blob,
      top: -40,
      right: -70,
      width: 220,
      height: 220
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...blob,
      bottom: -110,
      left: -100,
      width: 290,
      height: 290
    }
  }), /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-compliance-branco.png",
    alt: "Compliance Solu\xE7\xF5es",
    style: {
      width: 238,
      height: 'auto',
      display: 'block',
      maxWidth: '100%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--primary-muted-foreground)'
    }
  }, "Portal do Trabalhador")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: 520
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 4,
      borderRadius: 999,
      background: 'var(--accent)',
      marginBottom: 28
    }
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 'clamp(30px,3.4vw,44px)',
      lineHeight: 1.1,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-h1)'
    }
  }, "Seu RH, resolvido em poucos cliques."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '22px 0 0',
      fontSize: 16,
      lineHeight: 1.55,
      color: 'var(--primary-muted-foreground)',
      maxWidth: 440,
      textWrap: 'pretty'
    }
  }, "F\xE9rias, ponto, holerites e vagas internas em um s\xF3 lugar \u2014 100% cloud, dispon\xEDvel quando voc\xEA precisar."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: 28,
      rowGap: 24,
      marginTop: 40
    }
  }, loginStats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.n,
    style: i ? {
      borderLeft: '1px solid var(--nav-border)',
      paddingLeft: 28
    } : null
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-h1)'
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--primary-muted-foreground)',
      marginTop: 4
    }
  }, s.l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      fontSize: 13,
      color: 'var(--nav-muted)'
    }
  }, "\xA9 2026 Compliance Solu\xE7\xF5es \xB7 Todos os direitos reservados")), /*#__PURE__*/React.createElement("section", {
    style: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'stretch',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(24px,4vw,48px) clamp(20px,4vw,40px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 440
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--accent-strong)'
    }
  }, "Bem-vindo de volta"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '12px 0 0',
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: 'var(--tracking-h1)',
      color: 'var(--heading)'
    }
  }, "Acesse sua conta"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      fontSize: 15,
      color: 'var(--muted-foreground)'
    }
  }, "Use seu e-mail corporativo para entrar no portal."), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--secondary-foreground)',
      margin: '30px 0 8px'
    }
  }, "E-mail corporativo"), /*#__PURE__*/React.createElement(Input, {
    placeholder: "nome@empresa.com.br",
    value: email,
    onChange: e => {
      setEmail(e.target.value);
      setErro(null);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 16,
      margin: '20px 0 8px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--secondary-foreground)'
    }
  }, "Senha"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--accent-strong)',
      textDecoration: 'none'
    }
  }, "Esqueci minha senha")), /*#__PURE__*/React.createElement(Input, {
    type: ver ? 'text' : 'password',
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    value: senha,
    onChange: e => {
      setSenha(e.target.value);
      setErro(null);
    },
    trailing: /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setVer(v => !v),
      title: ver ? 'Ocultar senha' : 'Mostrar senha',
      style: {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 6,
        color: 'var(--muted-foreground)',
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "olho",
      size: 16
    }))
  }), erro ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--danger-soft-fg)',
      background: 'var(--danger-soft-bg)',
      border: '1px solid var(--danger-soft-border)',
      borderRadius: 8,
      padding: '8px 12px',
      marginTop: 12
    }
  }, erro) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '20px 0 24px'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    label: "Manter conectado neste dispositivo",
    defaultChecked: true
  })), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    onClick: () => entrar('senha')
  }, loading ? 'Entrando…' : 'Entrar'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      margin: '24px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)'
    }
  }, "ou"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border)'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    fullWidth: true,
    onClick: () => entrar('sso'),
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "sso",
      size: 16
    })
  }, "Entrar com SSO da empresa"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '28px 0 0',
      fontSize: 14,
      color: 'var(--muted-foreground)'
    }
  }, "Primeiro acesso? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: 'var(--accent-strong)',
      fontWeight: 600,
      textDecoration: 'none'
    }
  }, "Ative sua conta"), " com o c\xF3digo enviado pelo RH."))));
}
Object.assign(window, {
  Login
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/Ponto.jsx
try { (() => {
const {
  PageHeader,
  Button,
  Card,
  DataTable,
  Badge,
  ApprovalRow
} = window.ComplianceHCMDesignSystem_dab0b1;
function Ponto({
  isGestor,
  clock,
  onRegistrar,
  ajustes,
  decidirAjuste
}) {
  const saldoStyle = s => ({
    color: s.startsWith('+') ? 'var(--success)' : s.startsWith('−') ? 'var(--danger)' : 'var(--muted-foreground)',
    fontWeight: 500
  });
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "Ponto",
    style: {
      animation: 'fadeIn .25s ease'
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Espelho de ponto",
    subtitle: "Julho de 2026 \xB7 fechamento em 31/07",
    action: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      onClick: onRegistrar
    }, "Registrar ponto \xB7 ", clock)
  }), /*#__PURE__*/React.createElement(DataTable, {
    style: {
      marginBottom: 20
    },
    minWidth: 660,
    rows: window.espelhoData,
    columns: [{
      key: 'data',
      label: 'Data',
      width: '1.1fr',
      style: {
        fontWeight: 500
      }
    }, {
      key: 'horas',
      label: 'Batidas',
      width: '1.8fr',
      style: {
        color: 'var(--secondary-foreground)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, {
      key: 'previsto',
      label: 'Previsto',
      width: '.7fr',
      style: {
        color: 'var(--muted-foreground)'
      }
    }, {
      key: 'realizado',
      label: 'Realizado',
      width: '.7fr'
    }, {
      key: 'saldo',
      label: 'Saldo',
      width: '.7fr',
      render: r => /*#__PURE__*/React.createElement("span", {
        style: saldoStyle(r.saldo)
      }, r.saldo)
    }, {
      key: 'st',
      label: 'Situação',
      width: '.9fr',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        status: r.ok ? 'OK' : 'Inconsistente'
      })
    }]
  }), isGestor ? /*#__PURE__*/React.createElement(Card, {
    title: "Ajustes de ponto da equipe"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, ajustes.map((a, i) => /*#__PURE__*/React.createElement(ApprovalRow, {
    key: i,
    title: a.nome,
    detail: a.detalhe,
    status: a.status,
    approveLabel: "Aprovar ajuste",
    onApprove: () => decidirAjuste(i, 'Aprovado', 'Ajuste de ponto aprovado ✓'),
    onReject: () => decidirAjuste(i, 'Rejeitado', 'Ajuste de ponto rejeitado')
  })))) : null);
}
Object.assign(window, {
  Ponto
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/Ponto.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/Portal.jsx
try { (() => {
const NS = window.ComplianceHCMDesignSystem_dab0b1;
const {
  Sidebar,
  AppHeader,
  NavItem,
  DropdownMenu,
  MenuSection,
  MenuItem,
  Avatar,
  Toast,
  NotificationItem,
  IconButton,
  BrandMark
} = NS;
const TEMAS = [{
  id: 'claro',
  label: 'Claro'
}, {
  id: 'escuro',
  label: 'Escuro'
}, {
  id: 'compliance-light',
  label: 'Compliance Light'
}, {
  id: 'alma-dark',
  label: 'Alma RH — Dark'
}, {
  id: 'netsuite-redwood',
  label: 'NetSuite Redwood'
}];
function Portal() {
  const [logado, setLogado] = React.useState(false);
  const [persona, setPersona] = React.useState('funcionario');
  const [screen, setScreen] = React.useState('dash');
  const [colapsada, setColapsada] = React.useState(false);
  const [layout, setLayout] = React.useState('sidebar');
  const [tema, setTema] = React.useState('claro');
  const [menu, setMenu] = React.useState(null); // 'user' | 'notif'
  const [modal, setModal] = React.useState(null);
  const [holerite, setHolerite] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [clock, setClock] = React.useState('');
  const [batidas, setBatidas] = React.useState([{
    t: '08:02',
    tipo: 'Entrada'
  }, {
    t: '12:01',
    tipo: 'Saída almoço'
  }, {
    t: '13:04',
    tipo: 'Retorno'
  }]);
  const [pendencias, setPendencias] = React.useState(window.pendenciasData);
  const [ajustes, setAjustes] = React.useState(window.ajustesData);
  const [feriasAprov, setFeriasAprov] = React.useState(window.feriasAprovData);
  const [minhasFerias, setMinhasFerias] = React.useState([{
    periodo: '10/08/2026 – 24/08/2026',
    dias: 15,
    solicitado: '12/07/2026',
    status: 'Aguardando aprovação'
  }, {
    periodo: '22/12/2025 – 31/12/2025',
    dias: 10,
    solicitado: '02/11/2025',
    status: 'Concluída'
  }]);
  const [reqs, setReqs] = React.useState(window.reqsData);
  const [aplicadas, setAplicadas] = React.useState({});
  const [notifs, setNotifs] = React.useState({
    funcionario: window.notifsFunc,
    gestor: window.notifsGestor
  });
  React.useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }));
    tick();
    const iv = setInterval(tick, 15000);
    return () => clearInterval(iv);
  }, []);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);
  const aviso = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };
  const isFunc = persona === 'funcionario';
  const isGestor = !isFunc;
  const abertas = pendencias.filter(p => !p.status).length;
  const nav = (isFunc ? window.navFuncionario : window.navGestor).map(n => n.key === 'dash' && isGestor ? {
    ...n,
    badge: abertas || false
  } : n);
  const titles = {
    dash: 'Visão geral',
    ponto: isFunc ? 'Meu ponto' : 'Ponto da equipe',
    holerite: 'Holerites',
    ferias: 'Férias',
    vagas: isFunc ? 'Vagas internas' : 'Requisições de vaga'
  };
  const lista = notifs[persona];
  const naoLidas = lista.filter(n => !n.lida).length || false;
  const user = isFunc ? {
    name: 'Mariana Alves',
    role: 'Analista de Marketing Pl'
  } : {
    name: 'Ricardo Teixeira',
    role: 'Gerente de Tecnologia'
  };
  const decidir = (setter, key) => (i, status, msg) => {
    setter(list => list.map((it, j) => j === i ? {
      ...it,
      status
    } : it));
    aviso(msg);
  };
  const registrarPonto = () => {
    const t = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    setBatidas(b => [...b, {
      t,
      tipo: b.length % 2 === 0 ? 'Entrada' : 'Saída'
    }]);
    aviso('Ponto registrado às ' + t + ' ✓');
  };
  const trocarPersona = p => {
    setPersona(p);
    setScreen('dash');
    setModal(null);
  };
  if (!logado) return /*#__PURE__*/React.createElement(window.Login, {
    onEntrar: msg => {
      setLogado(true);
      aviso(msg);
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--background)',
      color: 'var(--foreground)'
    }
  }, layout === 'sidebar' ? /*#__PURE__*/React.createElement(Sidebar, {
    items: nav,
    activeKey: screen,
    collapsed: colapsada,
    user: user,
    onSelect: setScreen,
    onUserClick: () => setMenu(m => m === 'user' ? null : 'user')
  }) : null, /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(AppHeader, {
    layout: layout,
    title: titles[screen],
    items: nav,
    activeKey: screen,
    onSelect: setScreen,
    onToggleNav: () => setColapsada(c => !c),
    persona: persona,
    onPersonaChange: trocarPersona,
    notificationCount: naoLidas,
    onNotifications: () => setMenu(m => m === 'notif' ? null : 'notif'),
    redwoodStripe: tema === 'netsuite-redwood',
    avatar: layout === 'topo' ? /*#__PURE__*/React.createElement("button", {
      onClick: () => setMenu(m => m === 'user' ? null : 'user'),
      "aria-label": "Menu do usu\xE1rio",
      style: {
        width: 34,
        height: 34,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--muted)',
        color: 'var(--secondary-foreground)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, user.name.split(' ').map(x => x[0]).join('')) : null
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'clamp(16px,3vw,28px)',
      maxWidth: 1180,
      width: '100%',
      boxSizing: 'border-box',
      margin: '0 auto'
    }
  }, screen === 'dash' && isFunc ? /*#__PURE__*/React.createElement(window.DashFuncionario, {
    clock: clock,
    batidas: batidas,
    onRegistrar: registrarPonto,
    ir: setScreen,
    abrirHolerite: () => setHolerite(window.holeriteData[0])
  }) : null, screen === 'dash' && isGestor ? /*#__PURE__*/React.createElement(window.DashGestor, {
    pendencias: pendencias,
    decidir: decidir(setPendencias),
    ir: setScreen
  }) : null, screen === 'ponto' ? /*#__PURE__*/React.createElement(window.Ponto, {
    isGestor: isGestor,
    clock: clock,
    onRegistrar: registrarPonto,
    ajustes: ajustes,
    decidirAjuste: decidir(setAjustes)
  }) : null, screen === 'holerite' ? /*#__PURE__*/React.createElement(window.Holerites, {
    onAbrir: setHolerite
  }) : null, screen === 'ferias' ? /*#__PURE__*/React.createElement(window.Ferias, {
    isGestor: isGestor,
    minhas: minhasFerias,
    aprovacoes: feriasAprov,
    decidirFerias: decidir(setFeriasAprov),
    onSolicitar: () => setModal('ferias')
  }) : null, screen === 'vagas' ? /*#__PURE__*/React.createElement(window.Vagas, {
    isGestor: isGestor,
    reqs: reqs,
    aplicadas: aplicadas,
    onNovaReq: () => setModal('vaga'),
    candidatar: id => {
      setAplicadas(a => ({
        ...a,
        [id]: true
      }));
      aviso('Candidatura enviada ao RH ✓');
    }
  }) : null)), /*#__PURE__*/React.createElement(window.HoleriteModal, {
    holerite: holerite,
    onClose: () => setHolerite(null),
    onBaixar: () => aviso('Download iniciado (demonstração)')
  }), modal === 'ferias' ? /*#__PURE__*/React.createElement(window.FeriasModal, {
    onClose: () => setModal(null),
    onEnviar: (raw, dias) => {
      let periodo = 'A definir';
      if (raw) {
        const d1 = new Date(raw + 'T12:00:00');
        const d2 = new Date(d1);
        d2.setDate(d2.getDate() + dias - 1);
        periodo = d1.toLocaleDateString('pt-BR') + ' – ' + d2.toLocaleDateString('pt-BR');
      }
      setMinhasFerias(l => [{
        periodo,
        dias,
        solicitado: new Date().toLocaleDateString('pt-BR'),
        status: 'Aguardando aprovação'
      }, ...l]);
      setModal(null);
      aviso('Solicitação de férias enviada ao gestor ✓');
    }
  }) : null, modal === 'vaga' ? /*#__PURE__*/React.createElement(window.VagaModal, {
    onClose: () => setModal(null),
    onCriar: (titulo, area) => {
      setReqs(l => [{
        id: 132,
        titulo,
        area,
        status: 'Em aprovação',
        cand: '—'
      }, ...l]);
      setModal(null);
      aviso('Requisição enviada para aprovação ✓');
    }
  }) : null, menu === 'notif' ? /*#__PURE__*/React.createElement(DropdownMenu, {
    width: 360,
    anchor: {
      right: 16,
      top: 60
    },
    onClose: () => setMenu(null),
    style: {
      padding: 0
    },
    header: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600
      }
    }, "Notifica\xE7\xF5es"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setNotifs(n => ({
        ...n,
        [persona]: n[persona].map(x => ({
          ...x,
          lida: true
        }))
      })),
      style: {
        border: 'none',
        background: 'none',
        fontSize: 13,
        color: 'var(--primary)',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
        padding: 0
      }
    }, "Marcar todas como lidas"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 380,
      overflowY: 'auto',
      margin: -6
    }
  }, lista.map((n, i) => /*#__PURE__*/React.createElement(NotificationItem, {
    key: i,
    title: n.titulo,
    text: n.texto,
    time: n.tempo,
    read: n.lida
  })))) : null, menu === 'user' ? /*#__PURE__*/React.createElement(DropdownMenu, {
    width: 220,
    onClose: () => setMenu(null),
    anchor: layout === 'topo' ? {
      right: 16,
      top: 60
    } : {
      left: colapsada ? 72 : 12,
      bottom: 60
    },
    header: /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600
      }
    }, user.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, user.role)),
    footer: /*#__PURE__*/React.createElement(MenuItem, {
      icon: "sair",
      label: "Sair",
      onClick: () => {
        setLogado(false);
        setMenu(null);
        setScreen('dash');
      }
    })
  }, /*#__PURE__*/React.createElement(MenuSection, {
    label: "Menu"
  }, /*#__PURE__*/React.createElement(MenuItem, {
    label: "Sidebar retr\xE1til",
    selected: layout === 'sidebar',
    onClick: () => setLayout('sidebar')
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: "Menu superior",
    selected: layout === 'topo',
    onClick: () => setLayout('topo')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      marginTop: 6,
      paddingTop: 4
    }
  }, /*#__PURE__*/React.createElement(MenuSection, {
    label: "Tema"
  }, TEMAS.map(t => /*#__PURE__*/React.createElement(MenuItem, {
    key: t.id,
    label: t.label,
    selected: t.id === tema,
    onClick: () => setTema(t.id)
  }))))) : null, /*#__PURE__*/React.createElement(Toast, {
    message: toast
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Portal, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/Portal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/Vagas.jsx
try { (() => {
const {
  PageHeader,
  Card,
  Button,
  Badge,
  Chip,
  DataTable,
  Modal,
  Field,
  Input,
  Select,
  Textarea
} = window.ComplianceHCMDesignSystem_dab0b1;
function Vagas({
  isGestor,
  reqs,
  aplicadas,
  candidatar,
  onNovaReq
}) {
  if (isGestor) {
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Vagas",
      style: {
        animation: 'fadeIn .25s ease'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      title: "Requisi\xE7\xF5es de vaga",
      subtitle: "Abertura e acompanhamento de vagas da sua \xE1rea",
      action: /*#__PURE__*/React.createElement(Button, {
        size: "lg",
        onClick: onNovaReq
      }, "Nova requisi\xE7\xE3o")
    }), /*#__PURE__*/React.createElement(DataTable, {
      minWidth: 560,
      rows: reqs,
      columns: [{
        key: 'id',
        label: 'Req.',
        width: '.6fr',
        style: {
          color: 'var(--muted-foreground)'
        },
        render: r => '#' + r.id
      }, {
        key: 'titulo',
        label: 'Cargo',
        width: '1.8fr',
        style: {
          fontWeight: 600
        }
      }, {
        key: 'area',
        label: 'Área',
        style: {
          color: 'var(--secondary-foreground)'
        }
      }, {
        key: 'status',
        label: 'Status',
        render: r => /*#__PURE__*/React.createElement(Badge, {
          tone: window.reqTone[r.status] || 'warning'
        }, r.status)
      }, {
        key: 'cand',
        label: 'Candidatos',
        width: '.8fr'
      }]
    }));
  }
  return /*#__PURE__*/React.createElement("section", {
    "data-screen-label": "Vagas",
    style: {
      animation: 'fadeIn .25s ease'
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Vagas internas",
    subtitle: "Oportunidades de movimenta\xE7\xE3o interna \xB7 candidatura confidencial"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
      gap: 16
    }
  }, window.vagasData.map(v => /*#__PURE__*/React.createElement(Card, {
    key: v.id,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, v.titulo), /*#__PURE__*/React.createElement(Chip, null, v.regime)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted-foreground)'
    }
  }, v.area, " \xB7 ", v.local), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'var(--secondary-foreground)',
      lineHeight: 1.5
    }
  }, v.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      paddingTop: 8
    }
  }, aplicadas[v.id] ? /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    style: {
      padding: '4px 12px',
      fontSize: 13
    }
  }, "Candidatura enviada \u2713") : /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => candidatar(v.id)
  }, "Candidatar-se"))))));
}
function VagaModal({
  onClose,
  onCriar
}) {
  const [titulo, setTitulo] = React.useState('');
  const [area, setArea] = React.useState('Tecnologia');
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Nova requisi\xE7\xE3o de vaga",
    subtitle: "Segue para aprova\xE7\xE3o do RH e da diretoria",
    onClose: onClose,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => onCriar(titulo || 'Nova vaga', area)
    }, "Enviar requisi\xE7\xE3o"))
  }, /*#__PURE__*/React.createElement(Field, {
    layout: "block",
    label: "Cargo",
    htmlFor: "vg-titulo"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "vg-titulo",
    value: titulo,
    onChange: e => setTitulo(e.target.value),
    placeholder: "Ex.: Analista de Dados Pleno"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Field, {
    layout: "block",
    label: "\xC1rea",
    htmlFor: "vg-area"
  }, /*#__PURE__*/React.createElement("select", {
    id: "vg-area",
    value: area,
    onChange: e => setArea(e.target.value),
    style: {
      width: '100%',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '9px 12px',
      fontSize: 14,
      background: 'var(--card)',
      color: 'var(--foreground)'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Tecnologia"), /*#__PURE__*/React.createElement("option", null, "Financeiro"), /*#__PURE__*/React.createElement("option", null, "Opera\xE7\xF5es"), /*#__PURE__*/React.createElement("option", null, "Comercial"))), /*#__PURE__*/React.createElement(Field, {
    layout: "block",
    label: "Motivo",
    htmlFor: "vg-motivo"
  }, /*#__PURE__*/React.createElement(Select, {
    id: "vg-motivo",
    options: ['Aumento de quadro', 'Substituição']
  }))), /*#__PURE__*/React.createElement(Field, {
    layout: "block",
    label: "Justificativa",
    htmlFor: "vg-just"
  }, /*#__PURE__*/React.createElement(Textarea, {
    id: "vg-just",
    rows: 3
  })));
}
Object.assign(window, {
  Vagas,
  VagaModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/Vagas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal-do-trabalhador/data.jsx
try { (() => {
// Mock data — copied from Portal do Trabalhador.dc.html.
const navFuncionario = [{
  key: 'dash',
  icon: 'dash',
  label: 'Início'
}, {
  key: 'ponto',
  icon: 'ponto',
  label: 'Meu ponto'
}, {
  key: 'holerite',
  icon: 'holerite',
  label: 'Holerites'
}, {
  key: 'ferias',
  icon: 'ferias',
  label: 'Minhas férias'
}, {
  key: 'vagas',
  icon: 'vagas',
  label: 'Vagas internas'
}];
const navGestor = [{
  key: 'dash',
  icon: 'dash',
  label: 'Início'
}, {
  key: 'ponto',
  icon: 'ponto',
  label: 'Ponto da equipe'
}, {
  key: 'holerite',
  icon: 'holerite',
  label: 'Meu holerite'
}, {
  key: 'ferias',
  icon: 'ferias',
  label: 'Férias da equipe'
}, {
  key: 'vagas',
  icon: 'vagas',
  label: 'Requisições de vaga'
}];
const holeriteData = [{
  mes: 'Junho 2026',
  tipo: 'Mensal',
  bruto: 'R$ 9.480,00',
  liquido: 'R$ 6.842,19',
  pago: '30/06/2026'
}, {
  mes: 'Maio 2026',
  tipo: 'Mensal',
  bruto: 'R$ 9.480,00',
  liquido: 'R$ 6.798,55',
  pago: '29/05/2026'
}, {
  mes: 'Abril 2026',
  tipo: 'Mensal',
  bruto: 'R$ 9.792,40',
  liquido: 'R$ 7.011,08',
  pago: '30/04/2026'
}, {
  mes: 'Março 2026',
  tipo: 'Mensal',
  bruto: 'R$ 9.480,00',
  liquido: 'R$ 6.842,19',
  pago: '31/03/2026'
}, {
  mes: 'Fevereiro 2026',
  tipo: 'Mensal',
  bruto: 'R$ 9.480,00',
  liquido: 'R$ 6.842,19',
  pago: '27/02/2026'
}, {
  mes: 'Dezembro 2025',
  tipo: '13º salário',
  bruto: 'R$ 9.480,00',
  liquido: 'R$ 7.914,30',
  pago: '18/12/2025'
}];
const proventos = [{
  nome: 'Salário base',
  ref: '30 dias',
  valor: 'R$ 8.900,00'
}, {
  nome: 'Horas extras 50%',
  ref: '6h',
  valor: 'R$ 364,00'
}, {
  nome: 'Adicional por tempo de serviço',
  ref: '2%',
  valor: 'R$ 216,00'
}];
const descontos = [{
  nome: 'INSS',
  ref: '14%',
  valor: 'R$ 951,62'
}, {
  nome: 'IRRF',
  ref: '22,5%',
  valor: 'R$ 1.186,19'
}, {
  nome: 'Vale-transporte',
  ref: '6%',
  valor: 'R$ 300,00'
}, {
  nome: 'Plano de saúde',
  ref: 'coparticipação',
  valor: 'R$ 200,00'
}];
const espelhoData = [{
  data: 'Seg, 21/07',
  horas: '08:01 · 12:03 · 13:00 · 17:58',
  previsto: '8h48',
  realizado: '8h58',
  saldo: '+0h10',
  ok: true
}, {
  data: 'Ter, 22/07',
  horas: '07:58 · 12:00 · — · 18:04',
  previsto: '8h48',
  realizado: '—',
  saldo: '—',
  ok: false
}, {
  data: 'Qua, 23/07',
  horas: '08:05 · 12:01 · 13:02 · 18:10',
  previsto: '8h48',
  realizado: '9h04',
  saldo: '+0h16',
  ok: true
}, {
  data: 'Qui, 24/07',
  horas: '08:00 · 12:02 · 13:00 · 17:45',
  previsto: '8h48',
  realizado: '8h31',
  saldo: '−0h17',
  ok: true
}, {
  data: 'Sex, 25/07',
  horas: '08:03 · 12:00 · 13:01 · 18:00',
  previsto: '8h48',
  realizado: '8h44',
  saldo: '−0h04',
  ok: true
}, {
  data: 'Seg, 28/07',
  horas: '08:02 · 12:01 · 13:04',
  previsto: '8h48',
  realizado: 'em andamento',
  saldo: '—',
  ok: true
}];
const equipeData = [{
  nome: 'Ana Souza',
  cargo: 'Dev Front-end Pl',
  status: 'Presente'
}, {
  nome: 'Carlos Lima',
  cargo: 'Dev Back-end Sr',
  status: 'Presente'
}, {
  nome: 'Juliana Prado',
  cargo: 'QA Pleno',
  status: 'Home office'
}, {
  nome: 'Diego Farias',
  cargo: 'DevOps Sr',
  status: 'Presente'
}, {
  nome: 'Beatriz Melo',
  cargo: 'Product Designer',
  status: 'Ausente'
}, {
  nome: 'Rafael Nunes',
  cargo: 'Dev Back-end Pl',
  status: 'Presente'
}, {
  nome: 'Larissa Costa',
  cargo: 'Dev Front-end Jr',
  status: 'Férias'
}, {
  nome: 'Pedro Ramos',
  cargo: 'Tech Lead',
  status: 'Férias'
}];
const escalaData = [{
  nome: 'Larissa Costa',
  periodo: '20/07 – 03/08',
  ini: 0,
  len: 32
}, {
  nome: 'Pedro Ramos',
  periodo: '27/07 – 10/08',
  ini: 16,
  len: 32
}, {
  nome: 'Ana Souza',
  periodo: '10/08 – 24/08',
  ini: 30,
  len: 32
}, {
  nome: 'Juliana Prado',
  periodo: '01/09 – 10/09',
  ini: 55,
  len: 22
}, {
  nome: 'Diego Farias',
  periodo: '14/09 – 28/09',
  ini: 70,
  len: 30
}];
const vagasData = [{
  id: 'v1',
  titulo: 'Desenvolvedor(a) Back-end Sr',
  area: 'Tecnologia',
  local: 'São Paulo · Híbrido',
  regime: 'CLT',
  desc: 'Plataforma de folha e integrações. Node.js, PostgreSQL e mensageria.'
}, {
  id: 'v2',
  titulo: 'Analista de DevOps',
  area: 'Tecnologia',
  local: 'Remoto',
  regime: 'CLT',
  desc: 'Esteiras CI/CD, observabilidade e infraestrutura como código.'
}, {
  id: 'v3',
  titulo: 'Analista de RH · DP',
  area: 'Pessoas & Cultura',
  local: 'São Paulo · Presencial',
  regime: 'CLT',
  desc: 'Rotinas de departamento pessoal, folha e atendimento ao colaborador.'
}, {
  id: 'v4',
  titulo: 'Coordenador(a) Financeiro',
  area: 'Financeiro',
  local: 'Campinas · Híbrido',
  regime: 'CLT',
  desc: 'Liderança do time de contas a pagar/receber e planejamento.'
}];
const reqsData = [{
  id: 131,
  titulo: 'Analista de Dados Pleno',
  area: 'Tecnologia',
  status: 'Em aprovação',
  cand: '—'
}, {
  id: 128,
  titulo: 'Desenvolvedor(a) Back-end Sr',
  area: 'Tecnologia',
  status: 'Divulgada',
  cand: 14
}, {
  id: 124,
  titulo: 'Analista de DevOps',
  area: 'Tecnologia',
  status: 'Divulgada',
  cand: 9
}, {
  id: 119,
  titulo: 'Tech Lead · Plataforma',
  area: 'Tecnologia',
  status: 'Em entrevistas',
  cand: 6
}, {
  id: 112,
  titulo: 'Estágio em QA',
  area: 'Tecnologia',
  status: 'Encerrada',
  cand: 41
}];
const avisos = [{
  titulo: 'Recadastramento do plano de saúde',
  data: '25/07',
  resumo: 'prazo até 08/08 no portal de benefícios'
}, {
  titulo: 'Feriado de 7 de setembro',
  data: '22/07',
  resumo: 'expediente encerra às 14h na sexta 04/09'
}, {
  titulo: 'Campanha de vacinação contra a gripe',
  data: '18/07',
  resumo: 'agendamento aberto para colaboradores e dependentes'
}];
const notifsFunc = [{
  titulo: 'Holerite de Junho disponível',
  texto: 'Seu demonstrativo de Junho/2026 já pode ser consultado.',
  tempo: 'há 2 horas',
  lida: false
}, {
  titulo: 'Inconsistência no ponto',
  texto: 'Batida de retorno ausente em 22/07. Solicite o ajuste no espelho de ponto.',
  tempo: 'há 1 dia',
  lida: false
}, {
  titulo: 'Recadastramento do plano de saúde',
  texto: 'O RH pede a atualização dos dados de dependentes até 08/08.',
  tempo: 'há 3 dias',
  lida: false
}, {
  titulo: 'Férias registradas',
  texto: 'Sua solicitação de 10/08 a 24/08 foi enviada ao gestor.',
  tempo: 'há 2 semanas',
  lida: true
}];
const notifsGestor = [{
  titulo: 'Nova solicitação de férias',
  texto: 'Ana Souza solicitou férias de 10/08 a 24/08 (15 dias).',
  tempo: 'há 40 min',
  lida: false
}, {
  titulo: 'Ajuste de ponto pendente',
  texto: 'Carlos Lima pediu inclusão de batida em 22/07.',
  tempo: 'há 3 horas',
  lida: false
}, {
  titulo: 'Requisição de vaga aprovada',
  texto: 'Req. #128 · Desenvolvedor(a) Back-end Sr foi aprovada pela diretoria.',
  tempo: 'há 1 dia',
  lida: false
}, {
  titulo: 'Fechamento da folha',
  texto: 'A competência 07/2026 fecha em 31/07. Revise as pendências da equipe.',
  tempo: 'há 2 dias',
  lida: false
}, {
  titulo: 'Aniversariante da equipe',
  texto: 'Larissa Costa faz aniversário em 30/07.',
  tempo: 'há 3 dias',
  lida: true
}];
const pendenciasData = [{
  tipo: 'Férias',
  titulo: 'Ana Souza',
  detalhe: '10/08 – 24/08 · 15 dias · saldo 22 dias',
  status: null
}, {
  tipo: 'Ponto',
  titulo: 'Carlos Lima',
  detalhe: 'Ajuste em 22/07 · esquecimento de batida (retorno do almoço)',
  status: null
}, {
  tipo: 'Vaga',
  titulo: 'Req. #128 · Analista de Dados Pl',
  detalhe: 'Aumento de quadro · aguardando sua aprovação',
  status: null
}, {
  tipo: 'Férias',
  titulo: 'Juliana Prado',
  detalhe: '01/09 – 10/09 · 10 dias · saldo 18 dias',
  status: null
}, {
  tipo: 'Ponto',
  titulo: 'Rafael Nunes',
  detalhe: 'Ajuste em 24/07 · marcação duplicada',
  status: null
}];
const ajustesData = [{
  nome: 'Carlos Lima',
  detalhe: '22/07 · incluir batida de retorno do almoço às 13:00',
  status: null
}, {
  nome: 'Rafael Nunes',
  detalhe: '24/07 · excluir marcação duplicada às 18:02',
  status: null
}, {
  nome: 'Beatriz Melo',
  detalhe: '25/07 · abono por consulta médica (atestado anexo)',
  status: null
}];
const feriasAprovData = [{
  nome: 'Ana Souza',
  periodo: '10/08 – 24/08',
  dias: 15,
  saldo: '22 dias',
  status: null
}, {
  nome: 'Juliana Prado',
  periodo: '01/09 – 10/09',
  dias: 10,
  saldo: '18 dias',
  status: null
}, {
  nome: 'Diego Farias',
  periodo: '14/09 – 28/09',
  dias: 15,
  saldo: '30 dias',
  status: null
}];
const alertasPonto = [{
  nome: 'Carlos Lima',
  motivo: 'Batida ausente em 22/07 — ajuste pendente'
}, {
  nome: 'Rafael Nunes',
  motivo: 'Marcação duplicada em 24/07'
}, {
  nome: 'Beatriz Melo',
  motivo: 'Sem registro hoje até 09:40'
}];
const destaques = [{
  nome: 'Larissa Costa',
  motivo: 'Aniversário · 30/07'
}, {
  nome: 'Diego Farias',
  motivo: 'Aniversário · 02/08'
}, {
  nome: 'Rafael Nunes',
  motivo: '2 anos de empresa · 15/07'
}];
const tagTone = {
  'Férias': 'info',
  'Ponto': 'warning',
  'Vaga': 'purple'
};
const reqTone = {
  'Em aprovação': 'warning',
  'Divulgada': 'info',
  'Em entrevistas': 'purple',
  'Encerrada': 'neutral'
};
Object.assign(window, {
  navFuncionario,
  navGestor,
  holeriteData,
  proventos,
  descontos,
  espelhoData,
  equipeData,
  escalaData,
  vagasData,
  reqsData,
  avisos,
  notifsFunc,
  notifsGestor,
  pendenciasData,
  ajustesData,
  feriasAprovData,
  alertasPonto,
  destaques,
  tagTone,
  reqTone
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal-do-trabalhador/data.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.BrandMark = __ds_scope.BrandMark;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.ApprovalRow = __ds_scope.ApprovalRow;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.PersonRow = __ds_scope.PersonRow;

__ds_ns.AlertItem = __ds_scope.AlertItem;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.NotificationItem = __ds_scope.NotificationItem;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.AppHeader = __ds_scope.AppHeader;

__ds_ns.DropdownMenu = __ds_scope.DropdownMenu;

__ds_ns.MenuSection = __ds_scope.MenuSection;

__ds_ns.MenuItem = __ds_scope.MenuItem;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Sidebar = __ds_scope.Sidebar;

})();
