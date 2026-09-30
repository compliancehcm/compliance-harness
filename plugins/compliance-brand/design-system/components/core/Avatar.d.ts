export interface AvatarProps {
  /** Full name — initials are derived from it. */
  name?: string;
  /** Override the derived initials. */
  initials?: string;
  /** 28 in lists, 32 in the sidebar and approval rows. */
  size?: number;
  /** 'muted' on content surfaces, 'nav' inside the sidebar. */
  tone?: 'muted' | 'nav';
  style?: React.CSSProperties;
}
export declare function Avatar(props: AvatarProps): JSX.Element;
export declare function iniciais(nome: string): string;
