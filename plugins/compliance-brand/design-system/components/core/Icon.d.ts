/** Stroke icon from the Portal's Lucide-geometry set. */
export interface IconProps {
  /** dash | ponto | holerite | ferias | vagas | olho | painel | menu | sino | check | sair | sso */
  name: string;
  /** Rendered box in px. 16 in the sidebar, 15 in the top nav and dropdowns, 14 in menus. */
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
export declare const iconPaths: Record<string, string[]>;
