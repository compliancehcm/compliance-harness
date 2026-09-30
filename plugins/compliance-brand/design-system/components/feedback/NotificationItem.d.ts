export interface NotificationItemProps {
  title: string;
  text: string;
  /** Relative pt-BR time: "há 2 horas", "há 3 dias". */
  time: string;
  read?: boolean;
  style?: React.CSSProperties;
}
export declare function NotificationItem(props: NotificationItemProps): JSX.Element;
