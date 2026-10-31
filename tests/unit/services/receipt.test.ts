import { describe, it, expect } from 'vitest';
import type { Payment, SaleItem } from '@/data/db';
import {
  buildReceiptHtml,
  buildReceiptLines,
  RECEIPT_COLUMNS,
  type ReceiptPayload,
} from '@/services/receipt.service';

const completedAt = new Date('2026-10-30T14:25:00+07:00').getTime();

function item(overrides: Partial<SaleItem> & Pick<SaleItem, 'id' | 'name_snapshot'>): SaleItem {
  return {
    sale_id: 'sale_1',
    line_no: 1,
    product_id: 'p1',
    product_unit_id: 'u1',
    unit_code_snapshot: 'pcs',
    factor_snapshot: 1,
    qty_base: 1,
    unit_price_snapshot: 1000,
    discount: 0,
    line_total: 1000,
    unit_cost_x10k_snapshot: 0,
    ...overrides,
  };
}

const cash: Payment = {
  id: 'pay_1',
  sale_id: 'sale_1',
  method: 'cash',
  amount: 200000,
  paid_at: completedAt,
};

function payload(overrides: Partial<ReceiptPayload> = {}): ReceiptPayload {
  return {
    sale: {
      receipt_no: 'TRX-20261030-0004',
      completed_at: completedAt,
      subtotal: 164250,
      discount_total: 0,
      total: 164250,
    },
    items: [
      item({
        id: 'i1',
        name_snapshot: 'Beras Ramos 5kg',
        qty_base: 1,
        unit_code_snapshot: 'karung',
        unit_price_snapshot: 70000,
        line_total: 70000,
      }),
      item({
        id: 'i2',
        name_snapshot: 'Minyak Goreng 2L',
        qty_base: 2,
        unit_code_snapshot: 'pouch',
        unit_price_snapshot: 34000,
        line_total: 68000,
      }),
    ],
    payment: cash,
    cashierName: 'Budi',
    store: {
      storeName: 'Toko Sembako Berkah',
      storeAddress: 'Jl. Pasar Baru No. 12, Jakarta',
      storePhone: '0812-3456-7890',
      receiptFooter: 'Terima kasih atas kunjungan Anda!',
      returnDaysLimit: 7,
      showReturnPolicyOnReceipt: true,
    },
    paperWidth: '58mm',
    ...overrides,
  };
}

const texts = (p: ReceiptPayload) => buildReceiptLines(p).map((l) => l.text);

describe('Struk thermal (RC-01..RC-08)', () => {
  it('RC-U01: nama barang panjang membungkus tanpa merusak kolom subtotal (58mm)', () => {
    const long = item({
      id: 'i3',
      name_snapshot: 'Kecap Manis Bango Refill Pouch Ekonomis 550 ml Isi Ulang',
    });
    const lines = texts(payload({ items: [long] }));
    const nameLines = lines.filter((l) => l.includes('Kecap') || l.includes('Refill') || l.includes('Ulang'));
    expect(nameLines.length).toBeGreaterThanOrEqual(2);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(32);
  });

  it('RC-U02: tidak ada baris melebihi 32 karakter pada kertas 58mm', () => {
    for (const l of texts(payload({ paperWidth: '58mm' }))) {
      expect(l.length).toBeLessThanOrEqual(RECEIPT_COLUMNS['58mm']);
    }
  });

  it('RC-U03: tidak ada baris melebihi 48 karakter pada kertas 80mm, pemisah tepat 48', () => {
    const lines = texts(payload({ paperWidth: '80mm' }));
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(48);
    expect(lines).toContain('='.repeat(48));
  });

  it('RC-U04: cetak ulang memuat penanda salinan dan waktu cetak ulang; struk asli tidak', () => {
    const original = texts(payload());
    expect(original.join('\n')).not.toContain('SALINAN STRUK');

    const copy = texts(payload({ reprintedAt: new Date('2026-10-31T09:00:00+07:00').getTime() }));
    const joined = copy.join('\n');
    expect(joined).toContain('*** SALINAN STRUK ***');
    expect(joined).toContain('(CETAK ULANG)');
    expect(joined).toContain('Dicetak');
  });

  it('RC-U05: pembayaran QRIS menampilkan metode dan nomor referensi, kembalian nol', () => {
    const qris: Payment = {
      ...cash,
      method: 'non_cash_manual',
      amount: 164250,
      reference_no: 'QRIS-99281726',
    };
    const joined = texts(payload({ payment: qris })).join('\n');
    expect(joined).toContain('Bayar (QRIS)');
    expect(joined).toContain('QRIS-99281726');
    const change = texts(payload({ payment: qris })).find((l) => l.startsWith('Kembalian'));
    expect(change).toMatch(/Rp 0$/);
  });

  it('RC-U06: diskon baris dan diskon transaksi dicetak dengan tanda minus', () => {
    const discounted = item({
      id: 'i4',
      name_snapshot: 'Gula Pasir',
      discount: 1000,
      line_total: 16500,
      unit_price_snapshot: 17500,
    });
    const lines = texts(
      payload({
        items: [discounted],
        sale: {
          receipt_no: 'TRX-1',
          completed_at: completedAt,
          subtotal: 17500,
          discount_total: 5000,
          total: 12500,
        },
      })
    );
    expect(lines.some((l) => l.includes('Diskon') && l.includes('-1.000'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Diskon Transaksi') && l.includes('-Rp 5.000'))).toBe(true);
  });

  it('kembalian tunai dihitung dari uang diterima dikurangi total (integer)', () => {
    const change = texts(payload()).find((l) => l.startsWith('Kembalian'));
    expect(change).toContain('Rp 35.750');
  });

  it('RC-I02/I03: batas retur mengikuti pengaturan dan dapat dimatikan', () => {
    const base = payload();
    const fourteen = texts({ ...base, store: { ...base.store, returnDaysLimit: 14 } }).join(' ');
    expect(fourteen).toContain('14 hari');

    const off = texts({ ...base, store: { ...base.store, showReturnPolicyOnReceipt: false } }).join(' ');
    expect(off).not.toContain('Retur maks');
  });

  it('batas retur 0 hari tidak mencetak kebijakan (arti 0 belum didefinisikan PRD)', () => {
    const base = payload();
    const joined = texts({ ...base, store: { ...base.store, returnDaysLimit: 0 } }).join(' ');
    expect(joined).not.toContain('Retur maks');
  });

  it('identitas toko dan footer berasal dari pengaturan, bukan nilai bawaan komponen', () => {
    const base = payload();
    const joined = texts({
      ...base,
      store: { ...base.store, storeName: 'Warung Maju', storeAddress: 'Jl. Melati 5', receiptFooter: 'Sampai jumpa' },
    }).join('\n');
    expect(joined).toContain('WARUNG MAJU');
    expect(joined).toContain('Jl. Melati 5');
    expect(joined).toContain('Sampai jumpa');
    expect(joined).not.toContain('Pasar Tradisional');
  });

  it('dokumen HTML: @page mengikuti lebar kertas dan teks pengguna di-escape', () => {
    const base = payload();
    const evil = item({ id: 'i5', name_snapshot: 'Mie <script>alert(1)</script> & Co' });
    const html58 = buildReceiptHtml({ ...base, items: [evil] });
    expect(html58).toContain('size: 58mm auto');
    expect(html58).not.toContain('<script>');
    expect(html58).toContain('&lt;script&gt;');
    expect(html58).toContain('&amp;');

    expect(buildReceiptHtml({ ...base, paperWidth: '80mm' })).toContain('size: 80mm auto');
  });
});

