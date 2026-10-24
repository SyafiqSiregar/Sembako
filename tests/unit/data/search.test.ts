import { describe, it, expect } from 'vitest';
import { ProductSearchIndex } from '@/data/search/product-search';
import { parseCsv } from '@/lib/csv';
import { type ProductDetail } from '@/services/catalog.service';

describe('Search: ProductSearchIndex & CSV Parser', () => {
  const dummyProducts: ProductDetail[] = [
    {
      product: {
        id: 'p-1',
        name: 'Beras Rojo Lele 5 kg',
        sku: 'BRS-01',
        category_id: 'c-1',
        base_unit_kind: 'weight',
        base_unit_code: 'g',
        track_expiry: 1,
        min_stock_base: 5,
        active: 1,
        created_at: 0,
        created_by: 'u1',
        updated_at: 0,
        updated_by: 'u1',
        row_version: 1,
      },
      units: [],
      barcodes: [{ id: 'b1', product_id: 'p-1', product_unit_id: 'u1', barcode: '8991234567890', created_at: 0 }],
      totalStockBase: 10,
    },
    {
      product: {
        id: 'p-2',
        name: 'Minyak Goreng Sovia 2 L',
        sku: 'MYK-01',
        category_id: 'c-2',
        base_unit_kind: 'volume',
        base_unit_code: 'ml',
        track_expiry: 1,
        min_stock_base: 5,
        active: 1,
        created_at: 0,
        created_by: 'u1',
        updated_at: 0,
        updated_by: 'u1',
        row_version: 1,
      },
      units: [],
      barcodes: [{ id: 'b2', product_id: 'p-2', product_unit_id: 'u2', barcode: '8999876543210', created_at: 0 }],
      totalStockBase: 5,
    },
  ];

  it('menemukan produk secara instan berdasarkan barcode persis', () => {
    const index = new ProductSearchIndex();
    index.setItems(dummyProducts);

    const result = index.search('8991234567890');
    expect(result.length).toBe(1);
    expect(result[0]?.product.name).toBe('Beras Rojo Lele 5 kg');
  });

  it('menemukan produk berdasarkan prefix nama', () => {
    const index = new ProductSearchIndex();
    index.setItems(dummyProducts);

    const result = index.search('beras');
    expect(result.length).toBe(1);
    expect(result[0]?.product.name).toBe('Beras Rojo Lele 5 kg');
  });

  it('menemukan produk dengan toleransi typo ringan', () => {
    const index = new ProductSearchIndex();
    index.setItems(dummyProducts);

    const result = index.search('minyak');
    expect(result.length).toBe(1);
    expect(result[0]?.product.name).toBe('Minyak Goreng Sovia 2 L');
  });

  it('parseCsv memisahkan baris dan kolom dengan benar', () => {
    const csv = `nama,harga,barcode\n"Beras 5kg",72000,899111\n"Minyak 2L",34000,899222`;
    const rows = parseCsv(csv);
    expect(rows.length).toBe(3);
    expect(rows[1]).toEqual(['Beras 5kg', '72000', '899111']);
    expect(rows[2]).toEqual(['Minyak 2L', '34000', '899222']);
  });
});
