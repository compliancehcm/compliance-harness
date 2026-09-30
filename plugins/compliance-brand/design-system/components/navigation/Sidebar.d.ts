/**
 * Collapsible product rail.
 */
export interface SidebarProps {
  items: Array<{ key: string; icon: string; label: string; badge?: number | false }>;
  activeKey?: string;
  collapsed?: boolean;
  user?: { name: string; role: string };
  onSelect?: (key: string) => void;
  onUserClick?: () => void;
  style?: React.CSSProperties;
}
export declare function Sidebar(props: SidebarProps): JSX.Element;
