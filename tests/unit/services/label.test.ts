import { describe, it, expect } from 'vitest';
import { buildLabelSheetHtml } from '@/services/label.service';

describe('Unit: Label Generator Service (FR-CAT-11, LB-U01..LB-U06)', () => {
  const sampleItems = [
    {
      productName: 'Gula Pasir Curah Repack',
      unitName: 'kg',
      barcode: '2000000000015',
      price: 17500,
      copies: 3,
    },
  ];

  // LB-U01
  it('LB-U01: Preset 50x30 mm menghasilkan @page { size: 50mm 30mm } dan 3 label stiker', () => {
    const res = buildLabelSheetHtml({
      preset: 'thermal-50x30',
      items: sampleItems,
    });

    expect(res.totalLabels).toBe(3);
    expect(res.skippedCount).toBe(0);
    expect(res.html).toContain('size: 50mm 30mm');
    expect(res.html).toContain('Gula Pasir Curah Repack');
    expect(res.html).toContain('2000000000015');

    // 3 stiker .thermal-label
    const matches = res.html.match(/class="thermal-label/g);
    expect(matches?.length).toBe(3);
  });

  // LB-U02
  it('LB-U02: Preset A4 dengan 25 stiker menghasilkan 2 halaman grid (24 stiker di hal 1, 1 stiker di hal 2)', () => {
    const res = buildLabelSheetHtml({
      preset: 'a4-3x8',
      items: [
        {
          productName: 'Telur Ayam Pack',
          unitName: 'pak',
          barcode: '2000000000022',
          price: 25000,
          copies: 25,
        },
      ],
    });

    expect(res.totalLabels).toBe(25);
    expect(res.html).toContain('size: A4 portrait');
    const pages = res.html.match(/class="a4-page"/g);
    expect(pages?.length).toBe(2);

    const cells = res.html.match(/class="a4-cell"/g);
    expect(cells?.length).toBe(25);
  });

  // LB-U03
  it('LB-U03: showPrice = false tidak memuat elemen harga di body', () => {
    const res = buildLabelSheetHtml({
      preset: 'thermal-50x30',
      showPrice: false,
      items: sampleItems,
    });

    expect(res.html).not.toContain('class="price-tag"');
    expect(res.html).not.toContain('Rp 17.500');
  });

  // LB-U04
  it('LB-U04: showPrice = true mencantumkan harga dengan format Rupiah (Rp 17.500)', () => {
    const res = buildLabelSheetHtml({
      preset: 'thermal-50x30',
      showPrice: true,
      items: sampleItems,
    });

    expect(res.html).toContain('class="price-tag"');
    expect(res.html).toContain('Rp 17.500');
  });

  // LB-U05
  it('LB-U05: nama barang dengan karakter khusus ter-escape dengan aman', () => {
    const res = buildLabelSheetHtml({
      preset: 'thermal-50x30',
      items: [
        {
          productName: 'Gula <b>Manis</b> & Murni',
          unitName: 'kg',
          barcode: '2000000000015',
          price: 15000,
          copies: 1,
        },
      ],
    });

    expect(res.html).toContain('Gula &lt;b&gt;Manis&lt;/b&gt; &amp; Murni');
    expect(res.html).not.toContain('<b>Manis</b>');
  });

  // LB-U06
  it('LB-U06: item dengan barcode kosong atau tidak valid diabaikan dan dihitung di skippedCount', () => {
    const res = buildLabelSheetHtml({
      preset: 'thermal-50x30',
      items: [
        {
          productName: 'Barang Tanpa Barcode',
          unitName: 'pcs',
          barcode: '',
          price: 10000,
          copies: 2,
        },
        {
          productName: 'Barang Barcode Rusak',
          unitName: 'pcs',
          barcode: '12345',
          price: 10000,
          copies: 3,
        },
        ...sampleItems, // 3 copies valid
      ],
    });

    expect(res.totalLabels).toBe(3);
    expect(res.skippedCount).toBe(5); // 2 + 3
    expect(res.html).not.toContain('Barang Tanpa Barcode');
    expect(res.html).not.toContain('Barang Barcode Rusak');
    expect(res.html).toContain('Gula Pasir Curah Repack');
  });
});
