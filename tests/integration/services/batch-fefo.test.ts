import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { BatchService } from '@/services/batch.service';
import { CheckoutService } from '@/services/checkout.service';
import { GoodsReceiptService } from '@/services/goods-receipt.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('Batch, Expiry & FEFO Allocation (FR-EXP-01..05, AC-23, AC-24)', () => {
  let inventoryService: InventoryService;
  let batchService: BatchService;
  let checkoutService: CheckoutService;
  let receiptService: GoodsReceiptService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    clock = new FixedClock(new Date('2026-10-25T10:00:00Z').getTime());
    idGen = new SequenceIdGenerator('test_batch_');

    inventoryService = new InventoryService(db, clock, idGen);
    batchService = new BatchService(db, inventoryService, clock, idGen);
    checkoutService = new CheckoutService(db, inventoryService, clock, idGen);
    receiptService = new GoodsReceiptService(db, inventoryService, clock, idGen);

    // Seed test product dengan track_expiry = 1
    await db.products.add({
      id: 'prod_susu',
      name: 'Susu UHT 1L',
      category_id: 'cat_beverage',
      base_unit_kind: 'volume',
      base_unit_code: 'kotak',
      min_stock_base: 5,
      track_expiry: 1,
      active: 1,
      created_at: clock.now(),
      created_by: 'admin',
      updated_at: clock.now(),
      updated_by: 'admin',
      row_version: 1,
    });

    await db.product_units.add({
      id: 'unit_susu_1',
      product_id: 'prod_susu',
      name: 'Kotak 1L',
      unit_code: 'kotak',
      conversion_factor: 1,
      price: 18000,
      cost_x10k: 140000000, // Rp 14.000
      is_base: 1,
      active: 1,
      created_at: clock.now(),
      created_by: 'admin',
      updated_at: clock.now(),
      updated_by: 'admin',
    });

    // Seed supplier
    await db.suppliers.add({
      id: 'sup_indofood',
      name: 'PT Indofood Sukses Makmur',
      active: 1,
      created_at: clock.now(),
      created_by: 'admin',
      updated_at: clock.now(),
      updated_by: 'admin',
    });

    // Seed open session
    await db.cashier_sessions.add({
      id: 'sess_1',
      user_id: 'cashier_1',
      opening_cash: 200000,
      status: 'open',
      opened_at: clock.now(),
    });
  });

  it('menolak penerimaan barang jika produk track_expiry = 1 tidak menyertakan batch & expiry (AC-23)', async () => {
    await expect(
      receiptService.createAndPostReceipt({
        supplierId: 'sup_indofood',
        receivedDate: '2026-10-25',
        receivedBy: 'clerk_1',
        items: [
          {
            productId: 'prod_susu',
            productUnitId: 'unit_susu_1',
            qtyBase: 20,
            unitCostX10k: 140000000,
            // batchCode & expiryDate sengaja kosong
          },
        ],
      })
    ).rejects.toThrow(/wajib mencantumkan kode batch dan tanggal kedaluwarsa/);
  });

  it('berhasil menerima barang dengan batch dan menambah saldo stok per batch (FR-EXP-01, AC-23)', async () => {
    const res = await receiptService.createAndPostReceipt({
      supplierId: 'sup_indofood',
      receivedDate: '2026-10-25',
      receivedBy: 'clerk_1',
      items: [
        {
          productId: 'prod_susu',
          productUnitId: 'unit_susu_1',
          qtyBase: 20,
          unitCostX10k: 140000000,
          batchCode: 'BTH-2026-A',
          expiryDate: '2026-11-15',
        },
      ],
    });

    expect(res.receipt.status).toBe('posted');

    const batch = await db.product_batches.where({ product_id: 'prod_susu', batch_code: 'BTH-2026-A' }).first();
    expect(batch).toBeDefined();
    expect(batch?.expiry_date).toBe('2026-11-15');

    // Cek saldo inventaris per batch
    const bal = await db.inventory_balances.get(['prod_susu', batch!.id]);
    expect(bal?.qty_base).toBe(20);
  });

  it('mengalokasikan stok secara FEFO dari batch terdekat kedaluwarsa saat checkout (FR-EXP-03, AC-24)', async () => {
    // 1. Buat Batch 1 (kedaluwarsa 2026-11-01, 10 unit)
    const b1 = await batchService.createOrGetBatch('prod_susu', 'BATCH-EXP-EARLY', '2026-11-01');
    await inventoryService.recordMovement({
      type: 'RECEIPT',
      userId: 'clerk_1',
      items: [{ productId: 'prod_susu', batchId: b1.id, qtyDeltaBase: 10, unitCostX10k: 140000000 }],
    });

    // 2. Buat Batch 2 (kedaluwarsa 2026-12-01, 15 unit)
    const b2 = await batchService.createOrGetBatch('prod_susu', 'BATCH-EXP-LATER', '2026-12-01');
    await inventoryService.recordMovement({
      type: 'RECEIPT',
      userId: 'clerk_1',
      items: [{ productId: 'prod_susu', batchId: b2.id, qtyDeltaBase: 15, unitCostX10k: 140000000 }],
    });

    // 3. Checkout 12 unit -> Harus mengambil 10 unit dari b1 dan 2 unit dari b2
    const checkoutRes = await checkoutService.processCheckout({
      saleId: 'sale_fefo_1',
      sessionId: 'sess_1',
      cashierId: 'cashier_1',
      items: [
        {
          productId: 'prod_susu',
          productUnitId: 'unit_susu_1',
          nameSnapshot: 'Susu UHT 1L',
          unitCodeSnapshot: 'kotak',
          factorSnapshot: 1,
          qtyBase: 12,
          unitPriceSnapshot: 18000,
          unitCostX10kSnapshot: 140000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 300000,
    });

    expect(checkoutRes.sale.status).toBe('completed');

    // 4. Periksa saldo batch setelah FEFO
    const bal1 = await db.inventory_balances.get(['prod_susu', b1.id]);
    const bal2 = await db.inventory_balances.get(['prod_susu', b2.id]);

    expect(bal1?.qty_base).toBe(0); // 10 - 10
    expect(bal2?.qty_base).toBe(13); // 15 - 2
  });

  it('memblokir penjualan jika batch sudah kedaluwarsa (FR-EXP-04)', async () => {
    // Buat batch yang sudah kedaluwarsa kemarin
    const bExpired = await batchService.createOrGetBatch('prod_susu', 'BATCH-EXPIRED', '2026-10-20');
    await inventoryService.recordMovement({
      type: 'RECEIPT',
      userId: 'clerk_1',
      items: [{ productId: 'prod_susu', batchId: bExpired.id, qtyDeltaBase: 5, unitCostX10k: 140000000 }],
    });

    // Coba checkout -> harus ditolak
    await expect(
      checkoutService.processCheckout({
        saleId: 'sale_blocked_expired',
        sessionId: 'sess_1',
        cashierId: 'cashier_1',
        items: [
          {
            productId: 'prod_susu',
            productUnitId: 'unit_susu_1',
            nameSnapshot: 'Susu UHT 1L',
            unitCodeSnapshot: 'kotak',
            factorSnapshot: 1,
            qtyBase: 2,
            unitPriceSnapshot: 18000,
            unitCostX10kSnapshot: 140000000,
          },
        ],
        paymentMethod: 'cash',
        amountPaid: 50000,
      })
    ).rejects.toThrow(/telah kedaluwarsa \(FR-EXP-04\)/);
  });

  it('dapat mengeluarkan (write-off) barang kedaluwarsa dengan ledger movement dan audit log (FR-EXP-06)', async () => {
    const bExp = await batchService.createOrGetBatch('prod_susu', 'BATCH-TO-WRITEOFF', '2026-10-20');
    await inventoryService.recordMovement({
      type: 'RECEIPT',
      userId: 'clerk_1',
      items: [{ productId: 'prod_susu', batchId: bExp.id, qtyDeltaBase: 8, unitCostX10k: 140000000 }],
    });

    const movement = await batchService.writeOffBatch({
      batchId: bExp.id,
      productId: 'prod_susu',
      qtyBase: 8,
      userId: 'spv_1',
      reason: 'Pemusnahan susu kemasan rusak & bocor',
    });

    expect(movement.type).toBe('DAMAGE_SPOILAGE');

    const bal = await db.inventory_balances.get(['prod_susu', bExp.id]);
    expect(bal?.qty_base).toBe(0);

    // Audit log tersimpan
    const audit = await db.audit_logs.filter((a) => a.entity_id === bExp.id).first();
    expect(audit).toBeDefined();
    expect(audit?.action).toBe('inventory.write_off');
  });
});
