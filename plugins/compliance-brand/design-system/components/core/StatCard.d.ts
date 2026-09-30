export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Small muted continuation of the number, e.g. "/18". */
  suffix?: React.ReactNode;
  caption?: string;
  action?: React.ReactNode;
  /** Colours the number green or red (default variant only). */
  tone?: 'positive' | 'negative';
  /** default = white tile · primary = navy filled highlight tile (use once per strip). */
  variant?: 'default' | 'primary';
  /** md = 16px padding / 26px number (KPI strip) · lg = 20px / 28px (sidebar cards) */
  size?: 'md' | 'lg';
  /** Slot between number and caption — a ProgressBar in the highlight tile. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function StatCard(props: StatCardProps): JSX.Element;
