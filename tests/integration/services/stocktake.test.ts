import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { StocktakeService } from '@/services/stocktake.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('Integration: StocktakeService (T3.06, T3.07, T3.08, AC-21, AC-22)', () => {
  let db: SembakoDatabase;
  let invService: InventoryService;
  let stocktakeService: StocktakeService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  const spvId = 'user-spv-1';
  const prodId = 'prod-mie-01';

  beforeEach(async () => {
    db = new SembakoDatabase(`test_stocktake_${Date.now()}_${Math.random()}`);
    await db.open();

    clock = new FixedClock(1700000000000);
    idGen = new SequenceIdGenerator('st');
    invService = new InventoryService(db, clock, idGen);
    stocktakeService = new StocktakeService(db, invService, clock, idGen);

    // Setup product & units with initial stock 100 bungkus
    await db.products.add({
      id: prodId,
      category_id: 'cat-sembako',
      sku: 'SKU-MIE-01',
      name: 'Mie Instan Goreng',
      base_unit_kind: 'count',
      base_unit_code: 'bks',
      min_stock_base: 20,
      active: 1,
      track_expiry: 0,
      created_at: 1700000000000,
      created_by: spvId,
      updated_at: 1700000000000,
      updated_by: spvId,
      row_version: 1,
    });

    await db.product_units.add({
      id: 'unit-mie-bks',
      product_id: prodId,
      unit_code: 'bks',
      name: 'Bungkus',
      conversion_factor: 1,
      price: 3500,
      cost_x10k: 28000000, // Rp 2.800
      is_base: 1,
      active: 1,
      created_at: 1700000000000,
      created_by: spvId,
      updated_at: 1700000000000,
      updated_by: spvId,
    });

    // Inisialisasi saldo awal 100 bks
    await invService.recordMovement({
      type: 'INITIAL_BALANCE',
      refType: 'opening',
      userId: spvId,
      reason: 'Saldo awal',
      items: [{ productId: prodId, qtyDeltaBase: 100, unitCostX10k: 28000000 }],
    });
  });

  it('menjalankan siklus lengkap stok opname: buka sesi, hitung fisik, review selisih, dan posting atomik', async () => {
    // 1. T3.06 Buka Sesi Stok Opname
    const session = await stocktakeService.createSession({
      name: 'Opname Akhir Bulan Sembako',
      scopeType: 'all',
      createdBy: spvId,
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('counting');

    // 2. Input Hitung Fisik: Fisik dihitung 95 (Selisih -5 bks)
    clock.advance(1000);
    const countItem = await stocktakeService.recordCount({
      sessionId: session.id,
      productId: prodId,
      countedQty: 95,
      countedBy: spvId,
    });

    expect(countItem.counted_qty).toBe(95);
    expect(countItem.variance).toBe(-5);

    // 3. T3.07 Review Rekonsiliasi Selisih
    const review = await stocktakeService.getSessionReview(session.id);
    expect(review.totalItems).toBe(1);
    expect(review.itemsCounted).toBe(1);
    expect(review.totalVarianceQty).toBe(-5);
    expect(review.totalVarianceRupiah).toBe(-14000); // -5 x Rp 2.800

    // 4. T3.08 Posting Sesi Opname Atomik
    clock.advance(1000);
    const postedSession = await stocktakeService.postSession({
      sessionId: session.id,
      postedBy: spvId,
    });

    expect(postedSession.status).toBe('posted');

    // 5. Verifikasi saldo fisik terupdate di inventaris jadi 95
    const finalStock = await invService.getProductStock(prodId);
    expect(finalStock).toBe(95);

    // 6. Verifikasi pergerakan penyesuaian tercatat di stock_movements
    const movements = await db.stock_movements.where('type').equals('STOCKTAKE_ADJUSTMENT').toArray();
    expect(movements.length).toBe(1);
    expect(movements[0]?.ref_id).toBe(session.id);

    // 7. Verifikasi rekonsiliasi ledger tetap konsisten sempurna!
    const rec = await invService.reconcileStockLedger(prodId);
    expect(rec.isConsistent).toBe(true);
    expect(rec.currentBalance).toBe(95);
  });
});
