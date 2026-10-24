import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { CheckoutService } from '@/services/checkout.service';
import { HeldCartService } from '@/services/held-cart.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('Integration: HeldCartService & ProcessReturn (AC-05, AC-08)', () => {
  let db: SembakoDatabase;
  let invService: InventoryService;
  let checkoutService: CheckoutService;
  let heldCartService: HeldCartService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  const sessionId = 'session-pos-02';
  const cashierId = 'user-kasir-2';
  const prodId = 'prod-telur-01';

  beforeEach(async () => {
    db = new SembakoDatabase(`test_pos_features_${Date.now()}_${Math.random()}`);
    await db.open();

    clock = new FixedClock(1700000000000);
    idGen = new SequenceIdGenerator('pos');
    invService = new InventoryService(db, clock, idGen);
    checkoutService = new CheckoutService(db, invService, clock, idGen);
    heldCartService = new HeldCartService(db, clock, idGen);

    // Setup active cashier session
    await db.cashier_sessions.add({
      id: sessionId,
      user_id: cashierId,
      opened_at: 1700000000000,
      opening_cash: 100000,
      status: 'open',
    });

    // Setup product & initial stock
    await db.products.add({
      id: prodId,
      category_id: 'cat-sembako',
      sku: 'SKU-TELUR-01',
      name: 'Telur Ayam 1kg',
      base_unit_kind: 'weight',
      base_unit_code: 'kg',
      min_stock_base: 10,
      active: 1,
      track_expiry: 0,
      created_at: 1700000000000,
      created_by: cashierId,
      updated_at: 1700000000000,
      updated_by: cashierId,
      row_version: 1,
    });

    // Inisialisasi saldo awal 30 kg
    await invService.recordMovement({
      type: 'RECEIPT',
      refType: 'goods_receipt',
      refId: 'gr-initial-02',
      userId: cashierId,
      reason: 'Saldo awal telur',
      items: [
        {
          productId: prodId,
          qtyDeltaBase: 30,
          unitCostX10k: 240000000, // Rp 24.000
        },
      ],
    });
  });

  describe('HeldCartService (AC-05)', () => {
    it('dapat menahan keranjang dan mengambil daftar keranjang tertahan', async () => {
      const held = await heldCartService.holdCart({
        userId: cashierId,
        sessionId,
        note: 'Ibu Budi - ambil uang di ATM',
        items: [
          {
            productId: prodId,
            productUnitId: 'unit-kg',
            name: 'Telur Ayam 1kg',
            unitCode: 'kg',
            unitName: 'Kilogram',
            conversionFactor: 1,
            price: 28000,
            costX10k: 240000000,
            qty: 2,
            discount: 0,
            availableStockBase: 30,
          },
        ],
        discountTotal: 0,
      });

      expect(held.id).toBeDefined();
      expect(held.name).toBe('Ibu Budi - ambil uang di ATM');

      const carts = await heldCartService.getHeldCarts();
      expect(carts.length).toBe(1);
      expect(carts[0]?.id).toBe(held.id);

      // Hapus keranjang setelah dipulihkan
      await heldCartService.deleteHeldCart(held.id);
      const remaining = await heldCartService.getHeldCarts();
      expect(remaining.length).toBe(0);
    });

    it('menolak menahan keranjang belanja yang kosong', async () => {
      await expect(
        heldCartService.holdCart({
          userId: cashierId,
          sessionId,
          items: [],
          discountTotal: 0,
        })
      ).rejects.toThrow(/Tidak dapat menahan keranjang yang kosong/);
    });
  });

  describe('ProcessReturn (AC-08)', () => {
    it('memproses retur pelanggan: menambah kembali stok dan mengupdate status penjualan', async () => {
      // 1. Jual 5 kg telur
      const saleResult = await checkoutService.processCheckout({
        saleId: 'sale-ret-test-01',
        sessionId,
        cashierId,
        items: [
          {
            productId: prodId,
            productUnitId: 'unit-kg',
            nameSnapshot: 'Telur Ayam 1kg',
            unitCodeSnapshot: 'kg',
            factorSnapshot: 1,
            qtyBase: 5,
            unitPriceSnapshot: 28000,
            unitCostX10kSnapshot: 240000000,
          },
        ],
        paymentMethod: 'cash',
        amountPaid: 150000,
      });

      // Saldo setelah jual: 30 - 5 = 25
      expect(await invService.getProductStock(prodId)).toBe(25);

      const saleItem = saleResult.items[0]!;

      // 2. Pelanggan retur 2 kg telur (pecah 2 butir saat bawa)
      const returnResult = await checkoutService.processReturn({
        saleId: 'sale-ret-test-01',
        returnedBy: cashierId,
        reason: 'Telur ada yang retak di kantong kresek',
        items: [
          {
            saleItemId: saleItem.id,
            qtyBase: 2,
            refundAmount: 56000, // 2 x 28.000
          },
        ],
      });

      expect(returnResult.returnNo).toBeDefined();
      expect(returnResult.totalRefund).toBe(56000);

      // 3. Verifikasi saldo stok bertambah kembali: 25 + 2 = 27
      expect(await invService.getProductStock(prodId)).toBe(27);

      // 4. Verifikasi status penjualan berubah jadi partially_returned
      const updatedSale = await db.sales.get('sale-ret-test-01');
      expect(updatedSale?.status).toBe('partially_returned');

      // 5. Coba retur melebihi sisa pembelian (sisa cuma 3, coba retur 4) -> harus gagal!
      await expect(
        checkoutService.processReturn({
          saleId: 'sale-ret-test-01',
          returnedBy: cashierId,
          reason: 'Coba retur lebih dari yang dibeli',
          items: [
            {
              saleItemId: saleItem.id,
              qtyBase: 4,
              refundAmount: 112000,
            },
          ],
        })
      ).rejects.toThrow(/melebihi batas/);
    });
  });
});
