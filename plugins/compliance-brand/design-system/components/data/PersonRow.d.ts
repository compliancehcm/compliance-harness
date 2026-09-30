export interface PersonRowProps {
  name: string;
  role: string;
  /** Presente | Home office | Ausente | Férias — drives the dot colour. */
  status: string;
  style?: React.CSSProperties;
}
export declare function PersonRow(props: PersonRowProps): JSX.Element;
