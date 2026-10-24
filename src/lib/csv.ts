/**
 * Utilitas Parser CSV Sederhana & Mandiri (RFC 4180 compliant subset)
 */

export function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  const rawLines = text.split(/\r?\n/);

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;

    const row: string[] = [];
    let inQuotes = false;
    let field = '';

    // Deteksi pemisah (koma atau titik koma)
    const delimiter = rawLine.includes(';') && !rawLine.includes(',') ? ';' : ',';

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      const nextChar = rawLine[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          field += '"';
          i++; // Lewati quote escape
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    row.push(field.trim());
    lines.push(row);
  }

  return lines;
}
