import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { SupplierService } from '@/services/supplier.service';
import { GoodsReceiptService } from '@/services/goods-receipt.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('Integration: SupplierService & GoodsReceiptService (T3.04, T3.05, AC-20)', () => {
  let db: SembakoDatabase;
  let invService: InventoryService;
  let supplierService: SupplierService;
  let receiptService: GoodsReceiptService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  const userId = 'user-owner-1';
  const prodId = 'prod-tepung-01';
  const unitId = 'unit-tepung-kg';

  beforeEach(async () => {
    db = new SembakoDatabase(`test_sup_gr_${Date.now()}_${Math.random()}`);
    await db.open();

    clock = new FixedClock(1700000000000);
    idGen = new SequenceIdGenerator('gr');
    invService = new InventoryService(db, clock, idGen);
    supplierService = new SupplierService(db, clock, idGen);
    receiptService = new GoodsReceiptService(db, invService, clock, idGen);

    // Setup product & units with initial cost Rp 10.000 (100.000.000 x10k)
    await db.products.add({
      id: prodId,
      category_id: 'cat-sembako',
      sku: 'SKU-TPG-01',
      name: 'Tepung Terigu Segitiga Biru 1kg',
      base_unit_kind: 'weight',
      base_unit_code: 'kg',
      min_stock_base: 10,
      active: 1,
      track_expiry: 0,
      created_at: 1700000000000,
      created_by: userId,
      updated_at: 1700000000000,
      updated_by: userId,
      row_version: 1,
    });

    await db.product_units.add({
      id: unitId,
      product_id: prodId,
      unit_code: 'kg',
      name: 'Kilogram',
      conversion_factor: 1,
      price: 13000,
      cost_x10k: 100000000, // Rp 10.000
      is_base: 1,
      active: 1,
      created_at: 1700000000000,
      created_by: userId,
      updated_at: 1700000000000,
      updated_by: userId,
    });
  });

  describe('SupplierService (T3.04)', () => {
    it('membuat pemasok baru dan mengarsipkan tanpa menghapus fisik', async () => {
      const sup = await supplierService.createSupplier({
        name: 'CV Sumber Pangan Makmur',
        contactName: 'Pak Joko',
        phone: '081298765432',
        address: 'Jl. Pergudangan Indah No. 5',
        createdBy: userId,
      });

      expect(sup.id).toBeDefined();
      expect(sup.name).toBe('CV Sumber Pangan Makmur');
      expect(sup.active).toBe(1);

      const listActive = await supplierService.listSuppliers(true);
      expect(listActive.length).toBe(1);

      // Arsipkan pemasok
      await supplierService.archiveSupplier(sup.id, userId);

      const listAfter = await supplierService.listSuppliers(true);
      expect(listAfter.length).toBe(0); // tidak muncul di list aktif

      const all = await supplierService.listSuppliers(false);
      expect(all.length).toBe(1); // tetap ada di database
      expect(all[0]?.active).toBe(0);
    });
  });

  describe('GoodsReceiptService (T3.05, AC-20)', () => {
    it('memposting penerimaan barang, menambah stok via ledger, dan menghitung weighted average cost', async () => {
      // 1. Buat supplier
      const sup = await supplierService.createSupplier({
        name: 'PT Bogasari Distribusi',
        createdBy: userId,
      });

      // 2. Setup saldo stok awal: 20 kg @ Rp 10.000 (biaya x10k = 100.000.000)
      await invService.recordMovement({
        type: 'INITIAL_BALANCE',
        refType: 'opening',
        userId,
        reason: 'Saldo awal',
        items: [{ productId: prodId, qtyDeltaBase: 20, unitCostX10k: 100000000 }],
      });

      expect(await invService.getProductStock(prodId)).toBe(20);

      // 3. Penerimaan barang baru: 30 kg @ Rp 12.000 (biaya x10k = 120.000.000)
      // Rumus Weighted Average Cost:
      // (20 kg * 10.000 + 30 kg * 12.000) / (20 + 30) = (200.000 + 360.000) / 50 = 560.000 / 50 = Rp 11.200
      // 11.200 * 10.000 = 112.000.000 x10k
      const receiptRes = await receiptService.createAndPostReceipt({
        supplierId: sup.id,
        supplierRefNo: 'INV-BOG-2026-001',
        receivedDate: '2026-10-25',
        receivedBy: userId,
        items: [
          {
            productId: prodId,
            productUnitId: unitId,
            qtyBase: 30,
            unitCostX10k: 120000000,
          },
        ],
      });

      expect(receiptRes.receipt.receipt_no).toMatch(/^GR-20261025-\d{4}$/);
      expect(receiptRes.receipt.status).toBe('posted');

      // 4. Verifikasi saldo stok bertambah dari 20 jadi 50 kg
      const newStock = await invService.getProductStock(prodId);
      expect(newStock).toBe(50);

      // 5. Verifikasi pergerakan ledger tersimpan
      const movements = await db.stock_movements.where('type').equals('RECEIPT').toArray();
      expect(movements.length).toBe(1);

      // 6. Verifikasi moving weighted average cost terupdate ke Rp 11.200 (112.000.000 x10k)
      const updatedUnit = await db.product_units.get(unitId);
      expect(updatedUnit?.cost_x10k).toBe(112000000);

      // 7. Verifikasi price_history mencatat kenaikan biaya pokok
      const history = await db.price_history.where('product_unit_id').equals(unitId).toArray();
      expect(history.length).toBe(1);
      expect(history[0]?.old_price).toBe(10000);
      expect(history[0]?.new_price).toBe(11200);

      // 8. Verifikasi audit log
      const audit = await db.audit_logs.where('action').equals('goods_receipt.post').first();
      expect(audit).toBeDefined();
      expect(audit?.entity_id).toBe(receiptRes.receipt.id);
    });
  });
});
