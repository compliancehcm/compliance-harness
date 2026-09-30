export interface SelectProps {
  /** Strings or {value,label} pairs. */
  options?: Array<string | { value: string; label: string }>;
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  style?: React.CSSProperties;
}
export declare function Select(props: SelectProps): JSX.Element;
