/**
 * Primary action control.
 */
export interface ButtonProps {
  /** primary = solid --primary; secondary = bordered white; ghost = text only; onPrimary = white button on a --primary surface; link = underlined inline action */
  variant?: 'primary' | 'secondary' | 'ghost' | 'onPrimary' | 'link';
  /** sm 6/12 13px (row actions) · md 8/16 · lg 10/18 (page actions) · xl 11px full-width (login) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
