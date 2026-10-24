import { SembakoDatabase } from '@/data/db';

export interface SalesReportSummary {
  periodLabel: string;
  grossSales: number; // Omzet kotor
  totalDiscount: number; // Diskon
  totalRefund: number; // Refund retur
  netSales: number; // Omzet bersih
  totalTransactions: number; // Jumlah transaksi
  averageBasketSize: number; // Rata-rata per transaksi
  estimatedGrossProfit: number; // Estimasi laba kotor
  grossProfitMarginPercent: number; // % Margin
  isEstimatedCostIncomplete: boolean; // Label estimasi jika ada cost 0
}

export interface ProductPerformanceItem {
  productId: string;
  productName: string;
  categoryName: string;
  baseUnitCode: string;
  qtySold: number;
  grossRevenue: number;
  estimatedCost: number;
  estimatedProfit: number;
}

export interface CashierSessionReportItem {
  sessionId: string;
  cashierName: string;
  openedAt: number;
  closedAt?: number;
  openingCash: number;
  systemCashSales: number;
  expectedClosingCash: number;
  actualClosingCash?: number;
  discrepancyCash?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface InventoryValuationItem {
  productId: string;
  productName: string;
  categoryName: string;
  currentStock: number;
  unitCode: string;
  minStock: number;
  costPerUnit: number;
  valuationRupiah: number;
  status: 'Aman' | 'Menipis' | 'Habis';
}

export class ReportService {
  constructor(private db: SembakoDatabase) {}

  /**
   * Menghitung Laporan Penjualan & Estimasi Laba Kotor (FR-RPT-01..04, AC-26..28).
   */
  async getSalesReport(startDateMs: number, endDateMs: number): Promise<{
    summary: SalesReportSummary;
    dailyBreakdown: {
      dateStr: string;
      transactionCount: number;
      grossRevenue: number;
      netRevenue: number;
      estimatedProfit: number;
    }[];
  }> {
    // Ambil penjualan berstatus selesai atau partially_returned pada rentang waktu
    const sales = await this.db.sales
      .filter((s) => s.completed_at >= startDateMs && s.completed_at <= endDateMs && s.status !== 'voided')
      .toArray();

    let grossSales = 0;
    let totalDiscount = 0;
    let totalRefund = 0;
    let estimatedCost = 0;
    let hasZeroCost = false;

    const dailyMap = new Map<string, { count: number; gross: number; net: number; cost: number }>();

    for (const sale of sales) {
      grossSales += sale.subtotal;
      totalDiscount += sale.discount_total;

      const dateStr = new Date(sale.completed_at).toISOString().split('T')[0]!;
      const currentDaily = dailyMap.get(dateStr) || { count: 0, gross: 0, net: 0, cost: 0 };
      currentDaily.count += 1;
      currentDaily.gross += sale.subtotal;

      // Ambil items untuk menghitung HPP snapshot
      const items = await this.db.sale_items.where('sale_id').equals(sale.id).toArray();
      let saleCost = 0;
      for (const it of items) {
        if (!it.unit_cost_x10k_snapshot || it.unit_cost_x10k_snapshot === 0) {
          hasZeroCost = true;
        }
        const itemCost = Math.round((it.qty_base * (it.unit_cost_x10k_snapshot || 0)) / 10000);
        saleCost += itemCost;
      }

      estimatedCost += saleCost;
      currentDaily.cost += saleCost;
      currentDaily.net += sale.total;
      dailyMap.set(dateStr, currentDaily);
    }

    // Hitung refund retur dari transaksi retur yang terjadi pada periode
    const returnMovements = await this.db.stock_movements
      .filter((m) => m.occurred_at >= startDateMs && m.occurred_at <= endDateMs && m.type === 'CUSTOMER_RETURN')
      .toArray();

    // Nilai retur
    for (const rm of returnMovements) {
      const items = await this.db.stock_movement_items.where('movement_id').equals(rm.id).toArray();
      for (const it of items) {
        // Ambil perkiraan harga retur
        const refundEstimate = Math.round((it.qty_delta_base * it.unit_cost_x10k) / 10000);
        totalRefund += Math.max(0, refundEstimate);
      }
    }

    const netSales = Math.max(0, grossSales - totalDiscount - totalRefund);
    const estimatedGrossProfit = Math.max(0, netSales - estimatedCost);
    const grossProfitMarginPercent = netSales > 0 ? Math.round((estimatedGrossProfit / netSales) * 100) : 0;
    const totalTransactions = sales.length;
    const averageBasketSize = totalTransactions > 0 ? Math.round(netSales / totalTransactions) : 0;

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([dateStr, data]) => ({
        dateStr,
        transactionCount: data.count,
        grossRevenue: data.gross,
        netRevenue: data.net,
        estimatedProfit: Math.max(0, data.net - data.cost),
      }))
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    return {
      summary: {
        periodLabel: `${new Date(startDateMs).toLocaleDateString('id-ID')} s.d. ${new Date(endDateMs).toLocaleDateString('id-ID')}`,
        grossSales,
        totalDiscount,
        totalRefund,
        netSales,
        totalTransactions,
        averageBasketSize,
        estimatedGrossProfit,
        grossProfitMarginPercent,
        isEstimatedCostIncomplete: hasZeroCost,
      },
      dailyBreakdown,
    };
  }

  /**
   * Laporan Produk Terlaris & Kinerja Penjualan per Produk (FR-RPT-03, FR-RPT-05, AC-29).
   */
  async getProductPerformance(startDateMs: number, endDateMs: number): Promise<ProductPerformanceItem[]> {
    const sales = await this.db.sales
      .filter((s) => s.completed_at >= startDateMs && s.completed_at <= endDateMs && s.status !== 'voided')
      .toArray();

    const saleIds = sales.map((s) => s.id);
    if (saleIds.length === 0) {
      return [];
    }

    const items = await this.db.sale_items.filter((it) => saleIds.includes(it.sale_id)).toArray();

    const prodMap = new Map<string, {
      name: string;
      qty: number;
      grossRevenue: number;
      estimatedCost: number;
    }>();

    for (const it of items) {
      const current = prodMap.get(it.product_id) || {
        name: it.name_snapshot,
        qty: 0,
        grossRevenue: 0,
        estimatedCost: 0,
      };
      current.qty += it.qty_base;
      current.grossRevenue += it.line_total;
      const cost = Math.round((it.qty_base * (it.unit_cost_x10k_snapshot || 0)) / 10000);
      current.estimatedCost += cost;
      prodMap.set(it.product_id, current);
    }

    const allProducts = await this.db.products.toArray();
    const productInfoMap = new Map(allProducts.map((p) => [p.id, p]));

    const allCategories = await this.db.categories.toArray();
    const categoryMap = new Map(allCategories.map((c) => [c.id, c.name]));

    const results: ProductPerformanceItem[] = [];

    for (const [prodId, data] of prodMap.entries()) {
      const prod = productInfoMap.get(prodId);
      const catName = prod ? categoryMap.get(prod.category_id) || 'Umum' : 'Umum';
      const unitCode = prod ? prod.base_unit_code : 'pcs';

      results.push({
        productId: prodId,
        productName: data.name,
        categoryName: catName,
        baseUnitCode: unitCode,
        qtySold: data.qty,
        grossRevenue: data.grossRevenue,
        estimatedCost: data.estimatedCost,
        estimatedProfit: Math.max(0, data.grossRevenue - data.estimatedCost),
      });
    }

    // Urutkan default: produk paling banyak terjual (Fast-Moving)
    results.sort((a, b) => b.qtySold - a.qtySold);

    return results;
  }

  /**
   * Laporan Nilai Persediaan dan Status Stok (FR-RPT-05, AC-30).
   */
  async getInventoryValuationReport(): Promise<{
    items: InventoryValuationItem[];
    totalValuation: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  }> {
    const products = await this.db.products.filter((p) => p.active === 1).toArray();
    const categories = await this.db.categories.toArray();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const units = await this.db.product_units.filter((u) => u.is_base === 1).toArray();
    const unitMap = new Map(units.map((u) => [u.product_id, u]));

    const balances = await this.db.inventory_balances.toArray();
    const stockMap = new Map<string, number>();

    for (const b of balances) {
      stockMap.set(b.product_id, (stockMap.get(b.product_id) || 0) + b.qty_base);
    }

    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const items: InventoryValuationItem[] = products.map((p) => {
      const currentStock = stockMap.get(p.id) || 0;
      const unit = unitMap.get(p.id);
      const costPerUnit = unit ? Math.floor(unit.cost_x10k / 10000) : 0;
      const valuation = currentStock * costPerUnit;
      totalValuation += valuation;

      let status: 'Aman' | 'Menipis' | 'Habis' = 'Aman';
      if (currentStock <= 0) {
        status = 'Habis';
        outOfStockCount++;
      } else if (p.min_stock_base > 0 && currentStock <= p.min_stock_base) {
        status = 'Menipis';
        lowStockCount++;
      }

      return {
        productId: p.id,
        productName: p.name,
        categoryName: categoryMap.get(p.category_id) || 'Umum',
        currentStock,
        unitCode: p.base_unit_code,
        minStock: p.min_stock_base,
        costPerUnit,
        valuationRupiah: valuation,
        status,
      };
    });

    items.sort((a, b) => b.valuationRupiah - a.valuationRupiah);

    return {
      items,
      totalValuation,
      totalProducts: products.length,
      lowStockCount,
      outOfStockCount,
    };
  }

  /**
   * Laporan Rekonsiliasi Sesi Kasir (FR-RPT-07, AC-30).
   */
  async getCashierSessionsReport(startDateMs: number, endDateMs: number): Promise<CashierSessionReportItem[]> {
    const sessions = await this.db.cashier_sessions
      .filter((s) => s.opened_at >= startDateMs && s.opened_at <= endDateMs)
      .toArray();

    const users = await this.db.users.toArray();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const reports: CashierSessionReportItem[] = [];

    for (const sess of sessions) {
      // Ambil transaksi tunai pada sesi ini
      const sales = await this.db.sales
        .where('session_id')
        .equals(sess.id)
        .and((s) => s.status === 'completed')
        .toArray();

      const saleIds = sales.map((s) => s.id);
      let systemCash = 0;

      if (saleIds.length > 0) {
        const cashPayments = await this.db.payments
          .filter((p) => saleIds.includes(p.sale_id) && p.method === 'cash')
          .toArray();
        systemCash = cashPayments.reduce((acc, p) => acc + p.amount, 0);
      }

      const expectedClosing = sess.opening_cash + systemCash;
      const discrepancy = sess.closing_cash !== undefined ? sess.closing_cash - expectedClosing : undefined;

      reports.push({
        sessionId: sess.id,
        cashierName: userMap.get(sess.user_id) || 'Kasir',
        openedAt: sess.opened_at,
        closedAt: sess.closed_at,
        openingCash: sess.opening_cash,
        systemCashSales: systemCash,
        expectedClosingCash: expectedClosing,
        actualClosingCash: sess.closing_cash,
        discrepancyCash: discrepancy,
        status: sess.status,
        notes: sess.notes,
      });
    }

    reports.sort((a, b) => b.openedAt - a.openedAt);
    return reports;
  }

  /**
   * Ekspor data ke format CSV UTF-8 (FR-RPT-08, AC-31).
   * Menambahkan UTF-8 BOM (\uFEFF) agar Microsoft Excel langsung membaca teks Indonesia tanpa error encoding.
   */
  exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCsv).join(',');
    const bodyLines = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
    const csvContent = `\uFEFF${headerLine}\n${bodyLines}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
