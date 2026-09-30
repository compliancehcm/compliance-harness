/**
 * Centered dialog over a scrim.
 */
export interface ModalProps {
  open?: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 440 for forms, 560 for the holerite detail. */
  width?: number;
  onClose?: () => void;
  /** Right-aligned footer buttons: Cancelar (secondary) then the primary action. */
  footer?: React.ReactNode;
  /** Show the ✕ in the header (detail modals only). */
  closeButton?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Modal(props: ModalProps): JSX.Element | null;
