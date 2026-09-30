export interface ApprovalRowProps {
  /** Optional Avatar. */
  leading?: React.ReactNode;
  /** Optional type Badge (Férias / Ponto / Vaga). */
  tag?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  /** When set, the action pair is replaced by the status Badge. */
  status?: string | null;
  /** 3px colour rail on the left edge: pending (âmbar) · done (verde) · info (marinho) or a raw colour. */
  rail?: 'pending' | 'done' | 'info' | string;
  approveLabel?: string;
  rejectLabel?: string;
  onApprove?: () => void;
  onReject?: () => void;
  style?: React.CSSProperties;
}
export declare function ApprovalRow(props: ApprovalRowProps): JSX.Element;
