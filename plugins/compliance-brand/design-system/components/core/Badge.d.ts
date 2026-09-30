export interface BadgeProps {
  /** Explicit tone. Ignored when `status` is given. */
  tone?: 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'neutral';
  /** pt-BR status string — mapped automatically (Aprovada/Concluída/OK → success, Rejeitada/Inconsistente → danger, anything else → warning). */
  status?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
export declare function toneForStatus(status: string): string;
