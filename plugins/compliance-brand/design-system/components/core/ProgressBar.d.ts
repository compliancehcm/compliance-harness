export interface ProgressBarProps {
  /** Bar length as a percentage of the track. */
  value?: number;
  /** Left offset as a percentage — used to place a period on a timeline. */
  offset?: number;
  /** Bar colour. accent = âmbar (saldo/destaque). */
  tone?: 'primary' | 'accent' | 'success' | 'danger';
  /** dark = translucent white track, for use on primary/navy surfaces. */
  on?: 'light' | 'dark';
  style?: React.CSSProperties;
}
export declare function ProgressBar(props: ProgressBarProps): JSX.Element;
