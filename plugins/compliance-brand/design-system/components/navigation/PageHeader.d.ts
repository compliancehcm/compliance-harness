export interface PageHeaderProps {
  title: string;
  /** 18px muted line on inner screens; 14px date line on dashboards. */
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** dash = 24px title · inner = 22px title */
  size?: 'dash' | 'inner';
  style?: React.CSSProperties;
}
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
