import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { CatalogService } from '@/services/catalog.service';

describe('Service: CatalogService & Product (FR-CAT-01..05, AC-01, AC-10, AC-38, AC-39)', () => {
  let db: SembakoDatabase;
  let catalogService: CatalogService;
  let categoryId: string;

  beforeEach(async () => {
    db = new SembakoDatabase(`catalog_test_${Date.now()}_${Math.random()}`);
    await db.open();
    catalogService = new CatalogService(db);

    const cat = await catalogService.createCategory({
      name: 'Beras & Biji',
      createdBy: 'system',
    });
    categoryId = cat.id;
  });

  it('membuat produk baru lengkap dengan satuan dan barcode (FR-CAT-01..03)', async () => {
    const detail = await catalogService.createProduct({
      name: 'Beras Rojo Lele 5 kg',
      sku: 'BRS-001',
      categoryId,
      baseUnitKind: 'weight',
      baseUnitCode: 'g',
      minStockBase: 10000, // 10 kg
      trackExpiry: true,
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'sak',
          name: 'Sak 5 kg',
          conversionFactor: 5000,
          price: 72000,
          costX10k: 120000000, // Rp 12.000 / kg -> Rp 12 / g
          isBase: true,
        },
      ],
      barcodes: [
        {
          barcode: '8991234567890',
          unitCode: 'sak',
        },
      ],
    });

    expect(detail.product.id).toBeDefined();
    expect(detail.product.name).toBe('Beras Rojo Lele 5 kg');
    expect(detail.units.length).toBe(1);
    expect(detail.units[0]?.price).toBe(72000);
    expect(detail.barcodes.length).toBe(1);
    expect(detail.barcodes[0]?.barcode).toBe('8991234567890');
    expect(detail.totalStockBase).toBe(0);
  });

  it('menolak duplikasi barcode dengan menyebut nama produk pemilik barcode (AC-38)', async () => {
    // Buat produk A dengan barcode 112233
    await catalogService.createProduct({
      name: 'Gula Pasir Gulaku 1 kg',
      categoryId,
      baseUnitKind: 'weight',
      baseUnitCode: 'g',
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'bks',
          name: 'Bungkus 1 kg',
          conversionFactor: 1000,
          price: 17500,
          costX10k: 150000000,
          isBase: true,
        },
      ],
      barcodes: [
        {
          barcode: '112233',
          unitCode: 'bks',
        },
      ],
    });

    // Coba buat produk B dengan barcode yang sama
    await expect(
      catalogService.createProduct({
        name: 'Gula Pasir Rose Brand 1 kg',
        categoryId,
        baseUnitKind: 'weight',
        baseUnitCode: 'g',
        createdBy: 'owner-1',
        units: [
          {
            unitCode: 'bks',
            name: 'Bungkus 1 kg',
            conversionFactor: 1000,
            price: 17000,
            costX10k: 150000000,
            isBase: true,
          },
        ],
        barcodes: [
          {
            barcode: '112233',
            unitCode: 'bks',
          },
        ],
      })
    ).rejects.toThrow("Barcode '112233' sudah dipakai oleh produk 'Gula Pasir Gulaku 1 kg'");
  });

  it('mencatat riwayat perubahan harga saat harga jual diubah (AC-10, FR-CAT-09)', async () => {
    const created = await catalogService.createProduct({
      name: 'Minyak Goreng Sania 2 L',
      categoryId,
      baseUnitKind: 'volume',
      baseUnitCode: 'ml',
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'pch',
          name: 'Pouch 2 Liter',
          conversionFactor: 2000,
          price: 36000,
          costX10k: 150000000,
          isBase: true,
        },
      ],
    });

    // Update harga dari 36.000 ke 38.000
    await catalogService.updateProduct({
      id: created.product.id,
      updatedBy: 'owner-1',
      units: [
        {
          unitCode: 'pch',
          name: 'Pouch 2 Liter',
          conversionFactor: 2000,
          price: 38000,
          costX10k: 150000000,
        },
      ],
      priceChangeReason: 'Kenaikan harga dari distributor',
    });

    const priceHistories = await db.price_history.where('product_unit_id').equals(created.units[0]!.id).toArray();
    expect(priceHistories.length).toBe(1);
    expect(priceHistories[0]?.old_price).toBe(36000);
    expect(priceHistories[0]?.new_price).toBe(38000);
    expect(priceHistories[0]?.reason).toBe('Kenaikan harga dari distributor');
  });

  it('mengarsipkan produk tanpa menghapus data secara fisik (AC-39)', async () => {
    const created = await catalogService.createProduct({
      name: 'Tepung Terigu Segitiga Biru 1 kg',
      categoryId,
      baseUnitKind: 'weight',
      baseUnitCode: 'g',
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'bks',
          name: 'Bungkus',
          conversionFactor: 1000,
          price: 12000,
          costX10k: 100000000,
          isBase: true,
        },
      ],
    });

    await catalogService.archiveProduct(created.product.id, 'owner-1');

    const productInDb = await db.products.get(created.product.id);
    expect(productInDb).toBeDefined();
    expect(productInDb?.active).toBe(0); // Status nonaktif/diarsipkan
  });

  it('pencarian instan berdasarkan barcode mengembalikan produk dan satuan yang tepat (AC-01)', async () => {
    await catalogService.createProduct({
      name: 'Kopi Kapal Api Special 65g',
      categoryId,
      baseUnitKind: 'count',
      baseUnitCode: 'pcs',
      createdBy: 'owner-1',
      units: [
        {
          unitCode: 'pcs',
          name: 'Pcs',
          conversionFactor: 1,
          price: 6500,
          costX10k: 50000000,
          isBase: true,
        },
      ],
      barcodes: [
        {
          barcode: '8991001002003',
          unitCode: 'pcs',
        },
      ],
    });

    const found = await catalogService.getProductByBarcode('8991001002003');
    expect(found).toBeDefined();
    expect(found?.product.name).toBe('Kopi Kapal Api Special 65g');
    expect(found?.unit.price).toBe(6500);
  });
});
