import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { ReportService } from '@/services/report.service';

describe('ReportService (FR-RPT-01..08, AC-26..31)', () => {
  let reportService: ReportService;
  const now = new Date('2026-10-25T14:00:00Z').getTime();

  beforeEach(async () => {
    await db.delete();
    await db.open();

    reportService = new ReportService(db);

    // Seed kategori & produk
    await db.categories.add({
      id: 'cat_sembako',
      name: 'Bahan Pokok',
      active: 1,
      created_at: now,
      created_by: 'admin',
      updated_at: now,
      updated_by: 'admin',
      row_version: 1,
    });

    await db.products.bulkAdd([
      {
        id: 'prod_beras',
        name: 'Beras Ramos 5kg',
        category_id: 'cat_sembako',
        base_unit_kind: 'weight',
        base_unit_code: 'kg',
        min_stock_base: 10,
        track_expiry: 0,
        active: 1,
        created_at: now,
        created_by: 'admin',
        updated_at: now,
        updated_by: 'admin',
        row_version: 1,
      },
      {
        id: 'prod_minyak',
        name: 'Minyak Goreng 2L',
        category_id: 'cat_sembako',
        base_unit_kind: 'volume',
        base_unit_code: 'pouch',
        min_stock_base: 5,
        track_expiry: 0,
        active: 1,
        created_at: now,
        created_by: 'admin',
        updated_at: now,
        updated_by: 'admin',
        row_version: 1,
      },
    ]);

    await db.product_units.bulkAdd([
      {
        id: 'unit_beras',
        product_id: 'prod_beras',
        name: 'Karung 5kg',
        unit_code: 'kg',
        conversion_factor: 1,
        price: 70000,
        cost_x10k: 580000000, // Rp 58.000 HPP
        is_base: 1,
        active: 1,
        created_at: now,
        created_by: 'admin',
        updated_at: now,
        updated_by: 'admin',
      },
      {
        id: 'unit_minyak',
        product_id: 'prod_minyak',
        name: 'Pouch 2L',
        unit_code: 'pouch',
        conversion_factor: 1,
        price: 34000,
        cost_x10k: 280000000, // Rp 28.000 HPP
        is_base: 1,
        active: 1,
        created_at: now,
        created_by: 'admin',
        updated_at: now,
        updated_by: 'admin',
      },
    ]);

    // Seed stock
    await db.inventory_balances.bulkAdd([
      { product_id: 'prod_beras', batch_id: '', qty_base: 50, last_movement_at: now },
      { product_id: 'prod_minyak', batch_id: '', qty_base: 4, last_movement_at: now }, // Menipis karena min_stock = 5
    ]);

    // Seed user & sesi kasir
    await db.users.add({
      id: 'usr_ani',
      name: 'Ani Kasir',
      pin_hash: 'hash',
      pin_salt: 'salt',
      pin_kdf: 'pbkdf2',
      pin_iterations: 100000,
      status: 'active',
      failed_attempts: 0,
      created_at: now,
      created_by: 'admin',
      updated_at: now,
      updated_by: 'admin',
      row_version: 1,
    });

    await db.cashier_sessions.add({
      id: 'sess_ani_1',
      user_id: 'usr_ani',
      opening_cash: 100000,
      closing_cash: 204000, // Diharapkan: 100rb + 104rb = 204rb (Pas)
      status: 'closed',
      opened_at: now - 3600000,
      closed_at: now,
    });

    // Seed sales
    await db.sales.add({
      id: 'sale_rep_1',
      receipt_no: 'TRX-001',
      session_id: 'sess_ani_1',
      cashier_id: 'usr_ani',
      status: 'completed',
      subtotal: 104000, // Beras (70k) + Minyak (34k)
      discount_total: 0,
      tax_total: 0,
      rounding_adjustment: 0,
      total: 104000,
      completed_at: now - 1800000,
      created_at: now - 1800000,
      created_by: 'usr_ani',
      updated_at: now - 1800000,
      updated_by: 'usr_ani',
      row_version: 1,
    });

    await db.sale_items.bulkAdd([
      {
        id: 'item_1',
        sale_id: 'sale_rep_1',
        line_no: 1,
        product_id: 'prod_beras',
        product_unit_id: 'unit_beras',
        name_snapshot: 'Beras Ramos 5kg',
        unit_code_snapshot: 'kg',
        factor_snapshot: 1,
        qty_base: 1,
        unit_price_snapshot: 70000,
        discount: 0,
        line_total: 70000,
        unit_cost_x10k_snapshot: 580000000,
      },
      {
        id: 'item_2',
        sale_id: 'sale_rep_1',
        line_no: 2,
        product_id: 'prod_minyak',
        product_unit_id: 'unit_minyak',
        name_snapshot: 'Minyak Goreng 2L',
        unit_code_snapshot: 'pouch',
        factor_snapshot: 1,
        qty_base: 1,
        unit_price_snapshot: 34000,
        discount: 0,
        line_total: 34000,
        unit_cost_x10k_snapshot: 280000000,
      },
    ]);

    await db.payments.add({
      id: 'pay_1',
      sale_id: 'sale_rep_1',
      method: 'cash',
      amount: 104000,
      paid_at: now - 1800000,
    });
  });

  it('menghitung ringkasan penjualan dan estimasi laba kotor secara akurat (AC-26, AC-27, AC-28)', async () => {
    const report = await reportService.getSalesReport(now - 7200000, now);

    expect(report.summary.grossSales).toBe(104000);
    expect(report.summary.netSales).toBe(104000);
    expect(report.summary.totalTransactions).toBe(1);
    expect(report.summary.averageBasketSize).toBe(104000);

    // HPP: 58.000 + 28.000 = 86.000. Laba: 104.000 - 86.000 = 18.000
    expect(report.summary.estimatedGrossProfit).toBe(18000);
    expect(report.summary.grossProfitMarginPercent).toBe(17); // 18000 / 104000 ~ 17%
  });

  it('menghasilkan laporan produk terlaris / fast moving (AC-29)', async () => {
    const perf = await reportService.getProductPerformance(now - 7200000, now);

    expect(perf.length).toBe(2);
    expect(perf[0]?.grossRevenue).toBeGreaterThan(0);
    expect(perf[0]?.estimatedProfit).toBeGreaterThan(0);
  });

  it('menghitung valuasi persediaan dan status stok menipis (AC-30)', async () => {
    const inv = await reportService.getInventoryValuationReport();

    // 50 beras * 58.000 (2.900.000) + 4 minyak * 28.000 (112.000) = 3.012.000
    expect(inv.totalValuation).toBe(3012000);
    expect(inv.totalProducts).toBe(2);
    expect(inv.lowStockCount).toBe(1); // Minyak stok 4 <= min 5
  });

  it('merekonsiliasi penerimaan kas per sesi kasir (AC-30)', async () => {
    const sessions = await reportService.getCashierSessionsReport(now - 7200000, now);

    expect(sessions.length).toBe(1);
    const s = sessions[0]!;
    expect(s.cashierName).toBe('Ani Kasir');
    expect(s.openingCash).toBe(100000);
    expect(s.systemCashSales).toBe(104000);
    expect(s.expectedClosingCash).toBe(204000);
    expect(s.actualClosingCash).toBe(204000);
    expect(s.discrepancyCash).toBe(0); // Pas
  });
});
