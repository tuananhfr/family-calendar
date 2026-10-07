import type { ReactNode } from "react";
import { cn } from "../cn";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Hidden header text for icon-only/action columns. */
  srOnlyHeader?: boolean;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  mobileCard: (row: T) => ReactNode;
  /** Table scrolls sideways below this width instead of squeezing tags into "C…". */
  minWidth?: string;
  /** Wide rows (many fixed-size tags) read better as cards up to "lg" than as a squeezed table. */
  stackBelow?: "md" | "lg";
  className?: string;
}

const STACK = { md: { table: "hidden md:block", cards: "md:hidden" }, lg: { table: "hidden lg:block", cards: "md:grid md:grid-cols-2 lg:hidden" } } as const;

/** Table from `stackBelow` up (768px by default), stacked cards below; both are plain markup so no layout shift on resize. */
export function DataTable<T>({ caption, columns, rows, rowKey, empty, mobileCard, minWidth = "56rem", stackBelow = "md", className }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("overflow-x-auto", STACK[stackBelow].table)}>
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("border-b border-border px-3 py-2.5 text-left text-xs font-semibold text-muted", c.className)}>
                  <span className={c.srOnlyHeader ? "sr-only" : undefined}>{c.header}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-surface-2">
                {columns.map((c) => (
                  <td key={c.key} className={cn("min-w-0 border-b border-border px-3 py-2.5 align-middle text-body", c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={caption} className={cn("flex flex-col gap-2", STACK[stackBelow].cards)}>
        {rows.map((r) => (
          <li key={rowKey(r)} className="min-w-0 rounded-control border border-border bg-surface p-3">
            {mobileCard(r)}
          </li>
        ))}
      </ul>
    </div>
  );
}
