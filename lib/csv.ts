// lib/csv.ts
//
// RFC 4180-compliant CSV builder. Adds a UTF-8 BOM so Excel renders
// Urdu/Arabic text correctly (Excel assumes ANSI without the BOM).
// Uses CRLF line endings which is what Excel on Windows expects — the
// Mac/Linux Excel versions tolerate it too.

// Byte-order mark — invisible, helps Excel auto-detect UTF-8.
const BOM = "\uFEFF";
const CRLF = "\r\n";

// Escapes a single CSV cell. Fields containing a comma, quote, CR, or LF
// are wrapped in double quotes, and internal double quotes are doubled
// (per RFC 4180 §2.7).
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(
  headers: string[],
  rows: readonly (readonly (string | number | boolean | null | undefined)[])[]
): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return BOM + lines.join(CRLF) + CRLF;
}

// Wraps a CSV string in a download Response. `filename` should already
// include the .csv extension. Headers tell the browser to treat this as
// an attachment so it doesn't render in-place.
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Sanitizes a business name into a safe filename fragment. No path
// separators, no spaces, no shell-hostile characters.
export function slugifyForFilename(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "export";
}