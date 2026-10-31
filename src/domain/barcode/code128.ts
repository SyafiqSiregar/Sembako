/**
 * Domain Barcode Code-128 (Code Set B) — SembakoOS
 * 
 * Standar internasional barcode 1D untuk string alfanumerik (mis. nomor struk 'STR-20261031-0001').
 * 
 * Karakteristik:
 * - Code Set B: Karakter ASCII 32 (' ') sampai 127 (DEL).
 * - Modulo 103 Checksum: (StartCode + Sum(char_value * position)) % 103.
 * - Setiap karakter dikodekan dalam 11 modul (kecuali Stop Character yang memiliki 13 modul).
 * - Menghasilkan SVG murni dengan atribut shape-rendering="crispEdges" untuk hasil cetak thermal tajam.
 * - Zero third-party dependencies (Ponytail principle).
 */

// Pola 11-modul (lebar bar dan space) untuk 107 simbol Code-128
// Tiap angka 4-digit merepresentasikan lebar bar/space bergantian: b1 s1 b2 s2 b3 s3
// Total lebar modul = 11 untuk index 0..105, dan 13 untuk Stop (106).
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 = Stop)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Menghitung nilai karakter Code-128 Set B untuk karakter ASCII.
 * Karakter ASCII 32 (' ') -> 0, ..., ASCII 126 ('~') -> 94.
 */
function getCharValue(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 32 && code <= 126) {
    return code - 32;
  }
  // Fallback untuk karakter yang tidak didukung: spasi (0)
  return 0;
}

/**
 * Menghitung check digit Modulo 103 untuk string ASCII.
 */
export function calculateCode128CheckDigit(text: string): number {
  let sum = START_CODE_B;
  for (let i = 0; i < text.length; i++) {
    const val = getCharValue(text[i]!);
    sum += val * (i + 1);
  }
  return sum % 103;
}

/**
 * Mengonversi string alfanumerik menjadi deretan modul biner ('1' = bar hitam, '0' = space putih).
 */
export function encodeCode128BModules(text: string): string {
  const cleanText = text.trim();
  if (!cleanText) return '';

  const symbols: number[] = [START_CODE_B];
  for (let i = 0; i < cleanText.length; i++) {
    symbols.push(getCharValue(cleanText[i]!));
  }
  const checkDigit = calculateCode128CheckDigit(cleanText);
  symbols.push(checkDigit);
  symbols.push(STOP_CODE);

  let binary = '';
  for (const sym of symbols) {
    const pattern = CODE128_PATTERNS[sym];
    if (!pattern) continue;

    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j]!, 10);
      binary += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  }

  // Tambahkan quiet zones (10 modul di kiri dan kanan)
  return '0'.repeat(10) + binary + '0'.repeat(10);
}

export interface Code128Bar {
  xMm: number;
  widthMm: number;
}

export interface Code128Layout {
  totalWidthMm: number;
  bars: Code128Bar[];
  text: string;
}

/**
 * Menghitung koordinat bar horizontal untuk render JSX / SVG tanpa dangerouslySetInnerHTML.
 */
export function getCode128Bars(text: string, moduleWidthMm = 0.25): Code128Layout {
  const cleanText = text.trim();
  const modules = encodeCode128BModules(cleanText);
  if (!modules) return { totalWidthMm: 0, bars: [], text: '' };

  const bars: Code128Bar[] = [];
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < modules.length; i++) {
    const isOne = modules[i] === '1';
    if (isOne && !inBar) {
      inBar = true;
      barStart = i;
    } else if (!isOne && inBar) {
      inBar = false;
      bars.push({
        xMm: Number((barStart * moduleWidthMm).toFixed(2)),
        widthMm: Number(((i - barStart) * moduleWidthMm).toFixed(2)),
      });
    }
  }

  if (inBar) {
    bars.push({
      xMm: Number((barStart * moduleWidthMm).toFixed(2)),
      widthMm: Number(((modules.length - barStart) * moduleWidthMm).toFixed(2)),
    });
  }

  return {
    totalWidthMm: Number((modules.length * moduleWidthMm).toFixed(2)),
    bars,
    text: cleanText,
  };
}

export interface Code128RenderOptions {
  moduleWidthMm?: number; // Default 0.25 mm (cocok untuk 58mm & 80mm thermal)
  barHeightMm?: number;   // Default 9 mm
  showText?: boolean;     // Default true
  fontSizeMm?: number;    // Default 2.5 mm
}

/**
 * Me-render barcode Code-128 menjadi elemen SVG murni.
 * Menggunakan crispEdges untuk keterbacaan tajam pada printer thermal 203 DPI.
 */
export function renderCode128Svg(text: string, options: Code128RenderOptions = {}): string {
  const cleanText = text.trim();
  if (!cleanText) return '';

  const moduleWidthMm = options.moduleWidthMm ?? 0.25;
  const barHeightMm = options.barHeightMm ?? 9;
  const showText = options.showText ?? true;
  const fontSizeMm = options.fontSizeMm ?? 2.5;

  const modules = encodeCode128BModules(cleanText);
  if (!modules) return '';

  const totalWidthMm = modules.length * moduleWidthMm;
  const totalHeightMm = showText ? barHeightMm + fontSizeMm + 1.5 : barHeightMm;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < modules.length; i++) {
    const isOne = modules[i] === '1';
    if (isOne && !inBar) {
      inBar = true;
      barStart = i;
    } else if (!isOne && inBar) {
      inBar = false;
      const x = (barStart * moduleWidthMm).toFixed(2);
      const w = ((i - barStart) * moduleWidthMm).toFixed(2);
      rects += `<rect x="${x}" y="0" width="${w}" height="${barHeightMm}" fill="#000000" />`;
    }
  }

  if (inBar) {
    const x = (barStart * moduleWidthMm).toFixed(2);
    const w = ((modules.length - barStart) * moduleWidthMm).toFixed(2);
    rects += `<rect x="${x}" y="0" width="${w}" height="${barHeightMm}" fill="#000000" />`;
  }

  const textElement = showText
    ? `<text x="${(totalWidthMm / 2).toFixed(2)}" y="${(barHeightMm + fontSizeMm + 0.4).toFixed(2)}" font-family="Courier New, monospace" font-size="${fontSizeMm}" font-weight="bold" text-anchor="middle" fill="#000000">${cleanText}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidthMm.toFixed(2)} ${totalHeightMm.toFixed(2)}" width="${totalWidthMm.toFixed(2)}mm" height="${totalHeightMm.toFixed(2)}mm" shape-rendering="crispEdges" style="display:block;margin:0 auto;">${rects}${textElement}</svg>`;
}
