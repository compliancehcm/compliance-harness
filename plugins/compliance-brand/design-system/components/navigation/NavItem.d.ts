export interface NavItemProps {
  /** Icon name from the Icon set. */
  icon: string;
  label: string;
  active?: boolean;
  /** Count pill pushed to the right (pendências). */
  badge?: number | false;
  /** sidebar (240px) · rail (64px collapsed) · top (horizontal bar) · drop (mobile menu) */
  variant?: 'sidebar' | 'rail' | 'top' | 'drop';
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function NavItem(props: NavItemProps): JSX.Element;
