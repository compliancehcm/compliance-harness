export interface BrandMarkProps {
  /** sm 28px · md 32px (sidebar/header) · lg 44px (login) */
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  title?: string;
  subtitle?: string | null;
  /** Stack the lockup vertically (login screen). */
  stacked?: boolean;
  /** 'nav' uses the --nav-badge-* slots. */
  tone?: 'primary' | 'nav';
  style?: React.CSSProperties;
}
export declare function BrandMark(props: BrandMarkProps): JSX.Element;
