import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { CheckoutService, type CheckoutParams } from '@/services/checkout.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('Integration: CheckoutService Atomik & Idempoten', () => {
  let db: SembakoDatabase;
  let invService: InventoryService;
  let checkoutService: CheckoutService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  const sessionId = 'session-pos-01';
  const cashierId = 'user-kasir-1';
  const prodId = 'prod-gula-01';

  beforeEach(async () => {
    db = new SembakoDatabase(`test_checkout_${Date.now()}_${Math.random()}`);
    await db.open();

    clock = new FixedClock(1700000000000); // 2023-11-14T22:13:20.000Z
    idGen = new SequenceIdGenerator('ck');
    invService = new InventoryService(db, clock, idGen);
    checkoutService = new CheckoutService(db, invService, clock, idGen);

    // Setup active cashier session
    await db.cashier_sessions.add({
      id: sessionId,
      user_id: cashierId,
      opened_at: 1700000000000,
      opening_cash: 200000,
      status: 'open',
    });

    // Setup product & initial stock
    await db.products.add({
      id: prodId,
      category_id: 'cat-sembako',
      sku: 'SKU-GULA-01',
      name: 'Gula Pasir Kristal 1kg',
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

    // Inisialisasi saldo awal 50 kg melalui InventoryService (GR)
    await invService.recordMovement({
      type: 'RECEIPT',
      refType: 'goods_receipt',
      refId: 'gr-initial-01',
      userId: cashierId,
      reason: 'Saldo awal gudang & toko',
      items: [
        {
          productId: prodId,
          qtyDeltaBase: 50,
          unitCostX10k: 125000000, // Rp 12.500
        },
      ],
    });
  });

  it('berhasil memproses penjualan atomik: mengurangi stok via ledger dan mencatat transaksi', async () => {
    const saleId = 'sale-trx-001';
    const params: CheckoutParams = {
      saleId,
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 5,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
          discount: 0,
        },
      ],
      discountTotal: 0,
      paymentMethod: 'cash',
      amountPaid: 100000,
    };

    const result = await checkoutService.processCheckout(params);

    // 1. Verifikasi hasil checkout
    expect(result.sale.id).toBe(saleId);
    expect(result.sale.subtotal).toBe(80000); // 5 x 16.000
    expect(result.sale.total).toBe(80000);
    expect(result.payment.amount).toBe(100000);
    expect(result.change).toBe(20000);
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.qty_base).toBe(5);

    // 2. Verifikasi saldo stok berkurang dari 50 menjadi 45
    const balance = await db.inventory_balances.where('product_id').equals(prodId).first();
    expect(balance?.qty_base).toBe(45);
    expect(await invService.getProductStock(prodId)).toBe(45);

    // 3. Verifikasi riwayat mutasi stok (SALE movement)
    const movements = await db.stock_movements.where('[ref_type+ref_id]').equals(['sale', saleId]).toArray();
    expect(movements.length).toBe(1);
    expect(movements[0]?.type).toBe('SALE');

    const movementItems = await db.stock_movement_items.where('movement_id').equals(movements[0]!.id).toArray();
    expect(movementItems.length).toBe(1);
    expect(movementItems[0]?.qty_delta_base).toBe(-5);
  });

  it('mencegah double charge saat idempotensi dipanggil ulang dengan saleId yang sama', async () => {
    const saleId = 'sale-trx-idempotent';
    const params: CheckoutParams = {
      saleId,
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 2,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 50000,
    };

    // Panggilan pertama
    const res1 = await checkoutService.processCheckout(params);
    expect(res1.sale.total).toBe(32000);

    // Cek saldo setelah panggilan pertama: 50 - 2 = 48
    let balance = await db.inventory_balances.where('product_id').equals(prodId).first();
    expect(balance?.qty_base).toBe(48);

    // Panggilan kedua (kasir klik Bayar 2x berturut-turut)
    const res2 = await checkoutService.processCheckout(params);
    expect(res2.sale.id).toBe(saleId);
    expect(res2.sale.receipt_no).toBe(res1.sale.receipt_no);

    // Saldo tetap 48, tidak terpotong dua kali!
    balance = await db.inventory_balances.where('product_id').equals(prodId).first();
    expect(balance?.qty_base).toBe(48);
  });

  it('menolak checkout jika uang tunai yang dibayar kurang dari total', async () => {
    const params: CheckoutParams = {
      saleId: 'sale-trx-kurang-uang',
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 2,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 30000, // Total = 32.000, uang kurang 2.000
    };

    await expect(checkoutService.processCheckout(params)).rejects.toThrow(/Uang pembayaran kurang/);
  });

  it('melakukan rollback atomik bila stok gudang/toko tidak mencukupi', async () => {
    const params: CheckoutParams = {
      saleId: 'sale-trx-insufficient-stock',
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 100, // Stok cuma 50
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 1600000,
    };

    await expect(checkoutService.processCheckout(params)).rejects.toThrow(/Stok tidak mencukupi/);

    // Pastikan tidak ada data sampah di sales, sale_items, payments, ataupun stock_movements
    const sale = await db.sales.get('sale-trx-insufficient-stock');
    expect(sale).toBeUndefined();

    // Saldo tetap utuh 50
    const balance = await db.inventory_balances.where('product_id').equals(prodId).first();
    expect(balance?.qty_base).toBe(50);
  });

  it('voidSale membatalkan penjualan, mengembalikan saldo stok via reversal movement, dan mencatat audit log', async () => {
    const saleId = 'sale-trx-to-void';
    await checkoutService.processCheckout({
      saleId,
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 10,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 160000,
    });

    // Saldo berkurang: 50 - 10 = 40
    let balance = await db.inventory_balances.where('product_id').equals(prodId).first();
    expect(balance?.qty_base).toBe(40);

    // Lakukan void oleh supervisor
    const supervisorId = 'user-spv-1';
    const voidedSale = await checkoutService.voidSale({
      saleId,
      voidedBy: supervisorId,
      voidReason: 'Pelanggan salah bawa barang & membatalkan pembelian',
    });

    expect(voidedSale.status).toBe('voided');
    expect(voidedSale.void_reason).toBe('Pelanggan salah bawa barang & membatalkan pembelian');

    // Saldo kembali utuh 50!
    balance = await db.inventory_balances.where('product_id').equals(prodId).first();
    expect(balance?.qty_base).toBe(50);

    // Periksa movement reversal
    const voidMovements = await db.stock_movements.where('type').equals('SALE_VOID').toArray();
    expect(voidMovements.length).toBe(1);

    // Periksa audit log
    const auditLogs = await db.audit_logs.where('action').equals('sale.void').toArray();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.user_id).toBe(supervisorId);
    expect(auditLogs[0]?.entity_id).toBe(saleId);
  });

  it('berhasil memproses penjualan non-tunai manual (QRIS/Transfer) dengan nomor referensi (FR-POS-18)', async () => {
    const saleId = 'sale-trx-noncash-01';
    const params: CheckoutParams = {
      saleId,
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 2,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      discountTotal: 0,
      paymentMethod: 'non_cash_manual',
      amountPaid: 32000,
      referenceNo: 'QRIS - Ref: RRN-889977',
    };

    const result = await checkoutService.processCheckout(params);

    expect(result.sale.id).toBe(saleId);
    expect(result.sale.total).toBe(32000);
    expect(result.change).toBe(0);
    expect(result.payment.method).toBe('non_cash_manual');
    expect(result.payment.amount).toBe(32000);
    expect(result.payment.reference_no).toBe('QRIS - Ref: RRN-889977');

    // Verifikasi data di IndexedDB
    const paymentInDb = await db.payments.where('sale_id').equals(saleId).first();
    expect(paymentInDb?.method).toBe('non_cash_manual');
    expect(paymentInDb?.reference_no).toBe('QRIS - Ref: RRN-889977');

    // Saldo berkurang dari 50 ke 48
    const balance = await db.inventory_balances.where('product_id').equals(prodId).first();
    expect(balance?.qty_base).toBe(48);
  });

  it('AC-28: retur barang layak jual menambah stok jual, barang rusak dicatat write-off tanpa menambah stok jual', async () => {
    const saleId = 'sale-ret-ac28';
    const checkRes = await checkoutService.processCheckout({
      saleId,
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 4,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 64000,
    });

    // Saldo setelah jual: 50 - 4 = 46
    expect(await invService.getProductStock(prodId)).toBe(46);

    const saleItem = checkRes.items[0]!;

    // Pelanggan retur 2 unit: 1 layak jual + 1 rusak (kemasan sobek/basah)
    const retRes = await checkoutService.processReturn({
      saleId,
      returnedBy: cashierId,
      reason: '1 bungkus basah terkena hujan saat dibawa, 1 bungkus masih utuh',
      items: [
        {
          saleItemId: saleItem.id,
          qtyBase: 1,
          refundAmount: 16000,
          condition: 'sellable',
        },
        {
          saleItemId: saleItem.id,
          qtyBase: 1,
          refundAmount: 16000,
          condition: 'damaged',
        },
      ],
    });

    expect(retRes.totalRefund).toBe(32000);

    // Saldo stok fisik HANYA bertambah 1 untuk yang layak jual: 46 + 1 = 47 (AC-28)
    expect(await invService.getProductStock(prodId)).toBe(47);

    // Verifikasi movement RETURN_WRITE_OFF tercatat
    const writeOffMovements = await db.stock_movements.where('type').equals('RETURN_WRITE_OFF').toArray();
    expect(writeOffMovements.length).toBe(1);

    // Verifikasi integritas rekonsiliasi ledger tetap 100% konsisten (Invarian INV-01, AC-24)
    const integrity = await invService.reconcileStockLedger(prodId);
    expect(integrity.isConsistent).toBe(true);
    expect(integrity.ledgerTotal).toBe(47);
  });

  it('BR-18: menolak retur barang jika melebihi batas waktu returnDaysLimit', async () => {
    const saleId = 'sale-ret-expired-limit';
    await checkoutService.processCheckout({
      saleId,
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 1,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 16000,
    });

    // Ubah tanggal penjualan menjadi 10 hari yang lalu (melebihi default limit 7 hari)
    const tenDaysAgo = clock.now() - 10 * 24 * 60 * 60 * 1000;
    await db.sales.update(saleId, { completed_at: tenDaysAgo });

    const saleItem = await db.sale_items.where('sale_id').equals(saleId).first();

    await expect(
      checkoutService.processReturn({
        saleId,
        returnedBy: cashierId,
        reason: 'Barang tidak jadi dipakai',
        items: [
          {
            saleItemId: saleItem!.id,
            qtyBase: 1,
            refundAmount: 16000,
          },
        ],
      })
    ).rejects.toThrow(/melebihi batas waktu 7 hari/);
  });

  it('BR-17: menolak void transaksi jika sesi kasir sudah ditutup', async () => {
    const saleId = 'sale-to-void-closed-session';
    await checkoutService.processCheckout({
      saleId,
      sessionId,
      cashierId,
      items: [
        {
          productId: prodId,
          productUnitId: 'unit-kg',
          nameSnapshot: 'Gula Pasir Kristal 1kg',
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 1,
          unitPriceSnapshot: 16000,
          unitCostX10kSnapshot: 125000000,
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 16000,
    });

    // Tutup sesi kasir
    await db.cashier_sessions.update(sessionId, { status: 'closed' });

    // Coba void struk dari sesi yang sudah ditutup -> harus ditolak dan disarankan memakai retur
    await expect(
      checkoutService.voidSale({
        saleId,
        voidedBy: 'user-spv-1',
        voidReason: 'Salah input',
      })
    ).rejects.toThrow(/sesi kas yang sudah ditutup tidak dapat di-void.*Retur/);
  });
});

