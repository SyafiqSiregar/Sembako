import {
  SembakoDatabase,
  type Category,
  type Product,
  type ProductUnit,
  type ProductBarcode,
  type Supplier,
} from './db';
import { InventoryService } from '@/services/inventory.service';
import { BatchService } from '@/services/batch.service';
import { CashierSessionService } from '@/services/session.service';
import { CheckoutService } from '@/services/checkout.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

/**
 * Data demo sembako berlabel jelas ([DEMO]) sesuai AGENTS.md §3 Rule 3.
 * Tidak dijalankan di production runtime secara otomatis.
 */
export async function seedDemoDatabase(db: SembakoDatabase): Promise<{
  categoriesCount: number;
  productsCount: number;
  suppliersCount: number;
  salesCount: number;
}> {
  const now = Date.now();
  const clock = new FixedClock(now);
  const idGen = new SequenceIdGenerator('demo');
  const inventoryService = new InventoryService(db, clock, idGen);
  const batchService = new BatchService(db, inventoryService, clock, idGen);
  const sessionService = new CashierSessionService(db, clock, idGen);
  const checkoutService = new CheckoutService(db, inventoryService, clock, idGen);

  // 1. Kategori Sembako
  const categories: Category[] = [
    {
      id: 'cat_demo_beras',
      name: 'Beras & Biji',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'cat_demo_minyak',
      name: 'Minyak & Margarin',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'cat_demo_gula',
      name: 'Gula & Pemanis',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'cat_demo_tepung',
      name: 'Bumbu & Tepung',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'cat_demo_telur',
      name: 'Telur & Segar',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'cat_demo_instan',
      name: 'Mie & Makanan Instan',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'cat_demo_minuman',
      name: 'Susu & Minuman',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
  ];

  await db.categories.bulkPut(categories);

  // 2. Pemasok
  const suppliers: Supplier[] = [
    {
      id: 'sup_demo_1',
      name: '[DEMO] PT Pangan Sejahtera Makmur',
      phone: '081234567890',
      address: 'Kawasan Industri Pergudangan Blok A4',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
    },
    {
      id: 'sup_demo_2',
      name: '[DEMO] CV Berkah Nabati Nusantara',
      phone: '081987654321',
      address: 'Jl. Rungkut Industri No. 12',
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
    },
  ];

  await db.suppliers.bulkPut(suppliers);

  // 3. Produk, Satuan & Barcode
  const products: Product[] = [
    {
      id: 'prod_demo_beras',
      category_id: 'cat_demo_beras',
      name: '[DEMO] Beras Rojo Lele 5 kg',
      base_unit_kind: 'count',
      base_unit_code: 'sak',
      min_stock_base: 5,
      track_expiry: 0,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'prod_demo_minyak',
      category_id: 'cat_demo_minyak',
      name: '[DEMO] Minyak Goreng Bimoli 2 L',
      base_unit_kind: 'count',
      base_unit_code: 'pouch',
      min_stock_base: 10,
      track_expiry: 0,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'prod_demo_gula',
      category_id: 'cat_demo_gula',
      name: '[DEMO] Gula Pasir Gulaku 1 kg',
      base_unit_kind: 'count',
      base_unit_code: 'bungkus',
      min_stock_base: 8,
      track_expiry: 0,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
    {
      id: 'prod_demo_susu',
      category_id: 'cat_demo_minuman',
      name: '[DEMO] Susu Kental Manis Frisian Flag 370g',
      base_unit_kind: 'count',
      base_unit_code: 'kaleng',
      min_stock_base: 12,
      track_expiry: 1,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
      row_version: 1,
    },
  ];

  await db.products.bulkPut(products);

  const units: ProductUnit[] = [
    {
      id: 'unit_demo_beras',
      product_id: 'prod_demo_beras',
      unit_code: 'sak',
      name: 'Sak 5 kg',
      conversion_factor: 1,
      price: 72000,
      cost_x10k: 620000000, // Rp 62.000
      is_base: 1,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
    },
    {
      id: 'unit_demo_minyak',
      product_id: 'prod_demo_minyak',
      unit_code: 'pouch',
      name: 'Pouch 2 Liter',
      conversion_factor: 1,
      price: 36000,
      cost_x10k: 310000000, // Rp 31.000
      is_base: 1,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
    },
    {
      id: 'unit_demo_gula',
      product_id: 'prod_demo_gula',
      unit_code: 'bungkus',
      name: 'Bungkus 1 kg',
      conversion_factor: 1,
      price: 18000,
      cost_x10k: 155000000, // Rp 15.500
      is_base: 1,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
    },
    {
      id: 'unit_demo_susu',
      product_id: 'prod_demo_susu',
      unit_code: 'kaleng',
      name: 'Kaleng 370g',
      conversion_factor: 1,
      price: 13500,
      cost_x10k: 110000000, // Rp 11.000
      is_base: 1,
      active: 1,
      created_at: now,
      created_by: 'system',
      updated_at: now,
      updated_by: 'system',
    },
  ];

  await db.product_units.bulkPut(units);

  const barcodes: ProductBarcode[] = [
    {
      id: 'bc_demo_beras',
      product_id: 'prod_demo_beras',
      product_unit_id: 'unit_demo_beras',
      barcode: '899100100101',
      created_at: now,
    },
    {
      id: 'bc_demo_minyak',
      product_id: 'prod_demo_minyak',
      product_unit_id: 'unit_demo_minyak',
      barcode: '899100100102',
      created_at: now,
    },
    {
      id: 'bc_demo_gula',
      product_id: 'prod_demo_gula',
      product_unit_id: 'unit_demo_gula',
      barcode: '899100100103',
      created_at: now,
    },
    {
      id: 'bc_demo_susu',
      product_id: 'prod_demo_susu',
      product_unit_id: 'unit_demo_susu',
      barcode: '899100100104',
      created_at: now,
    },
  ];

  await db.product_barcodes.bulkPut(barcodes);

  // 4. Batch Kedaluwarsa untuk Susu
  const batchSafe = await batchService.createOrGetBatch('prod_demo_susu', 'BTH-DEMO-SAFE', '2027-06-30');
  const batchWarn = await batchService.createOrGetBatch('prod_demo_susu', 'BTH-DEMO-CRIT', '2026-10-30');

  // 5. Saldo Stok Awal via InventoryService
  await inventoryService.recordMovement({
    type: 'INITIAL_BALANCE',
    userId: 'user_owner',
    reason: 'Saldo awal data demo',
    items: [
      { productId: 'prod_demo_beras', qtyDeltaBase: 25, unitCostX10k: 620000000 },
      { productId: 'prod_demo_minyak', qtyDeltaBase: 30, unitCostX10k: 310000000 },
      { productId: 'prod_demo_gula', qtyDeltaBase: 40, unitCostX10k: 155000000 },
      { productId: 'prod_demo_susu', batchId: batchSafe.id, qtyDeltaBase: 24, unitCostX10k: 110000000 },
      { productId: 'prod_demo_susu', batchId: batchWarn.id, qtyDeltaBase: 6, unitCostX10k: 110000000 },
    ],
  });

  // 6. Sesi Kasir & Sampel Transaksi Penjualan
  let activeSession = await sessionService.getActiveSession();
  if (!activeSession) {
    activeSession = await sessionService.openSession({
      userId: 'user_owner',
      openingCash: 300000, // Rp 300.000
    });
  }

  // Buat 1 transaksi kasir demo
  await checkoutService.processCheckout({
    saleId: 'sale_demo_01',
    sessionId: activeSession.id,
    cashierId: 'user_owner',
    paymentMethod: 'cash',
    amountPaid: 150000,
    items: [
      {
        productId: 'prod_demo_beras',
        productUnitId: 'unit_demo_beras',
        nameSnapshot: '[DEMO] Beras Rojo Lele 5 kg',
        unitCodeSnapshot: 'sak',
        factorSnapshot: 1,
        qtyBase: 1,
        unitPriceSnapshot: 72000,
        unitCostX10kSnapshot: 620000000,
        discount: 0,
      },
      {
        productId: 'prod_demo_minyak',
        productUnitId: 'unit_demo_minyak',
        nameSnapshot: '[DEMO] Minyak Goreng Bimoli 2 L',
        unitCodeSnapshot: 'pouch',
        factorSnapshot: 1,
        qtyBase: 2,
        unitPriceSnapshot: 36000,
        unitCostX10kSnapshot: 310000000,
        discount: 0,
      },
    ],
  });

  return {
    categoriesCount: categories.length,
    productsCount: products.length,
    suppliersCount: suppliers.length,
    salesCount: 1,
  };
}
