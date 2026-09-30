/**
 * Standard content container.
 */
export interface CardProps {
  /** 14px/600 title rendered with 12px of space below. */
  title?: React.ReactNode;
  /** Right-aligned action, usually a link Button. */
  action?: React.ReactNode;
  /** 20 on content cards, 16 on compact KPI tiles, 24 on the punch-clock hero. */
  padding?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
