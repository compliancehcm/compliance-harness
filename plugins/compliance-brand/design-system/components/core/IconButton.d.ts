export interface IconButtonProps {
  /** Icon name, or a ReactNode for a custom glyph. */
  icon: string | React.ReactNode;
  /** Red count bubble at the top-right (notifications). */
  count?: number | false;
  /** Accessible label — also the tooltip. */
  label?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
