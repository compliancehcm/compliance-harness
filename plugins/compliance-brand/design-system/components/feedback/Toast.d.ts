export interface ToastProps {
  /** Short pt-BR sentence, typically ending in ✓. Falsy renders nothing. */
  message?: string | null;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element | null;
