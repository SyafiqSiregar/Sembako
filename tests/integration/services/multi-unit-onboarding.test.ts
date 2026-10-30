import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { CatalogService } from '@/services/catalog.service';
import { InventoryService } from '@/services/inventory.service';
import { CheckoutService } from '@/services/checkout.service';
import { ProductSearchIndex } from '@/data/search/product-search';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('Integration: Multi-Unit Onboarding & Wholesale Conversion (Eceran & Dus)', () => {
  let db: SembakoDatabase;
  let catalogService: CatalogService;
  let invService: InventoryService;
  let checkoutService: CheckoutService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;
  let categoryId: string;

  beforeEach(async () => {
    db = new SembakoDatabase(`multi_unit_test_${Date.now()}_${Math.random()}`);
    await db.open();

    clock = new FixedClock(1700000000000);
    idGen = new SequenceIdGenerator('mu');
    invService = new InventoryService(db, clock, idGen);
    catalogService = new CatalogService(db, clock, idGen);
    checkoutService = new CheckoutService(db, invService, clock, idGen);

    const cat = await catalogService.createCategory({
      name: 'Mie & Makanan Instan',
      createdBy: 'owner-1',
    });
    categoryId = cat.id;

    // Buka sesi kasir aktif
    await db.cashier_sessions.add({
      id: 'session-mu-1',
      user_id: 'cashier-1',
      opened_at: 1700000000000,
      opening_cash: 200000,
      status: 'open',
    });
  });

  it('berhasil membuat barang dengan satuan eceran (Pcs) dan grosir (Dus isi 40) dengan barcode terpisah', async () => {
    const product = await catalogService.createProduct({
      name: 'Indomie Goreng Spesial 85g',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      minStockBase: 40,
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'pcs',
          name: 'Pcs',
          conversionFactor: 1,
          price: 3500,
          costX10k: 30000000, // Rp 3.000 modal
          isBase: true,
        },
        {
          unitCode: 'dus',
          name: 'Dus',
          conversionFactor: 40,
          price: 130000,
          costX10k: 1200000000, // Rp 120.000 modal
          isBase: false,
        },
      ],
      barcodes: [
        { barcode: '089686010018', unitCode: 'pcs' },
        { barcode: '089686010025', unitCode: 'dus' },
      ],
    });

    expect(product.product.name).toBe('Indomie Goreng Spesial 85g');
    expect(product.units.length).toBe(2);

    const baseUnit = product.units.find((u) => u.is_base === 1);
    expect(baseUnit?.unit_code).toBe('pcs');
    expect(baseUnit?.price).toBe(3500);

    const wholesaleUnit = product.units.find((u) => u.unit_code === 'dus');
    expect(wholesaleUnit?.conversion_factor).toBe(40);
    expect(wholesaleUnit?.price).toBe(130000);

    // Verifikasi kedua barcode terdaftar dengan unit_id yang tepat
    expect(product.barcodes.length).toBe(2);
    const bcBase = product.barcodes.find((b) => b.barcode === '089686010018');
    const bcDus = product.barcodes.find((b) => b.barcode === '089686010025');
    expect(bcBase?.product_unit_id).toBe(baseUnit?.id);
    expect(bcDus?.product_unit_id).toBe(wholesaleUnit?.id);
  });

  it('ProductSearchIndex mencocokkan barcode eceran vs barcode dus ke satuan kemasan yang tepat', async () => {
    const product = await catalogService.createProduct({
      name: 'Indomie Kuah Soto 80g',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'pcs',
          name: 'Pcs',
          conversionFactor: 1,
          price: 3500,
          costX10k: 30000000,
          isBase: true,
        },
        {
          unitCode: 'dus',
          name: 'Dus',
          conversionFactor: 40,
          price: 132000,
          costX10k: 1200000000,
          isBase: false,
        },
      ],
      barcodes: [
        { barcode: '899886611001', unitCode: 'pcs' },
        { barcode: '899886611040', unitCode: 'dus' },
      ],
    });

    const index = new ProductSearchIndex();
    index.setItems([product]);

    // Scan barcode bungkus
    const hitPcs = index.searchBarcode('899886611001');
    expect(hitPcs).toBeDefined();
    expect(hitPcs?.matchedUnit.unit_code).toBe('pcs');
    expect(hitPcs?.matchedUnit.price).toBe(3500);

    // Scan barcode kardus
    const hitDus = index.searchBarcode('899886611040');
    expect(hitDus).toBeDefined();
    expect(hitDus?.matchedUnit.unit_code).toBe('dus');
    expect(hitDus?.matchedUnit.conversion_factor).toBe(40);
    expect(hitDus?.matchedUnit.price).toBe(132000);
  });

  it('berhasil mengupdate produk yang tadinya hanya eceran dengan menambahkan satuan dus dan barcode kardusnya', async () => {
    // 1. Buat produk eceran saja
    const initial = await catalogService.createProduct({
      name: 'Kopi Kapal Api Spesial Mix',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'sch',
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'sch',
          name: 'Sachet',
          conversionFactor: 1,
          price: 1500,
          costX10k: 12000000,
          isBase: true,
        },
      ],
      barcodes: [{ barcode: '8991001001', unitCode: 'sch' }],
    });

    expect(initial.units.length).toBe(1);

    // 2. Pemilik toko menambahkan satuan Renceng (isi 10)
    const updated = await catalogService.updateProduct({
      id: initial.product.id,
      updatedBy: 'owner-1',
      units: [
        {
          unitCode: 'sch',
          name: 'Sachet',
          conversionFactor: 1,
          price: 1500,
          costX10k: 12000000,
          isBase: true,
        },
        {
          unitCode: 'rcg',
          name: 'Renceng',
          conversionFactor: 10,
          price: 14000,
          costX10k: 120000000,
          isBase: false,
        },
      ],
      barcodes: [
        { barcode: '8991001001', unitCode: 'sch' },
        { barcode: '8991001010', unitCode: 'rcg' },
      ],
    });

    expect(updated.units.length).toBe(2);
    const rcgUnit = updated.units.find((u) => u.unit_code === 'rcg');
    expect(rcgUnit?.conversion_factor).toBe(10);
    expect(rcgUnit?.price).toBe(14000);

    const rcgBarcode = updated.barcodes.find((b) => b.barcode === '8991001010');
    expect(rcgBarcode?.product_unit_id).toBe(rcgUnit?.id);
  });

  it('penjualan 1 Dus (isi 40) memotong 40 unit dasar di saldo inventaris tunggal secara atomik', async () => {
    // 1. Buat produk multi-satuan
    const prodDetail = await catalogService.createProduct({
      name: 'Mie Sedaap Goreng',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'pcs',
          name: 'Pcs',
          conversionFactor: 1,
          price: 3500,
          costX10k: 30000000,
          isBase: true,
        },
        {
          unitCode: 'dus',
          name: 'Dus',
          conversionFactor: 40,
          price: 130000,
          costX10k: 1200000000,
          isBase: false,
        },
      ],
    });

    const dusUnit = prodDetail.units.find((u) => u.unit_code === 'dus')!;
    const pcsUnit = prodDetail.units.find((u) => u.unit_code === 'pcs')!;

    // 2. Terima stok awal 100 pcs di saldo inventaris tunggal
    await invService.recordMovement({
      type: 'RECEIPT',
      refType: 'goods_receipt',
      refId: 'gr-01',
      userId: 'clerk-1',
      reason: 'Penerimaan stok awal',
      items: [
        {
          productId: prodDetail.product.id,
          qtyDeltaBase: 100,
          unitCostX10k: 30000000,
        },
      ],
    });

    const initialBalances = await db.inventory_balances.where('product_id').equals(prodDetail.product.id).toArray();
    expect(initialBalances[0]?.qty_base).toBe(100);

    // 3. Pelanggan membeli: 1 Dus (40 pcs) + 2 Bungkus eceran (2 pcs)
    const result = await checkoutService.processCheckout({
      saleId: 'sale-mu-test-01',
      sessionId: 'session-mu-1',
      cashierId: 'cashier-1',
      items: [
        {
          productId: prodDetail.product.id,
          productUnitId: dusUnit.id,
          nameSnapshot: prodDetail.product.name,
          unitCodeSnapshot: dusUnit.unit_code,
          factorSnapshot: dusUnit.conversion_factor, // 40
          qtyBase: 1 * dusUnit.conversion_factor, // 40 pcs
          unitPriceSnapshot: dusUnit.price, // 130.000
          unitCostX10kSnapshot: dusUnit.cost_x10k,
          discount: 0,
        },
        {
          productId: prodDetail.product.id,
          productUnitId: pcsUnit.id,
          nameSnapshot: prodDetail.product.name,
          unitCodeSnapshot: pcsUnit.unit_code,
          factorSnapshot: pcsUnit.conversion_factor, // 1
          qtyBase: 2 * pcsUnit.conversion_factor, // 2 pcs
          unitPriceSnapshot: pcsUnit.price, // 3.500
          unitCostX10kSnapshot: pcsUnit.cost_x10k,
          discount: 0,
        },
      ],
      discountTotal: 0,
      paymentMethod: 'cash',
      amountPaid: 150000, // Total = 130.000 + 7.000 = 137.000
    });

    expect(result.sale.total).toBe(137000);
    expect(result.change).toBe(13000);

    // 4. Periksa saldo akhir di inventaris tunggal:
    // Saldo awal 100 - (1*40 + 2*1) = 100 - 42 = 58 pcs
    const finalBalances = await db.inventory_balances.where('product_id').equals(prodDetail.product.id).toArray();
    expect(finalBalances[0]?.qty_base).toBe(58);
  });
});
