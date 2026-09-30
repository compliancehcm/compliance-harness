export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  /** 'stack' = label element wrapping the control (login) · 'block' = separate label above (modals) */
  layout?: 'stack' | 'block';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Field(props: FieldProps): JSX.Element;
