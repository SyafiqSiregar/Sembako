/**
 * Service: Label Generator (FR-CAT-11, rencana_lanjutan.md §1.12)
 * 
 * Menghasilkan dokumen HTML murni terisolasi untuk pencetakan label stiker barcode.
 * Mendukung preset Thermal 50×30 mm, Thermal 40×30 mm, dan Lembar A4 (3×8 stiker).
 * Dapat langsung dicetak lewat printHtmlDocument() dari src/lib/print.ts.
 */

import { renderEan13Svg, isValidEan13 } from '@/domain/barcode/ean13';
import { formatRupiah } from '@/domain/money';
import { escapeHtml } from '@/lib/html';

export type LabelPaperPreset = 'thermal-50x30' | 'thermal-40x30' | 'a4-3x8';

export interface LabelPrintItem {
  productName: string;
  unitName: string;
  barcode: string;
  price: number;
  copies: number;
}

export interface BuildLabelSheetOptions {
  preset: LabelPaperPreset;
  showPrice?: boolean;
  showStoreName?: boolean;
  storeName?: string;
  items: LabelPrintItem[];
}

export interface BuildLabelSheetResult {
  html: string;
  totalLabels: number;
  skippedCount: number;
}

/**
 * Membangun dokumen HTML siap cetak untuk label barcode.
 */
export function buildLabelSheetHtml(options: BuildLabelSheetOptions): BuildLabelSheetResult {
  const {
    preset,
    showPrice = false,
    showStoreName = true,
    storeName = 'TOKO SEMBAKO BERKAH',
    items,
  } = options;

  let totalLabels = 0;
  let skippedCount = 0;

  // Siapkan daftar stiker individual
  const validStickers: Array<{
    productName: string;
    unitName: string;
    barcode: string;
    price: number;
    svgString: string;
  }> = [];

  for (const it of items) {
    const cleanBarcode = (it.barcode || '').trim();
    if (!cleanBarcode || !isValidEan13(cleanBarcode) || it.copies <= 0) {
      skippedCount += Math.max(0, it.copies || 1);
      continue;
    }

    // Render SVG barcode sesuai lebar modul preset
    const moduleMm = preset === 'thermal-40x30' ? 0.25 : 0.33;
    const barHeightMm = preset === 'thermal-40x30' ? 10 : 11;
    const svgString = renderEan13Svg(cleanBarcode, {
      moduleMm,
      barHeightMm,
      showText: true,
      quietZoneModules: 6,
    });

    const copiesCount = Math.min(Math.max(1, it.copies), 500);
    for (let c = 0; c < copiesCount; c++) {
      validStickers.push({
        productName: it.productName,
        unitName: it.unitName,
        barcode: cleanBarcode,
        price: it.price,
        svgString,
      });
      totalLabels++;
    }
  }

  // Jika semua item diabaikan
  if (validStickers.length === 0) {
    return {
      html: '',
      totalLabels: 0,
      skippedCount,
    };
  }

  const cleanStore = escapeHtml(storeName.trim() || 'TOKO KELONTONG');

  let bodyContent = '';

  if (preset === 'a4-3x8') {
    // A4: 24 stiker per halaman (3 kolom x 8 baris)
    const STICKERS_PER_PAGE = 24;
    const pageCount = Math.ceil(validStickers.length / STICKERS_PER_PAGE);

    for (let p = 0; p < pageCount; p++) {
      const pageStickers = validStickers.slice(p * STICKERS_PER_PAGE, (p + 1) * STICKERS_PER_PAGE);
      let pageCells = '';

      for (const s of pageStickers) {
        const pName = escapeHtml(s.productName);
        const uName = escapeHtml(s.unitName);
        const priceStr = showPrice ? formatRupiah(s.price) : '';

        pageCells += `
          <div class="a4-cell">
            ${showStoreName ? `<div class="store-hdr">${cleanStore}</div>` : ''}
            <div class="prod-title">${pName} <span class="prod-unit">${uName}</span></div>
            <div class="barcode-wrap">${s.svgString}</div>
            ${showPrice ? `<div class="price-tag">${priceStr} <span class="price-unit">/${uName}</span></div>` : ''}
          </div>
        `;
      }

      bodyContent += `<div class="a4-page">${pageCells}</div>`;
    }
  } else {
    // Thermal (50x30 atau 40x30): 1 stiker = 1 halaman
    const isSmall = preset === 'thermal-40x30';
    for (const s of validStickers) {
      const pName = escapeHtml(s.productName);
      const uName = escapeHtml(s.unitName);
      const priceStr = showPrice ? formatRupiah(s.price) : '';

      bodyContent += `
        <div class="thermal-label ${isSmall ? 'thermal-40' : 'thermal-50'}">
          ${showStoreName ? `<div class="store-hdr">${cleanStore}</div>` : ''}
          <div class="prod-title">${pName} <span class="prod-unit">${uName}</span></div>
          <div class="barcode-wrap">${s.svgString}</div>
          ${showPrice ? `<div class="price-tag">${priceStr} <span class="price-unit">/${uName}</span></div>` : ''}
        </div>
      `;
    }
  }

  // CSS dokumen cetak terisolasi
  let pageStyle = '';
  if (preset === 'thermal-50x30') {
    pageStyle = `
      @page {
        size: 50mm 30mm;
        margin: 0;
      }
      .thermal-label {
        width: 50mm;
        height: 30mm;
        padding: 1.5mm 2mm;
        box-sizing: border-box;
        page-break-after: always;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        text-align: center;
      }
    `;
  } else if (preset === 'thermal-40x30') {
    pageStyle = `
      @page {
        size: 40mm 30mm;
        margin: 0;
      }
      .thermal-label {
        width: 40mm;
        height: 30mm;
        padding: 1mm 1.5mm;
        box-sizing: border-box;
        page-break-after: always;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        text-align: center;
      }
    `;
  } else {
    pageStyle = `
      @page {
        size: A4 portrait;
        margin: 13mm 0 0 0;
      }
      .a4-page {
        width: 210mm;
        height: 297mm;
        page-break-after: always;
        display: grid;
        grid-template-columns: repeat(3, 70mm);
        grid-auto-rows: 37mm;
        box-sizing: border-box;
        overflow: hidden;
      }
      .a4-cell {
        width: 70mm;
        height: 37mm;
        padding: 2mm 3mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        text-align: center;
        overflow: hidden;
      }
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Cetak Label Barcode - SembakoOS</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #000000;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .store-hdr {
      font-size: 6.5pt;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .prod-title {
      font-size: 8pt;
      font-weight: 700;
      line-height: 1.15;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 100%;
    }
    .prod-unit {
      font-weight: 500;
      font-size: 7pt;
    }
    .barcode-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0.5mm 0;
    }
    .barcode-wrap svg {
      max-width: 100%;
      height: auto;
      shape-rendering: crispEdges;
    }
    .price-tag {
      font-size: 9.5pt;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.01em;
    }
    .price-unit {
      font-size: 7pt;
      font-weight: normal;
    }
    ${pageStyle}
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

  return {
    html,
    totalLabels,
    skippedCount,
  };
}

