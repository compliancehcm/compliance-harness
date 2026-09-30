/**
 * Text input.
 */
export interface InputProps {
  type?: string;
  placeholder?: string;
  /** Node pinned inside the right edge (password reveal button). */
  trailing?: React.ReactNode;
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  style?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
export declare const controlStyle: React.CSSProperties;
