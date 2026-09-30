export interface DropdownMenuProps {
  open?: boolean;
  onClose?: () => void;
  /** 220 for the user menu, 230 mobile nav, 360 notifications. */
  width?: number;
  /** Fixed-position anchor, e.g. {right:16, top:60}. */
  anchor?: React.CSSProperties;
  /** Scrim colour behind the popover — 'transparent' or rgba(0,0,0,.2). */
  scrim?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function DropdownMenu(props: DropdownMenuProps): JSX.Element | null;
