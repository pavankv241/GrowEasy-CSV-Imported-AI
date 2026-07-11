"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  headers: string[];
  rows: Record<string, string>[];
  rowKey?: (index: number) => string | number;
  maxHeight?: string;
  emptyMessage?: string;
}

const INDEX_COL_WIDTH = 48;
const DEFAULT_COL_WIDTH = 140;

const WIDE_COLUMNS: Record<string, number> = {
  crm_note: 280,
  description: 200,
  email: 220,
  name: 160,
  company: 160,
  crm_status: 200,
  created_at: 180,
  lead_owner: 180,
};

function getColumnWidth(header: string): number {
  return WIDE_COLUMNS[header] ?? DEFAULT_COL_WIDTH;
}

export function DataTable({
  headers,
  rows,
  rowKey = (i) => i,
  maxHeight = "h-[480px]",
  emptyMessage = "No data to display",
}: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  const columnWidths = headers.map(getColumnWidth);
  const gridTemplate = `${INDEX_COL_WIDTH}px ${columnWidths.map((w) => `${w}px`).join(" ")}`;
  const tableWidth = INDEX_COL_WIDTH + columnWidths.reduce((sum, w) => sum + w, 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-700",
        maxHeight
      )}
    >
      <div ref={parentRef} className="h-full overflow-auto">
        <div style={{ width: tableWidth, minWidth: tableWidth }}>
          <div
            className="sticky top-0 z-10 grid border-b border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            style={{ gridTemplateColumns: gridTemplate, width: tableWidth }}
          >
            <div className="px-3 py-3">#</div>
            {headers.map((h) => (
              <div key={h} className="truncate px-3 py-3" title={h}>
                {h}
              </div>
            ))}
          </div>

          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
              width: tableWidth,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={rowKey(virtualRow.index)}
                  className="grid border-b border-zinc-100 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: tableWidth,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    gridTemplateColumns: gridTemplate,
                  }}
                >
                  <div className="flex items-center px-3 text-xs text-zinc-400">
                    {virtualRow.index + 1}
                  </div>
                  {headers.map((header) => (
                    <div
                      key={header}
                      className={cn(
                        "flex items-center px-3 text-zinc-700 dark:text-zinc-300",
                        header === "crm_note" || header === "description"
                          ? "line-clamp-2 whitespace-normal text-xs leading-snug"
                          : "truncate"
                      )}
                      title={row[header] ?? ""}
                    >
                      {row[header] ?? ""}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
