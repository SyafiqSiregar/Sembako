import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { CatalogService } from '@/services/catalog.service';
import { type Clock, type IdGenerator } from '@/domain/time';

describe('Integration: CatalogService.assignInternalBarcode (FR-CAT-11, BC-I01..BC-I08)', () => {
  let catalogService: CatalogService;
  let mockTime = 1700000000000;
  let idCounter = 1;

  const mockClock: Clock = {
    now: () => mockTime,
    todayDateString: () => '2026-10-31',
  };

  const mockIdGen: IdGenerator = {
    generateId: () => `gen-id-${idCounter++}`,
  };

  beforeEach(async () => {
    await db.delete();
    await db.open();

    idCounter = 1;
    mockTime = 1700000000000;
    catalogService = new CatalogService(db, mockClock, mockIdGen);

    // Seed kategori dan produk tanpa barcode
    await db.categories.add({
      id: 'cat_sembako',
      name: 'Sembako',
      active: 1,
      created_at: mockTime,
      created_by: 'system',
      updated_at: mockTime,
      updated_by: 'system',
      row_version: 1,
    });

    await db.products.add({
      id: 'prod_gula_curah',
      name: 'Gula Pasir Curah Repack',
      category_id: 'cat_sembako',
      base_unit_kind: 'weight',
      base_unit_code: 'kg',
      min_stock_base: 10,
      track_expiry: 0,
      active: 1,
      created_at: mockTime,
      created_by: 'system',
      updated_at: mockTime,
      updated_by: 'system',
      row_version: 1,
    });

    await db.product_units.add({
      id: 'unit_gula_kg',
      product_id: 'prod_gula_curah',
      name: 'Kilogram',
      unit_code: 'kg',
      conversion_factor: 1,
      price: 17500,
      cost_x10k: 150000000,
      is_base: 1,
      active: 1,
      created_at: mockTime,
      created_by: 'system',
      updated_at: mockTime,
      updated_by: 'system',
    });
  });

  // BC-I01
  it('BC-I01: Owner berhasil membuat barcode internal untuk satuan kg', async () => {
    const res = await catalogService.assignInternalBarcode({
      actor: { id: 'usr_owner', name: 'Pak Budi', role: 'owner' },
      productId: 'prod_gula_curah',
      productUnitId: 'unit_gula_kg',
    });

    // Nomor urut 1 -> 2000000000015
    expect(res.barcode).toBe('2000000000015');

    // Pastikan tersimpan di product_barcodes
    const savedBc = await db.product_barcodes.where('barcode').equals('2000000000015').first();
    expect(savedBc).toBeDefined();
    expect(savedBc?.product_id).toBe('prod_gula_curah');
    expect(savedBc?.product_unit_id).toBe('unit_gula_kg');

    // Pastikan counter bertambah
    const counter = await db.counters.get('internal_barcode_seq');
    expect(counter?.value).toBe(1);

    // Pastikan audit log tercatat
    const audit = await db.audit_logs.where('action').equals('catalog.barcode_internal_create').first();
    expect(audit).toBeDefined();
    expect(audit?.user_id).toBe('usr_owner');
    const afterData = JSON.parse(audit?.after_json || '{}');
    expect(afterData.barcode).toBe('2000000000015');
  });

  // BC-I02
  it('BC-I02: membuat barcode untuk 2 produk berurutan menghasilkan seq 1 lalu seq 2', async () => {
    // Produk kedua
    await db.products.add({
      id: 'prod_telur',
      name: 'Telur Ayam Pack',
      category_id: 'cat_sembako',
      base_unit_kind: 'count',
      base_unit_code: 'pak',
      min_stock_base: 5,
      track_expiry: 0,
      active: 1,
      created_at: mockTime,
      created_by: 'system',
      updated_at: mockTime,
      updated_by: 'system',
      row_version: 1,
    });
    await db.product_units.add({
      id: 'unit_telur_pak',
      product_id: 'prod_telur',
      name: 'Pack 10 Butir',
      unit_code: 'pak',
      conversion_factor: 1,
      price: 25000,
      cost_x10k: 220000000,
      is_base: 1,
      active: 1,
      created_at: mockTime,
      created_by: 'system',
      updated_at: mockTime,
      updated_by: 'system',
    });

    const res1 = await catalogService.assignInternalBarcode({
      actor: { id: 'usr_stock', name: 'Joko', role: 'stock_clerk' },
      productId: 'prod_gula_curah',
      productUnitId: 'unit_gula_kg',
    });
    const res2 = await catalogService.assignInternalBarcode({
      actor: { id: 'usr_stock', name: 'Joko', role: 'stock_clerk' },
      productId: 'prod_telur',
      productUnitId: 'unit_telur_pak',
    });

    expect(res1.barcode).toBe('2000000000015'); // seq 1
    expect(res2.barcode).toBe('2000000000022'); // seq 2 -> check digit 2
  });

  // BC-I03
  it('BC-I03: bila barcode seq 1 sudah pernah dipakai manual, generator melompati ke seq 2', async () => {
    // Suntikkan barcode seq 1 (2000000000015) yang sudah dipakai manual
    await db.product_barcodes.add({
      id: 'manual-bc-1',
      product_id: 'dummy',
      product_unit_id: 'dummy-unit',
      barcode: '2000000000015',
      created_at: mockTime,
    });

    const res = await catalogService.assignInternalBarcode({
      actor: { id: 'usr_owner', role: 'owner' },
      productId: 'prod_gula_curah',
      productUnitId: 'unit_gula_kg',
    });

    // Otomatis melompati 1 ke 2
    expect(res.barcode).toBe('2000000000022');
  });

  // BC-I04
  it('BC-I04: menolak pembuatan jika satuan sudah memiliki barcode internal', async () => {
    await catalogService.assignInternalBarcode({
      actor: { id: 'usr_owner', role: 'owner' },
      productId: 'prod_gula_curah',
      productUnitId: 'unit_gula_kg',
    });

    await expect(
      catalogService.assignInternalBarcode({
        actor: { id: 'usr_owner', role: 'owner' },
        productId: 'prod_gula_curah',
        productUnitId: 'unit_gula_kg',
      })
    ).rejects.toThrow('Satuan ini sudah memiliki barcode internal');
  });

  // BC-I05
  it('BC-I05: menolak jika aktor tidak memiliki izin catalog.manage (misal Kasir biasa)', async () => {
    await expect(
      catalogService.assignInternalBarcode({
        actor: { id: 'usr_kasir', role: 'cashier' },
        productId: 'prod_gula_curah',
        productUnitId: 'unit_gula_kg',
      })
    ).rejects.toThrow(/Akses ditolak.*catalog\.manage/);

    // Bukti tidak ada data tersimpan
    const count = await db.product_barcodes.count();
    expect(count).toBe(0);
  });

  // BC-I06
  it('BC-I06: menolak pembuatan barcode untuk produk yang diarsipkan / tidak aktif', async () => {
    await db.products.update('prod_gula_curah', { active: 0 });

    await expect(
      catalogService.assignInternalBarcode({
        actor: { id: 'usr_owner', role: 'owner' },
        productId: 'prod_gula_curah',
        productUnitId: 'unit_gula_kg',
      })
    ).rejects.toThrow('Produk tidak ditemukan atau sudah dinonaktifkan');
  });

  // BC-I08
  it('BC-I08: produk dengan barcode internal langsung dapat dicari lewat getProductByBarcode', async () => {
    const { barcode } = await catalogService.assignInternalBarcode({
      actor: { id: 'usr_owner', role: 'owner' },
      productId: 'prod_gula_curah',
      productUnitId: 'unit_gula_kg',
    });

    const found = await catalogService.getProductByBarcode(barcode);
    expect(found).toBeDefined();
    expect(found?.product.name).toBe('Gula Pasir Curah Repack');
    expect(found?.unit.name).toBe('Kilogram');
  });
});
