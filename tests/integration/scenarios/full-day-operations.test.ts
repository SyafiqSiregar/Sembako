import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { type Clock, type IdGenerator } from '@/domain/time';
import { AuthService } from '@/services/auth.service';
import { CashierSessionService } from '@/services/session.service';
import { CatalogService } from '@/services/catalog.service';
import { CheckoutService } from '@/services/checkout.service';
import { HeldCartService } from '@/services/held-cart.service';
import { GoodsReceiptService } from '@/services/goods-receipt.service';
import { InventoryService } from '@/services/inventory.service';
import { BackupService } from '@/services/backup.service';
import { verifyDatabaseInvariants } from '@/domain/audit/verify-invariants';

describe('Skenario UAT: Satu Hari Operasional Penuh di Toko Sembako (Opsi 4, PRD §8)', () => {
  let mockTime = 1700000000000;
  let idSeq = 1;

  const mockClock: Clock = {
    now: () => mockTime,
    todayDateString: () => '2026-10-31',
  };

  const mockIdGen: IdGenerator = {
    generateId: () => `id-${idSeq++}`,
  };

  let authService: AuthService;
  let sessionService: CashierSessionService;
  let catalogService: CatalogService;
  let inventoryService: InventoryService;
  let checkoutService: CheckoutService;
  let heldCartService: HeldCartService;
  let goodsReceiptService: GoodsReceiptService;
  let backupService: BackupService;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    idSeq = 1;
    mockTime = 1700000000000;

    authService = new AuthService(db, mockClock, mockIdGen);
    sessionService = new CashierSessionService(db, mockClock, mockIdGen);
    catalogService = new CatalogService(db, mockClock, mockIdGen);
    inventoryService = new InventoryService(db, mockClock, mockIdGen);
    checkoutService = new CheckoutService(db, inventoryService, mockClock, mockIdGen);
    heldCartService = new HeldCartService(db, mockClock, mockIdGen);
    goodsReceiptService = new GoodsReceiptService(db, inventoryService, mockClock, mockIdGen);
    backupService = new BackupService(db, mockClock, mockIdGen);
  });

  it('menjalankan simulasi lengkap dari Buka Kas pagi, transaksi POS, kulakan, retur, tutup kas, hingga verifikasi 6 invarian', async () => {
    // =======================================================================
    // TAHAP 0: Inisialisasi Pengguna & Katalog Toko
    // =======================================================================
    const cashierUser = await authService.createUser({
      name: 'Budi (Kasir)',
      pin: '123456',
      roleCode: 'cashier',
      createdBy: 'system',
    });

    const ownerUser = await authService.createUser({
      name: 'Haji Ahmad (Owner)',
      pin: '999888',
      roleCode: 'owner',
      createdBy: 'system',
    });

    const sembakoCat = await catalogService.createCategory({
      name: 'Sembako Utama',
      createdBy: ownerUser.id,
    });

    // 1. Minyak Goreng 2L (Pouch)
    const minyakProd = await catalogService.createProduct({
      name: 'Minyak Goreng Sovia 2L',
      categoryId: sembakoCat.id,
      baseUnitKind: 'volume',
      baseUnitCode: 'ml',
      minStockBase: 10000,
      initialStockBase: 40000, // 20 Pouch @ 2000ml = 40.000ml
      createdBy: ownerUser.id,
      units: [
        {
          name: 'Pouch 2L',
          unitCode: 'pouch',
          conversionFactor: 2000,
          price: 34000,
          costX10k: 300000000,
          isBase: true,
        },
      ],
      barcodes: [
        { barcode: '899123456001', unitCode: 'pouch' },
      ],
    });

    // 2. Indomie Goreng (Multi-Satuan: Pcs & Dus isi 40) dengan Pelacakan Kedaluwarsa (Batch FEFO)
    const indomieProd = await catalogService.createProduct({
      name: 'Indomie Goreng Spesial',
      categoryId: sembakoCat.id,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      minStockBase: 40,
      trackExpiry: true,
      initialStockBase: 40, // Batch 1: 40 pcs exp 2027-01-01
      initialExpiryDate: '2027-01-01',
      initialBatchCode: 'BTH-IND-EARLY',
      createdBy: ownerUser.id,
      units: [
        {
          name: 'Bungkus',
          unitCode: 'pcs',
          conversionFactor: 1,
          price: 3500,
          costX10k: 30000000,
          isBase: true,
        },
        {
          name: 'Dus',
          unitCode: 'dus',
          conversionFactor: 40,
          price: 130000,
          costX10k: 1200000000,
          isBase: false,
        },
      ],
      barcodes: [
        { barcode: '899886611001', unitCode: 'pcs' },
        { barcode: '899886611040', unitCode: 'dus' },
      ],
    });

    // Tambahkan batch kedua Indomie yang expired lebih lama (2027-06-01)
    const batch2Id = mockIdGen.generateId();
    await db.product_batches.add({
      id: batch2Id,
      product_id: indomieProd.product.id,
      batch_code: 'BTH-IND-LATER',
      expiry_date: '2027-06-01',
      active: 1,
      created_at: mockTime,
    });
    await db.inventory_balances.add({
      product_id: indomieProd.product.id,
      batch_id: batch2Id,
      qty_base: 40,
      last_movement_at: mockTime,
    });
    // Record ledger movement for batch 2 initial balance
    const mov2Id = mockIdGen.generateId();
    await db.stock_movements.add({
      id: mov2Id,
      type: 'INITIAL_BALANCE',
      user_id: ownerUser.id,
      occurred_at: mockTime,
      reason: 'Batch kedua pembukaan toko',
    });
    await db.stock_movement_items.add({
      id: mockIdGen.generateId(),
      movement_id: mov2Id,
      product_id: indomieProd.product.id,
      batch_id: batch2Id,
      qty_delta_base: 40,
      unit_cost_x10k: 30000000,
      occurred_at: mockTime,
    });

    // 3. Beras Curah Repack (Akan dibuatkan Barcode Internal EAN-13 Awalan 20)
    const berasCurahProd = await catalogService.createProduct({
      name: 'Beras Curah Repack 1kg',
      categoryId: sembakoCat.id,
      baseUnitKind: 'weight',
      baseUnitCode: 'kg',
      minStockBase: 10,
      initialStockBase: 50, // 50 kg
      createdBy: ownerUser.id,
      units: [
        {
          name: 'Kilogram',
          unitCode: 'kg',
          conversionFactor: 1,
          price: 17500,
          costX10k: 150000000,
          isBase: true,
        },
      ],
    });

    // Generate Barcode Internal untuk Beras Curah (FR-CAT-11)
    const internalBcResult = await catalogService.assignInternalBarcode({
      actor: { id: ownerUser.id, name: ownerUser.name, role: 'owner' },
      productId: berasCurahProd.product.id,
      productUnitId: berasCurahProd.units[0]!.id,
    });
    expect(internalBcResult.barcode).toMatch(/^20\d{11}$/);

    // 4. Sabun Cuci Batang
    const sabunProd = await catalogService.createProduct({
      name: 'Sabun Cuci Batang Ekonomi',
      categoryId: sembakoCat.id,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      minStockBase: 5,
      initialStockBase: 20,
      createdBy: ownerUser.id,
      units: [
        {
          name: 'Batang',
          unitCode: 'pcs',
          conversionFactor: 1,
          price: 12000,
          costX10k: 100000000,
          isBase: true,
        },
      ],
      barcodes: [
        { barcode: '899999001', unitCode: 'pcs' },
      ],
    });

    // =======================================================================
    // TAHAP 1: Pukul 07:30 WIB - Buka Sesi Kasir Pagi (Modal Rp 200.000)
    // =======================================================================
    const session = await sessionService.openSession({
      userId: cashierUser.id,
      openingCash: 200000,
    });
    expect(session.status).toBe('open');
    expect(session.opening_cash).toBe(200000);

    // =======================================================================
    // TAHAP 2: Pukul 08:00 - 11:00 WIB - Gelombang Penjualan Kasir POS
    // =======================================================================

    // Transaksi 1: 2x Minyak Goreng 2L (@ Rp 34.000) = Rp 68.000 (Tunai Pas)
    const sale1 = await checkoutService.processCheckout({
      saleId: 'sale-uat-01',
      sessionId: session.id,
      cashierId: cashierUser.id,
      items: [
        {
          productId: minyakProd.product.id,
          productUnitId: minyakProd.units[0]!.id,
          nameSnapshot: minyakProd.product.name,
          unitCodeSnapshot: 'pouch',
          factorSnapshot: 2000,
          qtyBase: 4000, // 2 Pouch = 4000ml
          unitPriceSnapshot: 34000,
          unitCostX10kSnapshot: 300000000,
          discount: 0,
        },
      ],
      discountTotal: 0,
      paymentMethod: 'cash',
      amountPaid: 68000,
    });
    expect(sale1.sale.total).toBe(68000);

    // Transaksi 2: 1 Dus Indomie Goreng (40 pcs) = Rp 130.000 (Tunai)
    // FEFO harus otomatis memotong 40 pcs dari Batch 1 (BTH-IND-EARLY)
    const sale2 = await checkoutService.processCheckout({
      saleId: 'sale-uat-02',
      sessionId: session.id,
      cashierId: cashierUser.id,
      items: [
        {
          productId: indomieProd.product.id,
          productUnitId: indomieProd.units[1]!.id, // Satuan Dus
          nameSnapshot: indomieProd.product.name,
          unitCodeSnapshot: 'dus',
          factorSnapshot: 40,
          qtyBase: 40, // 1 Dus = 40 pcs
          unitPriceSnapshot: 130000,
          unitCostX10kSnapshot: 1200000000,
          discount: 0,
        },
      ],
      discountTotal: 0,
      paymentMethod: 'cash',
      amountPaid: 130000,
    });
    expect(sale2.sale.total).toBe(130000);

    // Verifikasi FEFO: Batch 1 (BTH-IND-EARLY) harus habis (saldo 0)
    const batch1 = await db.product_batches
      .where({ product_id: indomieProd.product.id, batch_code: 'BTH-IND-EARLY' })
      .first();
    expect(batch1).toBeDefined();

    const batch1Balance = await db.inventory_balances
      .where('[product_id+batch_id]')
      .equals([indomieProd.product.id, batch1!.id])
      .first();
    expect(batch1Balance?.qty_base).toBe(0);

    // Transaksi 3: 2 kg Beras Curah Repack (Barcode Internal) @ Rp 17.500 = Rp 35.000 (QRIS)
    const sale3 = await checkoutService.processCheckout({
      saleId: 'sale-uat-03',
      sessionId: session.id,
      cashierId: cashierUser.id,
      items: [
        {
          productId: berasCurahProd.product.id,
          productUnitId: berasCurahProd.units[0]!.id,
          nameSnapshot: berasCurahProd.product.name,
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          barcodeSnapshot: internalBcResult.barcode,
          qtyBase: 2,
          unitPriceSnapshot: 17500,
          unitCostX10kSnapshot: 150000000,
          discount: 0,
        },
      ],
      discountTotal: 0,
      paymentMethod: 'non_cash_manual',
      amountPaid: 35000,
      referenceNo: 'QRIS-99281726',
    });
    expect(sale3.sale.total).toBe(35000);
    expect(sale3.payment.method).toBe('non_cash_manual');

    // Transaksi 4: Skenario Keranjang Tahan (Hold Cart) & Diskon
    // A. Pelanggan A pesan 1x Beras Curah Rp 17.500, lalu ditahan (Hold Cart)
    const heldCart = await heldCartService.holdCart({
      userId: cashierUser.id,
      sessionId: session.id,
      note: 'Pelanggan A ambil barang tambahan',
      discountTotal: 0,
      items: [
        {
          productId: berasCurahProd.product.id,
          productUnitId: berasCurahProd.units[0]!.id,
          name: berasCurahProd.product.name,
          unitCode: 'kg',
          unitName: 'Kilogram',
          conversionFactor: 1,
          price: 17500,
          costX10k: 150000000,
          qty: 1,
          discount: 0,
          availableStockBase: 50,
        },
      ],
    });
    expect(heldCart.id).toBeDefined();

    // B. Kasir layani pelanggan B: 1x Sabun Cuci Rp 12.000 (Tunai)
    const salePelangganB = await checkoutService.processCheckout({
      saleId: 'sale-uat-04b',
      sessionId: session.id,
      cashierId: cashierUser.id,
      items: [
        {
          productId: sabunProd.product.id,
          productUnitId: sabunProd.units[0]!.id,
          nameSnapshot: sabunProd.product.name,
          unitCodeSnapshot: 'pcs',
          factorSnapshot: 1,
          qtyBase: 1,
          unitPriceSnapshot: 12000,
          unitCostX10kSnapshot: 100000000,
          discount: 0,
        },
      ],
      discountTotal: 0,
      paymentMethod: 'cash',
      amountPaid: 12000,
    });
    expect(salePelangganB.sale.total).toBe(12000);

    // C. Panggil kembali keranjang Pelanggan A, beri diskon Rp 5.000, selesaikan pembayaran
    await heldCartService.deleteHeldCart(heldCart.id);
    const sale4A = await checkoutService.processCheckout({
      saleId: 'sale-uat-04a',
      sessionId: session.id,
      cashierId: cashierUser.id,
      items: [
        {
          productId: berasCurahProd.product.id,
          productUnitId: berasCurahProd.units[0]!.id,
          nameSnapshot: berasCurahProd.product.name,
          unitCodeSnapshot: 'kg',
          factorSnapshot: 1,
          qtyBase: 4, // Ambil total 4 kg = Rp 70.000
          unitPriceSnapshot: 17500,
          unitCostX10kSnapshot: 150000000,
          discount: 0,
        },
      ],
      discountTotal: 5000, // Diskon Rp 5.000 -> Total Rp 65.000
      paymentMethod: 'cash',
      amountPaid: 65000,
    });
    expect(sale4A.sale.total).toBe(65000);

    // =======================================================================
    // TAHAP 3: Pukul 11:30 WIB - Penerimaan Barang Masuk (Goods Receipt)
    // =======================================================================
    // Pemasok kirim: 50 Pouch Minyak Goreng 2L (100.000ml) modal baru @ Rp 28.500
    await db.suppliers.add({
      id: 'sup_sumber_pangan',
      name: 'PT Sumber Pangan Sejahtera',
      active: 1,
      created_at: mockTime,
      created_by: ownerUser.id,
      updated_at: mockTime,
      updated_by: ownerUser.id,
    });

    await goodsReceiptService.createAndPostReceipt({
      supplierId: 'sup_sumber_pangan',
      supplierRefNo: 'FAK-20261031-99',
      receivedDate: '2026-10-31',
      receivedBy: ownerUser.id,
      items: [
        {
          productId: minyakProd.product.id,
          productUnitId: minyakProd.units[0]!.id,
          qtyBase: 100000, // 50 pouch * 2000 ml
          unitCostX10k: 285000000, // Rp 28.500 modal baru
        },
      ],
    });

    // Saldo Minyak Goreng harus bertambah (stok awal 40.000 - jual 4.000 + masuk 100.000 = 136.000 ml = 68 pouch)
    const minyakBalance = await inventoryService.getProductStock(minyakProd.product.id);
    expect(minyakBalance).toBe(136000);

    // =======================================================================
    // TAHAP 4: Pukul 14:00 WIB - Pengecualian Kasir (Void & Retur)
    // =======================================================================
    // 1. Void transaksi Pelanggan B (Sabun Cuci Rp 12.000)
    await checkoutService.voidSale({
      saleId: salePelangganB.sale.id,
      voidedBy: ownerUser.id,
      voidReason: 'Salah input barang pelanggan',
    });
    const voidedSale = await db.sales.get(salePelangganB.sale.id);
    expect(voidedSale?.status).toBe('voided');

    // 2. Retur 1 unit Minyak Goreng dari Transaksi 1 dengan kondisi 'damaged' (kemasan bocor)
    const returnResult = await checkoutService.processReturn({
      saleId: sale1.sale.id,
      returnedBy: cashierUser.id,
      reason: 'Kemasan pouch bocor saat dibawa',
      items: [
        {
          saleItemId: sale1.items[0]!.id,
          qtyBase: 2000, // 1 Pouch = 2000ml
          refundAmount: 34000,
          condition: 'damaged',
        },
      ],
    });
    expect(returnResult.totalRefund).toBe(34000);

    // =======================================================================
    // TAHAP 5: Pukul 16:30 WIB - Koreksi Barang Rusak (Damage / Spoilage)
    // =======================================================================
    // 1 bungkus Indomie rusak di toko dimusnahkan
    const indomieStockBefore = await inventoryService.getProductStock(indomieProd.product.id);
    await inventoryService.adjustStock({
      productId: indomieProd.product.id,
      batchId: batch2Id,
      newQtyBase: indomieStockBefore - 1,
      reasonType: 'DAMAGE_SPOILAGE',
      reason: 'Pemusnahan mie rusak di rak',
      userId: ownerUser.id,
    });

    // =======================================================================
    // TAHAP 6: Pukul 21:00 WIB - Tutup Kasir & Rekonsiliasi Kas
    // =======================================================================
    // Kalkulasi Kas Fisik Laci:
    // Modal Awal: Rp 200.000
    // + Tunai Trx 1: Rp 68.000
    // + Tunai Trx 2: Rp 130.000
    // + Tunai Trx 4A: Rp 65.000
    // - Refund Retur Tunai: -Rp 34.000
    // Total Diharapkan = 200.000 + 68.000 + 130.000 + 65.000 - 34.000 = Rp 429.000
    const closeSummary = await sessionService.closeSession({
      sessionId: session.id,
      closingCash: 429000, // Kasir hitung fisik pas Rp 429.000
      closedBy: cashierUser.id,
      notes: 'Sesi tutup rapi, uang fisik klop dengan sistem.',
    });
    expect(closeSummary.expectedCash).toBe(429000);
    expect(closeSummary.discrepancy).toBe(0);

    const closedSession = await db.cashier_sessions.get(session.id);
    expect(closedSession?.status).toBe('closed');
    expect(closedSession?.closing_cash).toBe(429000);

    // =======================================================================
    // TAHAP 7: Pukul 21:30 WIB - Pencadangan Database SHA-256
    // =======================================================================
    const backupResult = await backupService.exportBackup(ownerUser.id);
    expect(backupResult).toBeDefined();
    expect(backupResult.checksum).toBeDefined();
    expect(backupResult.checksum.length).toBe(64); // SHA-256 hex string
    expect(backupResult.jsonContent.length).toBeGreaterThan(0);

    // =======================================================================
    // TAHAP 8: Verifikasi 6 Invarian Database Wajib (DATABASE.md §5)
    // =======================================================================
    const invariantReport = await verifyDatabaseInvariants(db);

    // Seluruh 6 Invarian HARUS LULUS 100%
    expect(invariantReport.allPassed).toBe(true);
    for (const res of invariantReport.results) {
      expect(res.passed).toBe(true);
      expect(res.violations.length).toBe(0);
    }
  });
});
