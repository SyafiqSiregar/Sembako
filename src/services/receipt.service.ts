import type { Payment, Sale, SaleItem } from '@/data/db';
import { formatRupiah } from '@/domain/money';
import { formatQuantity } from '@/domain/quantity';
import { escapeHtml } from '@/lib/html';
import type { PaperWidth, StoreSettings } from '@/services/settings.service';

/** Jumlah karakter per baris pada printer thermal (font A, 203 dpi). */
export const RECEIPT_COLUMNS: Record<PaperWidth, number> = {
  '58mm': 32,
  '80mm': 48,
};

/** Lebar area cetak dan margin kiri-kanan (mm) per ukuran kertas. */
const PAPER_LAYOUT: Record<PaperWidth, { sideMm: number }> = {
  '58mm': { sideMm: 5 }, // 58 - 2×5 = 48 mm area cetak
  '80mm': { sideMm: 4 }, // 80 - 2×4 = 72 mm area cetak
};

export interface ReceiptLine {
  text: string;
  bold?: boolean;
}

export interface ReceiptPayload {
  sale: Pick<Sale, 'receipt_no' | 'completed_at' | 'subtotal' | 'discount_total' | 'total'>;
  items: SaleItem[];
  payment: Payment | null;
  cashierName: string;
  store: Pick<
    StoreSettings,
    | 'storeName'
    | 'storeAddress'
    | 'storePhone'
    | 'receiptFooter'
    | 'returnDaysLimit'
    | 'showReturnPolicyOnReceipt'
  >;
  paperWidth: PaperWidth;
  /** Diisi (epoch ms) hanya saat cetak ulang dari riwayat transaksi. */
  reprintedAt?: number;
}

/** Angka rupiah tanpa awalan "Rp", untuk kolom sempit. */
function amount(value: number): string {
  return formatRupiah(value).replace(/^Rp /, '');
}

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Membungkus teks per kata; kata yang lebih panjang dari lebar dipotong paksa. */
function wrapText(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    let w = word;
    while (w.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!current) current = w;
    else if (current.length + 1 + w.length <= width) current += ` ${w}`;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function center(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

/** Kiri rata kiri, kanan rata kanan; teks kiri dipotong bila tidak muat. */
function twoCol(left: string, right: string, width: number): string {
  const room = width - right.length - 1;
  const l = left.length > room ? left.slice(0, Math.max(0, room)) : left;
  return l + ' '.repeat(Math.max(1, width - l.length - right.length)) + right;
}

/** Baris "Label : nilai"; nilai panjang dilanjutkan dengan indentasi sejajar. */
function labelRow(label: string, value: string, width: number): string[] {
  const prefix = `${label.padEnd(10)}: `;
  const wrapped = wrapText(value, Math.max(1, width - prefix.length));
  if (wrapped.length === 0) return [prefix.trimEnd()];
  return wrapped.map((part, i) => (i === 0 ? prefix : ' '.repeat(prefix.length)) + part);
}

function paymentLabel(payment: Payment): string {
  if (payment.method === 'cash') return 'Tunai';
  const ref = payment.reference_no ?? '';
  if (ref.startsWith('QRIS')) return 'QRIS';
  if (ref.startsWith('Transfer')) return 'Transfer Bank';
  return 'Non-Tunai';
}

/**
 * Menyusun baris struk monospace. Dipakai bersama oleh pratinjau layar dan dokumen
 * cetak agar apa yang dilihat kasir identik dengan yang keluar dari printer.
 */
export function buildReceiptLines(payload: ReceiptPayload): ReceiptLine[] {
  const { sale, items, payment, store, paperWidth } = payload;
  const w = RECEIPT_COLUMNS[paperWidth];
  const rule = (ch: string) => ({ text: ch.repeat(w) });
  const lines: ReceiptLine[] = [];
  const push = (text: string, bold = false) => lines.push({ text, bold });

  for (const part of wrapText(store.storeName.toUpperCase(), w)) push(center(part, w), true);
  for (const part of wrapText(store.storeAddress, w)) push(center(part, w));
  if (store.storePhone.trim()) push(center(`Telp: ${store.storePhone.trim()}`, w));
  lines.push(rule('='));

  if (payload.reprintedAt !== undefined) {
    push(center('*** SALINAN STRUK ***', w), true);
    push(center('(CETAK ULANG)', w), true);
    for (const row of labelRow('Dicetak', formatDateTime(payload.reprintedAt), w)) push(row);
    lines.push(rule('-'));
  }

  for (const row of labelRow('No. Struk', sale.receipt_no, w)) push(row);
  for (const row of labelRow('Tanggal', formatDateTime(sale.completed_at), w)) push(row);
  for (const row of labelRow('Kasir', payload.cashierName, w)) push(row);
  lines.push(rule('-'));

  for (const it of items) {
    for (const part of wrapText(it.name_snapshot, w)) push(part);
    const qty = formatQuantity(it.qty_base, it.unit_code_snapshot, it.factor_snapshot);
    push(twoCol(`  ${qty} x ${amount(it.unit_price_snapshot)}`, amount(it.line_total), w));
    if (it.discount > 0) push(twoCol('  Diskon', `-${amount(it.discount)}`, w));
  }
  lines.push(rule('-'));

  push(twoCol('Subtotal', formatRupiah(sale.subtotal), w));
  if (sale.discount_total > 0) {
    push(twoCol('Diskon Transaksi', `-${formatRupiah(sale.discount_total)}`, w));
  }
  push(twoCol('TOTAL', formatRupiah(sale.total), w), true);
  lines.push(rule('-'));

  if (payment) {
    push(twoCol(`Bayar (${paymentLabel(payment)})`, formatRupiah(payment.amount), w));
    if (payment.reference_no) {
      for (const row of labelRow('Ref', payment.reference_no, w)) push(row);
    }
    // Kembalian hanya bermakna untuk tunai; non-tunai dibayar pas sesuai total.
    const change = payment.method === 'cash' ? Math.max(0, payment.amount - sale.total) : 0;
    push(twoCol('Kembalian', formatRupiah(change), w), true);
  }
  lines.push(rule('='));

  const footer = store.receiptFooter.trim();
  if (footer) for (const part of wrapText(footer, w)) push(center(part, w));
  // returnDaysLimit 0 tidak dicetak: PRD tidak mendefinisikan arti "0 hari" bagi pelanggan.
  if (store.showReturnPolicyOnReceipt && store.returnDaysLimit > 0) {
    const policy = `Retur maks. ${store.returnDaysLimit} hari sejak tanggal beli, bawa struk ini.`;
    for (const part of wrapText(policy, w)) push(center(part, w));
  }

  return lines;
}

/** Dokumen HTML mandiri siap cetak untuk printer thermal (`@page` mengikuti lebar kertas). */
export function buildReceiptHtml(payload: ReceiptPayload): string {
  return wrapReceiptDocument(
    `Struk ${payload.sale.receipt_no}`,
    payload.paperWidth,
    buildReceiptLines(payload)
  );
}

/**
 * Struk uji coba untuk memeriksa lebar kertas dan penjajaran kolom printer.
 * Sengaja tanpa barang atau nominal rekaan (AGENTS.md §3 Aturan 3): hanya identitas toko
 * asli, penggaris kolom, dan penanda jelas bahwa ini bukan transaksi.
 */
export function buildReceiptTestLines(
  store: Pick<StoreSettings, 'storeName' | 'storeAddress' | 'storePhone'>,
  paperWidth: PaperWidth
): ReceiptLine[] {
  const w = RECEIPT_COLUMNS[paperWidth];
  const lines: ReceiptLine[] = [];
  const push = (text: string, bold = false) => lines.push({ text, bold });

  for (const part of wrapText(store.storeName.toUpperCase(), w)) push(center(part, w), true);
  for (const part of wrapText(store.storeAddress, w)) push(center(part, w));
  if (store.storePhone.trim()) push(center(`Telp: ${store.storePhone.trim()}`, w));
  push('='.repeat(w));
  push(center('STRUK UJI COBA', w), true);
  push(center('Bukan transaksi. Tidak disimpan.', w));
  push('-'.repeat(w));
  push('1234567890'.repeat(Math.ceil(w / 10)).slice(0, w));
  push(twoCol('Kolom kiri', 'kanan', w));
  push(`Lebar kertas : ${paperWidth} (${w} kolom)`);
  push('='.repeat(w));
  push(center('Jika semua baris di atas terbaca', w));
  push(center('utuh, printer siap dipakai.', w));
  return lines;
}

export function buildReceiptTestHtml(
  store: Pick<StoreSettings, 'storeName' | 'storeAddress' | 'storePhone'>,
  paperWidth: PaperWidth
): string {
  return wrapReceiptDocument('Struk uji coba', paperWidth, buildReceiptTestLines(store, paperWidth));
}

function wrapReceiptDocument(title: string, paperWidth: PaperWidth, lines: ReceiptLine[]): string {
  const side = PAPER_LAYOUT[paperWidth].sideMm;
  const body = lines
    .map((l) => `<div class="l${l.bold ? ' b' : ''}">${escapeHtml(l.text) || '&nbsp;'}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${paperWidth} auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    box-sizing: border-box;
    width: ${paperWidth};
    padding: 2mm ${side}mm 8mm ${side}mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 2.5mm;
    line-height: 1.3;
    color: #000;
  }
  .l { white-space: pre; }
  .b { font-weight: 700; }
</style>
</head>
<body>${body}</body>
</html>`;
}
