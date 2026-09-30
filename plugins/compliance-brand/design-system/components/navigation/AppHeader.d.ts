export interface AppHeaderProps {
  /** 'sidebar' shows the collapse toggle + screen title; 'topo' shows the lockup + horizontal nav. */
  layout?: 'sidebar' | 'topo';
  title?: string;
  items?: Array<{ key: string; icon: string; label: string }>;
  activeKey?: string;
  onSelect?: (key: string) => void;
  onToggleNav?: () => void;
  /** Renders the "Visualizar como" persona switch when set. */
  persona?: string;
  onPersonaChange?: (value: string) => void;
  notificationCount?: number | false;
  onNotifications?: () => void;
  avatar?: React.ReactNode;
  /** Redwood theme only: the 8px decorative stripe above the header. */
  redwoodStripe?: boolean;
  /** Path to the 8px stripe artwork, relative to the page. Default `assets/redwood-stripe.svg`. */
  stripeAsset?: string;
  style?: React.CSSProperties;
}
export declare function AppHeader(props: AppHeaderProps): JSX.Element;
