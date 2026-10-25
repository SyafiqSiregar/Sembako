import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { seedDemoDatabase } from '@/data/seedDemo';
import { InventoryService } from '@/services/inventory.service';
import { ReportService } from '@/services/report.service';

describe('Seed Demo Service (AGENTS.md §3 Rule 3)', () => {
  let db: SembakoDatabase;

  beforeEach(async () => {
    db = new SembakoDatabase(`test_seed_demo_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  it('berhasil memuat data demo sembako dengan kategori, produk, batch, stok, dan transaksi kasir', async () => {
    const result = await seedDemoDatabase(db);

    expect(result.categoriesCount).toBeGreaterThan(0);
    expect(result.productsCount).toBe(4);
    expect(result.suppliersCount).toBe(2);
    expect(result.salesCount).toBe(1);

    // Verifikasi produk tersimpan
    const products = await db.products.toArray();
    expect(products.length).toBe(4);
    products.forEach((p) => {
      expect(p.name).toContain('[DEMO]');
    });

    // Verifikasi saldo stok bertambah via inventory ledger
    const balances = await db.inventory_balances.toArray();
    expect(balances.length).toBeGreaterThan(0);

    const movements = await db.stock_movements.toArray();
    expect(movements.length).toBeGreaterThanOrEqual(2); // INITIAL_BALANCE + SALE

    // Verifikasi rekonsiliasi ledger
    const inventoryService = new InventoryService(db);
    const ledgerReportBeras = await inventoryService.reconcileStockLedger('prod_demo_beras');
    expect(ledgerReportBeras.isConsistent).toBe(true);
    expect(ledgerReportBeras.currentBalance).toBe(24); // 25 awal - 1 terjual

    const ledgerReportMinyak = await inventoryService.reconcileStockLedger('prod_demo_minyak');
    expect(ledgerReportMinyak.isConsistent).toBe(true);
    expect(ledgerReportMinyak.currentBalance).toBe(28); // 30 awal - 2 terjual

    // Verifikasi transaksi penjualan demo
    const sales = await db.sales.toArray();
    expect(sales.length).toBe(1);
    expect(sales[0]!.status).toBe('completed');
    expect(sales[0]!.total).toBe(144000); // 72.000 + (2 * 36.000)

    // Verifikasi laporan penjualan membaca data demo
    const reportService = new ReportService(db);
    const salesReport = await reportService.getSalesReport(0, Date.now() + 86400000);
    expect(salesReport.summary.totalTransactions).toBe(1);
    expect(salesReport.summary.netSales).toBe(144000);
  });
});
