/**
 * Grid-based table.
 */
export interface DataTableColumn {
  key: string;
  label: string;
  /** fr ratio for the grid track, e.g. '1.4fr'. */
  width?: string;
  style?: React.CSSProperties;
  render?: (row: any) => React.ReactNode;
}
export interface DataTableProps {
  columns: DataTableColumn[];
  rows: any[];
  /** Horizontal scroll floor — 560 for 5 columns, 660 for the espelho de ponto. */
  minWidth?: number;
  onRowClick?: (row: any) => void;
  style?: React.CSSProperties;
}
export declare function DataTable(props: DataTableProps): JSX.Element;
