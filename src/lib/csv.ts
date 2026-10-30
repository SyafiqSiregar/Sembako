import { parseRupiah } from '@/domain/money';

export interface TemplateColumnSpec {
  key: string;
  group: 'identitas' | 'eceran' | 'grosir' | 'stok';
  label: string;
  csvShortLabel: string;
  required: boolean;
  hint: string;
  example: string;
  widthPx: number;
  isTextFormat?: boolean;
}

export interface ParsedProductRow {
  rowNumber: number;
  name: string;
  categoryName: string;
  unitName: string;
  price: number;
  cost: number;
  barcode?: string;
  hasWholesale: boolean;
  wholesaleUnitName?: string;
  wholesaleFactor?: number;
  wholesalePrice?: number;
  wholesaleBarcode?: string;
  minStock: number;
  trackExpiry: boolean;
  initialStock?: number;
  initialExpiryDate?: string;
  isValid: boolean;
  errorReason?: string;
}

export const TEMPLATE_COLUMNS: TemplateColumnSpec[] = [
  {
    key: 'nama_barang',
    group: 'identitas',
    label: 'Nama Barang *',
    csvShortLabel: 'Nama Brg*',
    required: true,
    hint: 'Nama lengkap & ukuran kemasan',
    example: 'Indomie Goreng Spesial 85g',
    widthPx: 230,
  },
  {
    key: 'kategori',
    group: 'identitas',
    label: 'Kategori',
    csvShortLabel: 'Kategori',
    required: false,
    hint: 'Otomatis dibuat jika belum ada',
    example: 'Mie & Makanan Instan',
    widthPx: 170,
  },
  {
    key: 'satuan_eceran',
    group: 'eceran',
    label: 'Satuan Eceran *',
    csvShortLabel: 'Satuan*',
    required: true,
    hint: 'Bungkus / Pcs / Botol / Kg / Sak',
    example: 'Bungkus',
    widthPx: 130,
  },
  {
    key: 'harga_modal_eceran',
    group: 'eceran',
    label: 'Harga Modal Eceran (Rp) *',
    csvShortLabel: 'Modal (Rp)*',
    required: true,
    hint: 'Angka saja, modal per 1 eceran',
    example: '3000',
    widthPx: 165,
  },
  {
    key: 'harga_jual_eceran',
    group: 'eceran',
    label: 'Harga Jual Eceran (Rp) *',
    csvShortLabel: 'Jual (Rp)*',
    required: true,
    hint: 'Angka saja, jual per 1 eceran',
    example: '3500',
    widthPx: 165,
  },
  {
    key: 'barcode_eceran',
    group: 'eceran',
    label: 'Barcode Eceran',
    csvShortLabel: 'Barcode',
    required: false,
    hint: 'Kode angka barcode satuan',
    example: '089686010018',
    widthPx: 155,
    isTextFormat: true,
  },
  {
    key: 'satuan_grosir',
    group: 'grosir',
    label: 'Satuan Grosir',
    csvShortLabel: 'Sat Grosir',
    required: false,
    hint: 'Dus / Karton / Renceng / Pak',
    example: 'Dus',
    widthPx: 125,
  },
  {
    key: 'isi_per_dus_grosir',
    group: 'grosir',
    label: 'Isi per Grosir',
    csvShortLabel: 'Isi Grosir',
    required: false,
    hint: 'Jumlah eceran dalam 1 dus',
    example: '40',
    widthPx: 130,
  },
  {
    key: 'harga_jual_grosir',
    group: 'grosir',
    label: 'Harga Jual Grosir (Rp)',
    csvShortLabel: 'Hrg Grosir',
    required: false,
    hint: 'Harga jual 1 dus/grosir utuh',
    example: '130000',
    widthPx: 165,
  },
  {
    key: 'barcode_grosir',
    group: 'grosir',
    label: 'Barcode Grosir',
    csvShortLabel: 'BC Grosir',
    required: false,
    hint: 'Barcode khusus di luar kardus',
    example: '089686010025',
    widthPx: 155,
    isTextFormat: true,
  },
  {
    key: 'stok_minimal',
    group: 'stok',
    label: 'Batas Stok Tipis',
    csvShortLabel: 'Min Stok',
    required: false,
    hint: 'Peringatan stok tipis (eceran)',
    example: '40',
    widthPx: 135,
  },
  {
    key: 'lacak_kedaluwarsa',
    group: 'stok',
    label: 'Lacak Kedaluwarsa?',
    csvShortLabel: 'Lacak ED',
    required: false,
    hint: 'Isi: Ya atau Tidak',
    example: 'Ya',
    widthPx: 140,
  },
  {
    key: 'stok_awal',
    group: 'stok',
    label: 'Stok Awal (Eceran)',
    csvShortLabel: 'Stok Awal',
    required: false,
    hint: 'Stok fisik saat ini (eceran)',
    example: '120',
    widthPx: 140,
  },
  {
    key: 'tanggal_kedaluwarsa',
    group: 'stok',
    label: 'Tanggal Kedaluwarsa',
    csvShortLabel: 'Tgl Kedaluwarsa (YYYY-MM-DD)',
    required: false,
    hint: 'YYYY-MM-DD (jika Lacak=Ya)',
    example: '2027-01-15',
    widthPx: 165,
    isTextFormat: true,
  },
];

export const SAMPLE_TEMPLATE_ROWS: string[][] = [
  [
    'Indomie Goreng Spesial 85g',
    'Mie & Makanan Instan',
    'Bungkus',
    '3000',
    '3500',
    '089686010018',
    'Dus',
    '40',
    '130000',
    '089686010025',
    '40',
    'Ya',
    '120',
    '2027-01-15',
  ],
  [
    'Minyak Goreng Bimoli 2L',
    'Minyak & Margarin',
    'Pouch',
    '32000',
    '36000',
    '8992223334445',
    'Dus',
    '6',
    '210000',
    '8992223334452',
    '6',
    'Ya',
    '24',
    '2026-12-30',
  ],
  [
    'Beras Rojo Lele 5kg',
    'Beras & Biji',
    'Sak',
    '70000',
    '78000',
    '8991112223334',
    '',
    '',
    '',
    '',
    '5',
    'Tidak',
    '20',
    '',
  ],
];

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseHtmlTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1] || '';
    const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const row: string[] = [];
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(trContent)) !== null) {
      const rawCell = (cellMatch[1] || '').replace(/<[^>]+>/g, '');
      row.push(decodeHtmlEntities(rawCell).trim());
    }

    if (row.some((c) => c.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function detectDelimiter(lines: string[]): '\t' | ';' | ',' {
  const sampleLine = lines.find((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !/^sep=.;?\s*$/i.test(trimmed);
  });

  if (!sampleLine) return ',';

  let inQuotes = false;
  let tabCount = 0;
  let semiCount = 0;
  let commaCount = 0;

  for (let i = 0; i < sampleLine.length; i++) {
    const ch = sampleLine[i];
    if (ch === '"') {
      if (inQuotes && sampleLine[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes) {
      if (ch === '\t') tabCount++;
      else if (ch === ';') semiCount++;
      else if (ch === ',') commaCount++;
    }
  }

  if (tabCount > 0 && tabCount >= semiCount && tabCount >= commaCount) return '\t';
  if (semiCount > 0 && semiCount >= commaCount) return ';';
  return ',';
}

/**
 * Parser CSV / TSV / Tabel Excel HTML yang mendukung koma (,), titik koma (;),
 * Tab (\t hasil copy-paste langsung dari Excel), dan tabel .xls.
 */
export function parseCsv(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  if (/<table\b/i.test(cleaned) && /<tr\b/i.test(cleaned)) {
    return parseHtmlTableRows(cleaned);
  }

  const rawLines = cleaned.split(/\r?\n/);
  const delimiter = detectDelimiter(rawLines);
  const lines: string[][] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed || /^sep=.;?\s*$/i.test(trimmed)) continue;

    const row: string[] = [];
    let inQuotes = false;
    let field = '';

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      const nextChar = rawLine[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          field += '"';
          i++;
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

    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

export function sanitizeBarcodeCell(raw: string | undefined): string {
  if (!raw) return '';
  let val = raw.trim();
  // Bersihkan pembungkus rumus teks Excel ="089686010018" atau kutip tunggal '089686010018
  const excelFormulaMatch = /^="?([^"]+)"?$/.exec(val);
  if (excelFormulaMatch?.[1]) {
    val = excelFormulaMatch[1].trim();
  }
  if (val.startsWith("'")) {
    val = val.slice(1).trim();
  }
  return val;
}

export function isCorruptedScientificBarcode(barcode: string): boolean {
  if (!barcode) return false;
  return /^\d+[.,]\d+e[+-]?\d+$/i.test(barcode.trim());
}

export function isHeaderOrInstructionRow(cols: string[]): boolean {
  const first = (cols[0] || '').trim().toLowerCase();
  const fourth = (cols[3] || '').trim().toLowerCase();
  const fifth = (cols[4] || '').trim().toLowerCase();

  if (!cols.some((c) => c.trim().length > 0)) return true;

  if (
    first.startsWith('#') ||
    first === 'nama_barang' ||
    first === 'nama barang' ||
    first === 'nama barang *' ||
    first === 'nama brg*' ||
    first === 'nama brg *' ||
    first.startsWith('nama lengkap') ||
    first.startsWith('wajib diisi') ||
    first.startsWith('petunjuk') ||
    first.startsWith('template katalog') ||
    first.startsWith('a. identitas') ||
    first.startsWith('identitas barang')
  ) {
    return true;
  }

  if (
    fourth.includes('harga_modal') ||
    fourth.includes('harga modal') ||
    fourth.includes('modal (rp)') ||
    fourth.includes('angka saja') ||
    fifth.includes('harga_jual') ||
    fifth.includes('harga jual') ||
    fifth.includes('jual (rp)')
  ) {
    return true;
  }

  return false;
}

/**
 * Mengurai teks CSV / TSV / Excel menjadi daftar baris produk siap impor beserta status validasinya.
 */
export function parseCatalogImportText(text: string): ParsedProductRow[] {
  const allRows = parseCsv(text);
  if (allRows.length === 0) return [];

  const dataRows: Array<{ cols: string[]; rowNumber: number }> = [];
  allRows.forEach((cols, idx) => {
    if (!isHeaderOrInstructionRow(cols)) {
      dataRows.push({ cols, rowNumber: idx + 1 });
    }
  });

  const seenBarcodes = new Set<string>();

  return dataRows.map(({ cols, rowNumber }) => {
    const name = (cols[0] || '').trim();
    const categoryName = (cols[1] || '').trim();
    const unitName = (cols[2] || '').trim() || 'Pcs';
    const cost = parseRupiah(cols[3] || '0');
    const price = parseRupiah(cols[4] || '0');
    const barcode = sanitizeBarcodeCell(cols[5]);

    const wholesaleUnitName = (cols[6] || '').trim();
    const wholesaleFactor = parseInt((cols[7] || '0').replace(/[^\d-]/g, ''), 10) || 0;
    const wholesalePrice = parseRupiah(cols[8] || '0');
    const wholesaleBarcode = sanitizeBarcodeCell(cols[9]);

    const isLegacy9Col = cols.length <= 9;
    const hasAnyWholesaleInput =
      !isLegacy9Col &&
      Boolean(wholesaleUnitName || wholesaleFactor > 0 || wholesalePrice > 0 || wholesaleBarcode);
    const hasWholesale =
      !isLegacy9Col && Boolean(wholesaleUnitName && wholesaleFactor > 1 && wholesalePrice > 0);

    const rawMinStock = isLegacy9Col ? cols[7] : cols[10];
    const minStock = parseInt((rawMinStock || '5').replace(/[^\d-]/g, ''), 10) || 5;

    const expiryCol = ((isLegacy9Col ? cols[8] : cols[11]) || '').trim().toLowerCase();
    const trackExpiry =
      expiryCol === 'ya' || expiryCol === 'y' || expiryCol === '1' || expiryCol === 'true';

    const initialStock = isLegacy9Col
      ? 0
      : parseInt((cols[12] || '0').replace(/[^\d-]/g, ''), 10) || 0;
    const initialExpiryDate = isLegacy9Col
      ? undefined
      : sanitizeBarcodeCell(cols[13]) || undefined;

    let isValid = true;
    let errorReason: string | undefined;

    if (!name) {
      isValid = false;
      errorReason = 'Nama barang wajib diisi';
    } else if (price <= 0) {
      isValid = false;
      errorReason = 'Harga jual eceran harus lebih dari Rp 0';
    } else if (cost < 0) {
      isValid = false;
      errorReason = 'Harga modal tidak boleh negatif';
    } else if (cost > price) {
      isValid = false;
      errorReason = 'Harga jual eceran lebih rendah dari modal';
    } else if (isCorruptedScientificBarcode(barcode)) {
      isValid = false;
      errorReason = 'Barcode eceran rusak oleh Excel (notasi E+). Gunakan Template Excel (.xls)';
    } else if (isCorruptedScientificBarcode(wholesaleBarcode)) {
      isValid = false;
      errorReason = 'Barcode grosir rusak oleh Excel (notasi E+). Gunakan Template Excel (.xls)';
    } else if (hasAnyWholesaleInput && !hasWholesale) {
      isValid = false;
      errorReason = 'Kolom grosir belum lengkap (isi satuan, isi > 1, & harga grosir)';
    } else if (barcode && wholesaleBarcode && barcode === wholesaleBarcode) {
      isValid = false;
      errorReason = 'Barcode eceran dan barcode grosir tidak boleh sama';
    } else if (trackExpiry && initialStock > 0 && !initialExpiryDate) {
      isValid = false;
      errorReason = 'Tanggal kedaluwarsa wajib diisi jika stok awal > 0';
    } else if (initialExpiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(initialExpiryDate)) {
      isValid = false;
      errorReason = 'Format tanggal harus YYYY-MM-DD (contoh: 2027-01-15)';
    }

    if (isValid && barcode) {
      if (seenBarcodes.has(barcode)) {
        isValid = false;
        errorReason = `Barcode eceran (${barcode}) ganda di dalam file ini`;
      } else {
        seenBarcodes.add(barcode);
      }
    }

    if (isValid && hasWholesale && wholesaleBarcode) {
      if (seenBarcodes.has(wholesaleBarcode)) {
        isValid = false;
        errorReason = `Barcode grosir (${wholesaleBarcode}) ganda di dalam file ini`;
      } else {
        seenBarcodes.add(wholesaleBarcode);
      }
    }

    return {
      rowNumber,
      name,
      categoryName,
      unitName,
      price,
      cost,
      barcode: barcode || undefined,
      hasWholesale,
      wholesaleUnitName: hasWholesale ? wholesaleUnitName : undefined,
      wholesaleFactor: hasWholesale ? wholesaleFactor : undefined,
      wholesalePrice: hasWholesale ? wholesalePrice : undefined,
      wholesaleBarcode: hasWholesale ? wholesaleBarcode || undefined : undefined,
      minStock,
      trackExpiry,
      initialStock: initialStock > 0 ? initialStock : undefined,
      initialExpiryDate,
      isValid,
      errorReason,
    };
  });
}

/**
 * Menghasilkan teks CSV rapi berpemisah titik koma (;) untuk Excel Indonesia.
 * Menggunakan label ringkas (<= 10 karakter) agar tidak terpotong oleh lebar kolom default CSV Excel,
 * serta membungkus barcode & tanggal dengan ="..." agar tidak muncul ######## atau notasi ilmiah E+.
 */
export function generateCsvTemplateText(): string {
  const headers = TEMPLATE_COLUMNS.map((c) => c.csvShortLabel).join(';');
  const sampleLines = SAMPLE_TEMPLATE_ROWS.map((row) =>
    row
      .map((val, idx) => {
        const col = TEMPLATE_COLUMNS[idx];
        if (col?.isTextFormat && val) {
          return `="${val}"`;
        }
        return val;
      })
      .join(';')
  );
  const footerNote =
    '# TIPS EXCEL: Kolom bertanda (*) wajib diisi. Untuk melebarkan kolom di CSV, tekan Ctrl+A lalu klik 2x batas judul kolom atas (atau gunakan tombol Unduh Template Excel .xls di aplikasi agar tabel otomatis lebar & berwarna).';

  return [headers, ...sampleLines, '', footerNote].join('\r\n');
}

/**
 * Menghasilkan teks TSV (Tab-Separated) contoh untuk simulasi langsung di textarea.
 */
export function generateTsvSampleText(): string {
  const headers = TEMPLATE_COLUMNS.map((c) => c.label).join('\t');
  const rows = SAMPLE_TEMPLATE_ROWS.map((r) => r.join('\t'));
  return [headers, ...rows].join('\n');
}

/**
 * Menghasilkan dokumen Spreadsheet HTML (.xls) yang langsung terbuka rapi di Microsoft Excel
 * dengan kelompok kolom berwarna, lebar kolom terkunci proporsional (mso-width-source:userset),
 * serta sel barcode & tanggal berformat Teks (@) agar bebas dari ######## dan notasi E+.
 */
export function generateExcelTemplateHtml(): string {
  const colgroup = TEMPLATE_COLUMNS.map(
    (c) => `<col width="${c.widthPx}" style="mso-width-source:userset;width:${c.widthPx}px;" />`
  ).join('');

  const headerCells = TEMPLATE_COLUMNS.map((c) => {
    const bg =
      c.group === 'identitas' || c.group === 'eceran'
        ? '#14463C'
        : c.group === 'grosir'
          ? '#1F5C8A'
          : '#8A5300';
    return `<th width="${c.widthPx}" style="width:${c.widthPx}px;background:${bg};color:#FFFFFF;font-weight:bold;padding:9px 12px;border:1px solid #D9D3C5;text-align:left;white-space:nowrap;">${c.label}</th>`;
  }).join('');

  const hintCells = TEMPLATE_COLUMNS.map(
    (c) =>
      `<td width="${c.widthPx}" style="width:${c.widthPx}px;background:#F3F0E9;color:#5E646B;font-style:italic;font-size:11px;padding:6px 12px;border:1px solid #D9D3C5;">${c.hint}</td>`
  ).join('');

  const dataRowsHtml = SAMPLE_TEMPLATE_ROWS.map((row) => {
    const cells = row
      .map((val, idx) => {
        const col = TEMPLATE_COLUMNS[idx];
        const textStyle = col?.isTextFormat ? "mso-number-format:'\\@';text-align:left;" : '';
        return `<td style="${textStyle}padding:8px 12px;border:1px solid #E6E1D6;">${val}</td>`;
      })
      .join('');
    return `<tr height="28" style="height:21pt;">${cells}</tr>`;
  }).join('');

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Template Katalog SembakoOS</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml><![endif]-->
<style>
  body, table { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #12202B; }
  table { border-collapse: collapse; table-layout: fixed; }
</style>
</head>
<body>
<table>
  <colgroup>${colgroup}</colgroup>
  <thead>
    <tr height="32" style="height:24pt;">
      <th colspan="2" style="background:#0F372F;color:#FFFFFF;font-weight:bold;padding:8px 12px;border:1px solid #D9D3C5;text-align:center;">A. IDENTITAS BARANG (WAJIB)</th>
      <th colspan="4" style="background:#14463C;color:#FFFFFF;font-weight:bold;padding:8px 12px;border:1px solid #D9D3C5;text-align:center;">B. SATUAN &amp; HARGA ECERAN (WAJIB)</th>
      <th colspan="4" style="background:#1F5C8A;color:#FFFFFF;font-weight:bold;padding:8px 12px;border:1px solid #D9D3C5;text-align:center;">C. KEMASAN GROSIR / DUS (OPSIONAL)</th>
      <th colspan="4" style="background:#8A5300;color:#FFFFFF;font-weight:bold;padding:8px 12px;border:1px solid #D9D3C5;text-align:center;">D. STOK AWAL &amp; KEDALUWARSA (OPSIONAL)</th>
    </tr>
    <tr height="30" style="height:22.5pt;">${headerCells}</tr>
    <tr height="26" style="height:19.5pt;">${hintCells}</tr>
  </thead>
  <tbody>
    ${dataRowsHtml}
  </tbody>
</table>
</body>
</html>`;
}
