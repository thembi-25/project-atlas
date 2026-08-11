/**
 * Synchronous CSV serialization — reporting-prd.md §7/§9, scoped down per
 * docs/13-roadmap/sprint-7.md's "Scope decisions" to synchronous export
 * of existing list endpoints only (no `export_jobs` async queue, no PDF
 * generation). RFC 4180: fields containing a comma, double quote, or
 * newline are wrapped in double quotes with embedded quotes doubled;
 * every row ends `\r\n`.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string;
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((column) => escapeCsvField(column.header)).join(',');
  const dataLines = rows.map((row) => columns.map((column) => escapeCsvField(column.value(row))).join(','));
  return [headerLine, ...dataLines].map((line) => `${line}\r\n`).join('');
}
