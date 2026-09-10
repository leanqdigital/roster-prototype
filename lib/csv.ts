function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T>(
  rows: T[],
  columns: { header: string; accessor: (row: T) => unknown }[],
): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.accessor(row))).join(","),
  );
  return [headerLine, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Parse a CSV string into rows of objects keyed by header names. */
export function parseCsvRows(
  csv: string,
): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;

  // Parse CSV into 2D array of cells
  const grid: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some((c) => c.trim())) grid.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
  }
  // Flush last cell/row
  row.push(cell);
  if (row.some((c) => c.trim())) grid.push(row);

  if (grid.length === 0) return { headers: [], rows: [] };

  const headers = grid[0].map((h) =>
    h.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cells[j] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"');
    }
    rows.push(row);
  }
  return { headers, rows };
}
