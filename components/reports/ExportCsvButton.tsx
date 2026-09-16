"use client";

import { DownloadIcon } from "@/components/ui/icons";
import { downloadCsv, toCsv } from "@/lib/csv";

interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => unknown;
}

export default function ExportCsvButton<T>({
  filename,
  rows,
  columns,
}: {
  filename: string;
  rows: T[];
  columns: ExportColumn<T>[];
}) {
  return (
    <button
      type="button"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, toCsv(rows, columns))}
      className="flex h-auto items-center gap-1.5 rounded-lg border border-hairline bg-surface-3 px-2.5 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-4 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      <DownloadIcon className="size-3.5" />
      Export CSV
    </button>
  );
}