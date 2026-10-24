import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('Integration: InventoryService Stock Card & Adjustment (T3.02, T3.03, AC-18, AC-19)', () => {
  let db: SembakoDatabase;
  let invService: InventoryService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  const clerkId = 'user-stock-clerk-1';
  const prodId = 'prod-kopi-01';

  beforeEach(async () => {
    db = new SembakoDatabase(`test_inv_adj_${Date.now()}_${Math.random()}`);
    await db.open();

    clock = new FixedClock(1700000000000);
    idGen = new SequenceIdGenerator('inv');
    invService = new InventoryService(db, clock, idGen);

    // Setup product & units
    await db.products.add({
      id: prodId,
      category_id: 'cat-sembako',
      sku: 'SKU-KOPI-01',
      name: 'Kopi Bubuk 250g',
      base_unit_kind: 'weight',
      base_unit_code: 'bks',
      min_stock_base: 10,
      active: 1,
      track_expiry: 0,
      created_at: 1700000000000,
      created_by: clerkId,
      updated_at: 1700000000000,
      updated_by: clerkId,
      row_version: 1,
    });

    await db.product_units.add({
      id: 'unit-kopi-bks',
      product_id: prodId,
      unit_code: 'bks',
      name: 'Bungkus 250g',
      conversion_factor: 1,
      price: 15000,
      cost_x10k: 120000000,
      is_base: 1,
      active: 1,
      created_at: 1700000000000,
      created_by: clerkId,
      updated_at: 1700000000000,
      updated_by: clerkId,
    });

    // Inisialisasi saldo awal 20 bungkus
    await invService.recordMovement({
      type: 'INITIAL_BALANCE',
      refType: 'opening',
      userId: clerkId,
      reason: 'Saldo awal stok',
      items: [
        {
          productId: prodId,
          qtyDeltaBase: 20,
          unitCostX10k: 120000000,
        },
      ],
    });
  });

  describe('adjustStock (T3.03, AC-19)', () => {
    it('mengkoreksi stok ke angka fisik baru dan mencatat audit log', async () => {
      // Saldo awal 20. Hasil hitung fisik menemukan 18 (2 rusak karena basah)
      clock.advance(1000);
      const movement = await invService.adjustStock({
        productId: prodId,
        newQtyBase: 18,
        reasonType: 'DAMAGE_SPOILAGE',
        reason: '2 bungkus rusak terkena tetesan air bocor',
        userId: clerkId,
      });

      expect(movement.id).toBeDefined();
      expect(movement.type).toBe('DAMAGE_SPOILAGE');

      // Verifikasi saldo baru = 18
      const currentStock = await invService.getProductStock(prodId);
      expect(currentStock).toBe(18);

      // Verifikasi ledger konsisten
      const rec = await invService.reconcileStockLedger(prodId);
      expect(rec.isConsistent).toBe(true);
      expect(rec.currentBalance).toBe(18);

      // Verifikasi audit log
      const audit = await db.audit_logs.where('action').equals('inventory.adjust').first();
      expect(audit).toBeDefined();
      expect(audit?.user_id).toBe(clerkId);
      expect(audit?.reason).toBe('2 bungkus rusak terkena tetesan air bocor');
    });

    it('menolak penyesuaian tanpa alasan wajib (AC-19)', async () => {
      await expect(
        invService.adjustStock({
          productId: prodId,
          newQtyBase: 15,
          reasonType: 'LOST',
          reason: '   ', // kosong
          userId: clerkId,
        })
      ).rejects.toThrow(/Alasan penyesuaian stok wajib diisi/);
    });

    it('menolak penyesuaian jika kuantitas baru sama dengan stok saat ini', async () => {
      await expect(
        invService.adjustStock({
          productId: prodId,
          newQtyBase: 20, // sama persis dengan saldo awal 20
          reasonType: 'COUNT_CORRECTION',
          reason: 'Koreksi hitung',
          userId: clerkId,
        })
      ).rejects.toThrow(/Kuantitas fisik baru sama dengan stok saat ini/);
    });
  });

  describe('getStockCard (T3.02, AC-18)', () => {
    it('menghasilkan kronologi kartu stok dengan perhitungan saldo berjalan yang tepat', async () => {
      // 1. Awal: Saldo 20
      // 2. Tambah penerimaan barang 10 bks (Saldo jadi 30)
      clock.advance(2000);
      await invService.recordMovement({
        type: 'RECEIPT',
        refType: 'receipt',
        refId: 'gr-001',
        userId: clerkId,
        reason: 'Faktur Supplier #1234',
        items: [{ productId: prodId, qtyDeltaBase: 10, unitCostX10k: 120000000 }],
      });

      // 3. Penjualan kasir 5 bks (Saldo jadi 25)
      clock.advance(2000);
      await invService.recordMovement({
        type: 'SALE',
        refType: 'sale',
        refId: 'sale-001',
        userId: clerkId,
        reason: 'Penjualan #POS-1',
        items: [{ productId: prodId, qtyDeltaBase: -5, unitCostX10k: 120000000 }],
      });

      // 4. Penyesuaian rusak 2 bks (Saldo jadi 23)
      clock.advance(2000);
      await invService.adjustStock({
        productId: prodId,
        newQtyBase: 23,
        reasonType: 'DAMAGE_SPOILAGE',
        reason: 'Rusak kemasan sobek',
        userId: clerkId,
      });

      const card = await invService.getStockCard(prodId);

      expect(card.length).toBe(4);

      // Baris 1: Initial Balance
      expect(card[0]?.type).toBe('INITIAL_BALANCE');
      expect(card[0]?.qtyIn).toBe(20);
      expect(card[0]?.qtyOut).toBe(0);
      expect(card[0]?.runningBalance).toBe(20);

      // Baris 2: Receipt (Masuk 10)
      expect(card[1]?.type).toBe('RECEIPT');
      expect(card[1]?.qtyIn).toBe(10);
      expect(card[1]?.qtyOut).toBe(0);
      expect(card[1]?.runningBalance).toBe(30);

      // Baris 3: Sale (Keluar 5)
      expect(card[2]?.type).toBe('SALE');
      expect(card[2]?.qtyIn).toBe(0);
      expect(card[2]?.qtyOut).toBe(5);
      expect(card[2]?.runningBalance).toBe(25);

      // Baris 4: Adjustment Damage (Keluar 2)
      expect(card[3]?.type).toBe('DAMAGE_SPOILAGE');
      expect(card[3]?.qtyIn).toBe(0);
      expect(card[3]?.qtyOut).toBe(2);
      expect(card[3]?.runningBalance).toBe(23);
    });
  });
});
