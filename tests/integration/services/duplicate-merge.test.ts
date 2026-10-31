import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { CatalogService } from '@/services/catalog.service';
import { InventoryService } from '@/services/inventory.service';
import { type Clock } from '@/domain/time';

class MockClock implements Clock {
  currentTime = 1700000000000;
  now(): number {
    return this.currentTime;
  }
  todayDateString(): string {
    return '2026-10-31';
  }
}

describe('Service: CatalogService Duplicate Scan & Merge (AC-39, BR-18)', () => {
  let db: SembakoDatabase;
  let catalogService: CatalogService;
  let inventoryService: InventoryService;
  let clock: MockClock;

  beforeEach(async () => {
    db = new SembakoDatabase(`dupe_test_${Date.now()}_${Math.random()}`);
    await db.open();
    clock = new MockClock();
    inventoryService = new InventoryService(db, clock);
    catalogService = new CatalogService(db, clock, undefined, inventoryService);
  });

  it('mendeteksi kandidat duplikat dan menggabungkan stok serta mengarsipkan produk keliru secara atomik', async () => {
    // 1. Buat kategori
    const cat = await catalogService.createCategory({ name: 'Makanan Instan', createdBy: 'admin' });

    // 2. Buat Produk A (Utama)
    const prodA = await catalogService.createProduct({
      name: 'Indomie Goreng 85g',
      categoryId: cat.id,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      createdBy: 'admin',
      units: [
        {
          unitCode: 'pcs',
          name: 'Bungkus',
          conversionFactor: 1,
          price: 3500,
          costX10k: 29000000,
          isBase: true,
        },
      ],
      barcodes: [{ barcode: '089686010014', unitCode: 'pcs' }],
    });

    // 3. Buat Produk B (Duplikat keliru, tanpa barcode)
    const prodB = await catalogService.createProduct({
      name: 'Indomie Goreng 85gr',
      categoryId: cat.id,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      createdBy: 'admin',
      units: [
        {
          unitCode: 'pcs',
          name: 'Bungkus',
          conversionFactor: 1,
          price: 3500,
          costX10k: 29000000,
          isBase: true,
        },
      ],
      barcodes: [],
    });

    // 4. Beri stok awal: Prod A = 40 pcs, Prod B = 10 pcs
    await inventoryService.recordMovement({
      type: 'INITIAL_BALANCE',
      userId: 'admin',
      reason: 'Stok awal',
      items: [
        { productId: prodA.product.id, qtyDeltaBase: 40, unitCostX10k: 29000000 },
        { productId: prodB.product.id, qtyDeltaBase: 10, unitCostX10k: 29000000 },
      ],
    });

    // 5. Scan duplikat
    const dupes = await catalogService.scanDuplicates();
    expect(dupes.length).toBeGreaterThanOrEqual(1);

    const match = dupes.find((d) => d.products.some((p) => p.id === prodA.product.id));
    expect(match).toBeDefined();

    // 6. Jalankan penggabungan: Prod B digabung ke Prod A
    const result = await catalogService.mergeDuplicateProduct({
      primaryProductId: prodA.product.id,
      duplicateProductId: prodB.product.id,
      actor: { id: 'admin', roles: ['owner'] },
    });

    expect(result.transferredStock).toBe(10);
    expect(result.primaryName).toBe('Indomie Goreng 85g');

    // 7. Verifikasi stok fisik Prod A bertambah jadi 50, Prod B jadi 0
    const stockA = await inventoryService.getProductStock(prodA.product.id);
    const stockB = await inventoryService.getProductStock(prodB.product.id);
    expect(stockA).toBe(50);
    expect(stockB).toBe(0);

    // 8. Verifikasi Prod B berstatus archived (active: 0) dan Prod A tetap active: 1 (AC-39)
    const updatedProdA = await db.products.get(prodA.product.id);
    const updatedProdB = await db.products.get(prodB.product.id);
    expect(updatedProdA?.active).toBe(1);
    expect(updatedProdB?.active).toBe(0);

    // 9. Verifikasi audit log tercatat
    const auditLogs = await db.audit_logs
      .where('action')
      .equals('catalog.product_merge_duplicate')
      .toArray();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.entity_id).toBe(prodB.product.id);
  });
});
