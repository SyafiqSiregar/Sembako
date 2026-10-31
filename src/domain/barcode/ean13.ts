/**
 * Domain EAN-13 — Generator & Renderer Barcode Internal SembakoOS
 * 
 * Aturan (AGENTS.md §4.1, PRD FR-CAT-11, rencana_lanjutan.md §1.6):
 * - Murni tanpa ketergantungan luar/React/Dexie.
 * - Format internal: EAN-13 awalan 20-29 (GS1 In-Store Circulation).
 * - Menghasilkan SVG murni dengan crispEdges yang tajam untuk printer thermal.
 */

const L_PATTERNS = [
  '0001101', // 0
  '0011001', // 1
  '0010011', // 2
  '0111101', // 3
  '0100011', // 4
  '0110001', // 5
  '0101111', // 6
  '0111011', // 7
  '0110111', // 8
  '0001011', // 9
];

const G_PATTERNS = [
  '0100111', // 0
  '0110011', // 1
  '0011011', // 2
  '0100001', // 3
  '0011101', // 4
  '0111001', // 5
  '0000101', // 6
  '0010001', // 7
  '0001001', // 8
  '0010111', // 9
];

const R_PATTERNS = [
  '1110010', // 0
  '1100110', // 1
  '1101100', // 2
  '1000010', // 3
  '1011100', // 4
  '1001110', // 5
  '1010000', // 6
  '1000100', // 7
  '1001000', // 8
  '1110100', // 9
];

const PARITY_MAP = [
  'LLLLLL', // 0
  'LLGLGG', // 1
  'LLGGLG', // 2
  'LLGGGL', // 3
  'LGLLGG', // 4
  'LGGLLG', // 5
  'LGGGLL', // 6
  'LGLGLG', // 7
  'LGLGGL', // 8
  'LGGLGL', // 9
];

/**
 * Menghitung digit pemeriksa EAN-13 (digit ke-13) dari 12 digit pertama.
 */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) {
    throw new TypeError(`first12 harus terdiri dari tepat 12 digit angka, diterima: '${first12}'`);
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12[i]!, 10);
    // Posisi 1-indexed: posisi ganjil bobot 1, posisi genap bobot 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Memvalidasi apakah string adalah kode barcode EAN-13 yang sah (13 digit & checksum benar).
 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) {
    return false;
  }
  const expectedCheck = ean13CheckDigit(code.slice(0, 12));
  return parseInt(code[12]!, 10) === expectedCheck;
}

/**
 * Membentuk barcode internal EAN-13 dari nomor urut konter toko.
 * Awalan standar GS1 internal toko adalah '20'.
 * Nomor urut maksimal 10 digit (0 sampai 9.999.999.999).
 */
export function buildInternalEan13(sequence: number, prefix: string = '20'): string {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError(`Nomor urut sequence harus integer non-negatif, diterima: ${sequence}`);
  }
  if (sequence > 9_999_999_999) {
    throw new RangeError(`Nomor urut melebihi batas 10 digit maksimum (9.999.999.999), diterima: ${sequence}`);
  }
  if (!/^\d{2}$/.test(prefix)) {
    throw new TypeError(`Prefix harus berupa tepat 2 digit angka, diterima: '${prefix}'`);
  }

  const seqStr = sequence.toString().padStart(10, '0');
  const first12 = `${prefix}${seqStr}`;
  const check = ean13CheckDigit(first12);
  return `${first12}${check}`;
}

/**
 * Menentukan apakah barcode berada di rentang nomor internal toko (awalan 20-29).
 */
export function isInternalBarcode(code: string): boolean {
  return /^2[0-9]{12}$/.test(code);
}

/**
 * Mengubah 13 digit EAN-13 menjadi 95 modul biner ('1' = batang hitam, '0' = ruang putih).
 */
export function encodeEan13Modules(code: string): string {
  if (!isValidEan13(code)) {
    throw new Error(`Barcode EAN-13 tidak valid: '${code}'`);
  }

  const firstDigit = parseInt(code[0]!, 10);
  const parity = PARITY_MAP[firstDigit]!;
  const leftDigits = code.slice(1, 7);
  const rightDigits = code.slice(7, 13);

  let modules = '';

  // 1. Penjaga Kiri (Left Guard): 101 (3 modul)
  modules += '101';

  // 2. 6 Digit Kiri (42 modul)
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(leftDigits[i]!, 10);
    const patternType = parity[i]!;
    modules += patternType === 'L' ? L_PATTERNS[digit]! : G_PATTERNS[digit]!;
  }

  // 3. Penjaga Tengah (Center Guard): 01010 (5 modul)
  modules += '01010';

  // 4. 6 Digit Kanan (42 modul)
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(rightDigits[i]!, 10);
    modules += R_PATTERNS[digit]!;
  }

  // 5. Penjaga Kanan (Right Guard): 101 (3 modul)
  modules += '101';

  return modules; // Total 95 modul
}

export interface RenderEan13SvgOptions {
  moduleMm?: number;      // Lebar satu modul batang dalam mm (default: 0.33mm)
  barHeightMm?: number;   // Tinggi batang dalam mm (default: 12mm)
  quietZoneModules?: number; // Zona sepi kiri-kanan (default: 7)
  showText?: boolean;     // Menampilkan angka di bawah batang (default: true)
}

/**
 * Menghasilkan string dokumen SVG murni siap cetak untuk barcode EAN-13.
 * Menggunakan crispEdges agar tidak blur saat dicetak pada printer thermal 203 DPI.
 */
export function renderEan13Svg(code: string, options: RenderEan13SvgOptions = {}): string {
  const modules = encodeEan13Modules(code);
  const moduleMm = options.moduleMm ?? 0.33;
  const barHeightMm = options.barHeightMm ?? 12;
  const quietZone = options.quietZoneModules ?? 7;
  const showText = options.showText ?? true;

  const totalModules = 95 + quietZone * 2;
  const totalWidthMm = Math.round(totalModules * moduleMm * 100) / 100;
  const textHeightMm = showText ? 3.5 : 0;
  const totalHeightMm = Math.round((barHeightMm + textHeightMm + (showText ? 1 : 0)) * 100) / 100;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  // Optimasi SVG: Gabungkan modul berturutan menjadi satu rect
  for (let i = 0; i < 95; i++) {
    const isBlack = modules[i] === '1';
    if (isBlack && !inBar) {
      inBar = true;
      barStart = i;
    } else if (!isBlack && inBar) {
      const width = i - barStart;
      const x = Math.round((quietZone + barStart) * moduleMm * 100) / 100;
      const w = Math.round(width * moduleMm * 100) / 100;
      rects += `<rect x="${x}" y="0" width="${w}" height="${barHeightMm}" fill="#000000" />`;
      inBar = false;
    }
  }

  if (inBar) {
    const width = 95 - barStart;
    const x = Math.round((quietZone + barStart) * moduleMm * 100) / 100;
    const w = Math.round(width * moduleMm * 100) / 100;
    rects += `<rect x="${x}" y="0" width="${w}" height="${barHeightMm}" fill="#000000" />`;
  }

  let textSvg = '';
  if (showText) {
    // Format EAN-13 human readable: 2 000000 000015
    const formattedText = `${code[0]}  ${code.slice(1, 7)}  ${code.slice(7, 13)}`;
    const textY = Math.round((barHeightMm + 3.2) * 100) / 100;
    const textX = Math.round((totalWidthMm / 2) * 100) / 100;
    textSvg = `<text x="${textX}" y="${textY}" text-anchor="middle" font-family="monospace, monospace" font-size="2.8" font-weight="bold" fill="#000000">${formattedText}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidthMm} ${totalHeightMm}" width="${totalWidthMm}mm" height="${totalHeightMm}mm" shape-rendering="crispEdges" role="img" aria-label="Barcode ${code}">${rects}${textSvg}</svg>`;
}
