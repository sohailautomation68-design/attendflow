/** Builds CSV text. Cells starting with = + - @ are prefixed with ' so spreadsheets do not run them as formulas. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
