import { describe, it, expect, beforeEach } from 'vitest';
import { usePosStore } from '@/features/pos/posStore';
import { type ProductDetail } from '@/services/catalog.service';

describe('Unit: POS Cart Store (usePosStore)', () => {
  beforeEach(() => {
    usePosStore.getState().clearCart();
  });

  const mockProduct: ProductDetail = {
    product: {
      id: 'prod-beras-1',
      category_id: 'cat-sembako',
      sku: 'SKU-BERAS-01',
      name: 'Beras Pandan Wangi 5kg',
      base_unit_kind: 'weight',
      base_unit_code: 'sak',
      min_stock_base: 5,
      active: 1,
      track_expiry: 0,
      created_at: 1000,
      created_by: 'user-1',
      updated_at: 1000,
      updated_by: 'user-1',
      row_version: 1,
    },
    units: [
      {
        id: 'unit-sak',
        product_id: 'prod-beras-1',
        name: 'Sak 5kg',
        unit_code: 'sak',
        conversion_factor: 1,
        is_base: 1,
        price: 75000,
        cost_x10k: 650000000,
        active: 1,
        created_at: 1000,
        created_by: 'user-1',
        updated_at: 1000,
        updated_by: 'user-1',
      },
      {
        id: 'unit-bal',
        product_id: 'prod-beras-1',
        name: 'Bal (4 Sak)',
        unit_code: 'bal',
        conversion_factor: 4,
        is_base: 0,
        price: 290000,
        cost_x10k: 2600000000,
        active: 1,
        created_at: 1000,
        created_by: 'user-1',
        updated_at: 1000,
        updated_by: 'user-1',
      },
    ],
    barcodes: [
      {
        id: 'bar-1',
        product_id: 'prod-beras-1',
        product_unit_id: 'unit-sak',
        barcode: '8991234567890',
        created_at: 1000,
      },
    ],
    category: {
      id: 'cat-sembako',
      name: 'Beras & Biji-bijian',
      active: 1,
      created_at: 1000,
      created_by: 'user-1',
      updated_at: 1000,
      updated_by: 'user-1',
      row_version: 1,
    },
    totalStockBase: 20,
  };

  const mockProductMinyak: ProductDetail = {
    product: {
      id: 'prod-minyak-1',
      category_id: 'cat-minyak',
      sku: 'SKU-MINYAK-01',
      name: 'Minyak Goreng 2L',
      base_unit_kind: 'volume',
      base_unit_code: 'pouch',
      min_stock_base: 10,
      active: 1,
      track_expiry: 0,
      created_at: 1000,
      created_by: 'user-1',
      updated_at: 1000,
      updated_by: 'user-1',
      row_version: 1,
    },
    units: [
      {
        id: 'unit-pouch',
        product_id: 'prod-minyak-1',
        name: 'Pouch 2L',
        unit_code: 'pouch',
        conversion_factor: 1,
        is_base: 1,
        price: 34000,
        cost_x10k: 300000000,
        active: 1,
        created_at: 1000,
        created_by: 'user-1',
        updated_at: 1000,
        updated_by: 'user-1',
      },
    ],
    barcodes: [],
    category: {
      id: 'cat-minyak',
      name: 'Minyak & Margarin',
      active: 1,
      created_at: 1000,
      created_by: 'user-1',
      updated_at: 1000,
      updated_by: 'user-1',
      row_version: 1,
    },
    totalStockBase: 15,
  };

  it('menambahkan item baru dan menambah kuantitas jika item yang sama dimasukkan lagi', () => {
    const store = usePosStore.getState();
    store.addItem(mockProduct);

    expect(usePosStore.getState().items.length).toBe(1);
    expect(usePosStore.getState().items[0]?.name).toBe('Beras Pandan Wangi 5kg');
    expect(usePosStore.getState().items[0]?.qty).toBe(1);
    expect(usePosStore.getState().items[0]?.price).toBe(75000);

    // Tambah lagi item yang sama -> qty jadi 2
    usePosStore.getState().addItem(mockProduct);
    expect(usePosStore.getState().items.length).toBe(1);
    expect(usePosStore.getState().items[0]?.qty).toBe(2);
  });

  it('mendukung pemilihan unit kemasan berbeda untuk produk yang sama', () => {
    const store = usePosStore.getState();
    // Tambah unit sak
    store.addItem(mockProduct, mockProduct.units[0]);
    // Tambah unit bal
    store.addItem(mockProduct, mockProduct.units[1]);

    const items = usePosStore.getState().items;
    expect(items.length).toBe(2);
    expect(items[0]?.unitCode).toBe('sak');
    expect(items[0]?.price).toBe(75000);
    expect(items[1]?.unitCode).toBe('bal');
    expect(items[1]?.price).toBe(290000);
  });

  it('menjalankan operasi stepper (increment, decrement, remove)', () => {
    const store = usePosStore.getState();
    store.addItem(mockProduct);

    // Increment
    store.incrementQuantity('prod-beras-1', 'unit-sak');
    expect(usePosStore.getState().items[0]?.qty).toBe(2);

    // Decrement
    store.decrementQuantity('prod-beras-1', 'unit-sak');
    expect(usePosStore.getState().items[0]?.qty).toBe(1);

    // Decrement lagi saat qty=1 -> item terhapus dari keranjang
    store.decrementQuantity('prod-beras-1', 'unit-sak');
    expect(usePosStore.getState().items.length).toBe(0);

    // Add & manual remove
    store.addItem(mockProduct);
    expect(usePosStore.getState().items.length).toBe(1);
    store.removeItem('prod-beras-1', 'unit-sak');
    expect(usePosStore.getState().items.length).toBe(0);
  });

  it('menghitung subtotal, diskon baris, diskon transaksi, dan total pembayaran dengan benar', () => {
    const store = usePosStore.getState();
    // 2 Sak Beras @ 75.000 = 150.000
    store.addItem(mockProduct);
    store.incrementQuantity('prod-beras-1', 'unit-sak');

    // 1 Minyak @ 34.000 = 34.000
    store.addItem(mockProductMinyak);

    expect(usePosStore.getState().getItemCount()).toBe(3);
    expect(usePosStore.getState().getSubtotal()).toBe(184000);
    expect(usePosStore.getState().getTotal()).toBe(184000);

    // Beri diskon baris Rp 5.000 pada beras
    store.setLineDiscount('prod-beras-1', 'unit-sak', 5000);
    // Subtotal = (150.000 - 5.000) + 34.000 = 179.000
    expect(usePosStore.getState().getSubtotal()).toBe(179000);

    // Beri diskon total transaksi Rp 4.000
    store.setTransactionDiscount(4000);
    // Total = 179.000 - 4.000 = 175.000
    expect(usePosStore.getState().getTotal()).toBe(175000);
  });

  it('clearCart mereset items, diskon, dan menghasilkan activeSaleId baru', () => {
    const initialSaleId = usePosStore.getState().activeSaleId;
    usePosStore.getState().addItem(mockProduct);
    usePosStore.getState().setTransactionDiscount(5000);

    usePosStore.getState().clearCart();

    expect(usePosStore.getState().items.length).toBe(0);
    expect(usePosStore.getState().discountTotal).toBe(0);
    expect(usePosStore.getState().activeSaleId).not.toBe(initialSaleId);
  });
});
