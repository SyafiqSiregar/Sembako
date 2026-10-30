import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { CatalogService } from '@/services/catalog.service';
import { InventoryService } from '@/services/inventory.service';
import { CheckoutService } from '@/services/checkout.service';

describe('CatalogService: Initial Stock & Expiry Input', () => {
  let db: SembakoDatabase;
  let catalogService: CatalogService;
  let inventoryService: InventoryService;
  let checkoutService: CheckoutService;
  let categoryId: string;

  beforeEach(async () => {
    db = new SembakoDatabase(`init_stock_test_${Date.now()}_${Math.random()}`);
    await db.open();
    catalogService = new CatalogService(db);
    inventoryService = new InventoryService(db);
    checkoutService = new CheckoutService(db, inventoryService);

    const cat = await catalogService.createCategory({
      name: 'Susu & Minuman',
      createdBy: 'system',
    });
    categoryId = cat.id;
  });

  it('membuat produk non-kedaluwarsa dengan stok awal di toko', async () => {
    const detail = await catalogService.createProduct({
      name: 'Sabun Mandi Lifebuoy',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      trackExpiry: false,
      minStockBase: 10,
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'pcs',
          name: 'Pcs / Batang',
          conversionFactor: 1,
          price: 4500,
          costX10k: 35000000,
          isBase: true,
        },
      ],
      barcodes: [{ barcode: '899111222333', unitCode: 'pcs' }],
      initialStockBase: 50,
    });

    expect(detail.product.id).toBeDefined();
    expect(detail.totalStockBase).toBe(50);

    // Pastikan saldo tercatat di inventory_balances
    const balance = await db.inventory_balances.where('product_id').equals(detail.product.id).first();
    expect(balance?.qty_base).toBe(50);
    expect(balance?.batch_id).toBe('');

    // Pastikan mutasi ledger INITIAL_BALANCE tercatat
    const movement = await db.stock_movements.where('[ref_type+ref_id]').equals(['opening_stock', detail.product.id]).first();
    expect(movement?.type).toBe('INITIAL_BALANCE');
    expect(movement?.ref_type).toBe('opening_stock');

    const movementItem = await db.stock_movement_items.where('movement_id').equals(movement!.id).first();
    expect(movementItem?.qty_delta_base).toBe(50);
  });

  it('membuat produk ber-expiry dengan stok awal dan tanggal kedaluwarsa', async () => {
    const detail = await catalogService.createProduct({
      name: 'Susu Ultra Milk Cokelat 200ml',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'kotak',
      trackExpiry: true,
      minStockBase: 5,
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'kotak',
          name: 'Kotak',
          conversionFactor: 1,
          price: 5500,
          costX10k: 45000000,
          isBase: true,
        },
      ],
      barcodes: [{ barcode: '899999000111', unitCode: 'kotak' }],
      initialStockBase: 24,
      initialExpiryDate: '2027-02-15',
      initialBatchCode: 'BTH-ULTRA-01',
    });

    expect(detail.product.id).toBeDefined();
    expect(detail.totalStockBase).toBe(24);

    // Pastikan batch terdaftar di product_batches
    const batch = await db.product_batches.where('product_id').equals(detail.product.id).first();
    expect(batch).toBeDefined();
    expect(batch?.batch_code).toBe('BTH-ULTRA-01');
    expect(batch?.expiry_date).toBe('2027-02-15');

    // Pastikan saldo terhubung ke batch_id tersebut
    const balance = await db.inventory_balances.get([detail.product.id, batch!.id]);
    expect(balance).toBeDefined();
    expect(balance?.qty_base).toBe(24);

    // Pastikan mutasi ledger mencatat batch_id
    const movement = await db.stock_movements.where('[ref_type+ref_id]').equals(['opening_stock', detail.product.id]).first();
    expect(movement?.type).toBe('INITIAL_BALANCE');

    const movementItem = await db.stock_movement_items.where('movement_id').equals(movement!.id).first();
    expect(movementItem?.batch_id).toBe(batch!.id);
    expect(movementItem?.qty_delta_base).toBe(24);

    // Total stok produk via InventoryService harus 24
    const currentStock = await inventoryService.getProductStock(detail.product.id);
    expect(currentStock).toBe(24);
  });

  it('menolak pembuatan produk jika trackExpiry aktif, stok > 0, tapi tanggal expired kosong', async () => {
    await expect(
      catalogService.createProduct({
        name: 'Roti Tawar Sari Roti',
        categoryId,
        baseUnitKind: 'count',
        baseUnitCode: 'bungkus',
        trackExpiry: true,
        minStockBase: 5,
        createdBy: 'owner-1',
        units: [
          {
            unitCode: 'bungkus',
            name: 'Bungkus',
            conversionFactor: 1,
            price: 15000,
            costX10k: 120000000,
            isBase: true,
          },
        ],
        initialStockBase: 10,
        // initialExpiryDate tidak diisi
      })
    ).rejects.toThrow('Tanggal kedaluwarsa wajib diisi');
  });

  it('barang yang didaftarkan dengan stok awal & expiry langsung bisa dijual di kasir POS', async () => {
    // 1. Buat produk dengan stok awal 10
    const detail = await catalogService.createProduct({
      name: 'Kacang Garuda 100g',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'bungkus',
      trackExpiry: true,
      minStockBase: 5,
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'bungkus',
          name: 'Bungkus',
          conversionFactor: 1,
          price: 10000,
          costX10k: 80000000,
          isBase: true,
        },
      ],
      barcodes: [{ barcode: '899888777666', unitCode: 'bungkus' }],
      initialStockBase: 10,
      initialExpiryDate: '2026-12-31',
    });

    // 2. Buat sesi kasir aktif
    await db.cashier_sessions.add({
      id: 'session-pos-1',
      user_id: 'cashier-1',
      opened_at: Date.now(),
      opening_cash: 100000,
      status: 'open',
    });

    // 3. Jual 3 bungkus via CheckoutService
    const saleResult = await checkoutService.processCheckout({
      saleId: 'sale-test-init-01',
      sessionId: 'session-pos-1',
      cashierId: 'cashier-1',
      items: [
        {
          productId: detail.product.id,
          productUnitId: detail.units[0]!.id,
          nameSnapshot: detail.product.name,
          unitCodeSnapshot: detail.units[0]!.unit_code,
          factorSnapshot: detail.units[0]!.conversion_factor,
          qtyBase: 3,
          unitPriceSnapshot: 10000,
          unitCostX10kSnapshot: detail.units[0]!.cost_x10k,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 30000,
    });

    expect(saleResult.sale.status).toBe('completed');
    expect(saleResult.sale.total).toBe(30000);

    // 4. Pastikan sisa stok berkurang tepat menjadi 7
    const remainingStock = await inventoryService.getProductStock(detail.product.id);
    expect(remainingStock).toBe(7);
  });
});
