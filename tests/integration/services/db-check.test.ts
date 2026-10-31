import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { verifyDatabaseInvariants } from '@/domain/audit/verify-invariants';
import { CatalogService } from '@/services/catalog.service';

describe('Domain Audit: verifyDatabaseInvariants (INV-1..INV-6)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('berhasil memvalidasi seluruh invarian pada database bersih', async () => {
    const report = await verifyDatabaseInvariants(db);
    expect(report.allPassed).toBe(true);
    expect(report.results.length).toBe(6);
    expect(report.results.every((r) => r.passed)).toBe(true);
  });

  it('mendeteksi pelanggaran INV-1 jika saldo diedit langsung tanpa pergerakan ledger', async () => {
    const catalog = new CatalogService(db);
    const cat = await catalog.createCategory({ name: 'Beras', createdBy: 'admin' });

    // Buat produk dengan stok awal 10 via CatalogService
    const prod = await catalog.createProduct({
      name: 'Beras Rojolele 5kg',
      categoryId: cat.id,
      baseUnitKind: 'count',
      baseUnitCode: 'karung',
      minStockBase: 2,
      initialStockBase: 10,
      createdBy: 'admin',
      units: [
        {
          name: 'Karung 5kg',
          unitCode: 'karung',
          conversionFactor: 1,
          price: 65000,
          costX10k: 600000000,
          isBase: true,
        },
      ],
    });

    // Validasi awal harus lulus
    let report = await verifyDatabaseInvariants(db);
    expect(report.allPassed).toBe(true);

    // Langgar aturan: Ubah saldo langsung di inventory_balances secara ilegal (menambah 5)
    await db.inventory_balances.where('product_id').equals(prod.product.id).modify({ qty_base: 15 });

    // Verifikasi ulang: INV-1 harus GAGAL
    report = await verifyDatabaseInvariants(db);
    expect(report.allPassed).toBe(false);
    const inv1 = report.results.find((r) => r.invariant === 'INV-1');
    expect(inv1?.passed).toBe(false);
    expect(inv1?.violations.length).toBe(1);
    expect(inv1?.violations[0]?.expected).toBe(10);
    expect(inv1?.violations[0]?.actual).toBe(15);
  });
});
