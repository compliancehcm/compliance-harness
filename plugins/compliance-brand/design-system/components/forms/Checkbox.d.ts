export interface CheckboxProps {
  label?: React.ReactNode;
  /** sm = 13px label (login) · md = 14px (modals) */
  size?: 'sm' | 'md';
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  style?: React.CSSProperties;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
