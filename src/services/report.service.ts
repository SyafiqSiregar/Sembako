import { SembakoDatabase } from '@/data/db';
import { escapeHtml } from '@/lib/html';

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
  unitName?: string;
  conversionFactor?: number;
  packagingStock?: number;
}

export interface ReportExportColumn {
  label: string;
  widthPx: number;
  align?: 'left' | 'right' | 'center';
  isTextFormat?: boolean;
}

export interface ReportExportKpiItem {
  label: string;
  value: string;
  subtext: string;
}

export interface ReportExportPayload {
  filename: string;
  sheetName: string;
  reportTitle: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  periodLabel: string;
  printedBy: string;
  printedAtLabel: string;
  kpis: ReportExportKpiItem[];
  columns: ReportExportColumn[];
  rows: (string | number)[][];
  footerRow?: (string | number)[];
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
      const factor = unit?.conversion_factor && unit.conversion_factor > 0 ? unit.conversion_factor : 1;
      const costPerUnit = unit ? Math.floor(unit.cost_x10k / 10000) : 0;
      const valuation = factor > 0 ? Math.round((currentStock * costPerUnit) / factor) : 0;
      totalValuation += valuation;

      const minStockThreshold = p.min_stock_base > 0 && factor > 1 && p.min_stock_base < factor
        ? p.min_stock_base * factor
        : p.min_stock_base;

      let status: 'Aman' | 'Menipis' | 'Habis' = 'Aman';
      if (currentStock <= 0) {
        status = 'Habis';
        outOfStockCount++;
      } else if (minStockThreshold > 0 && currentStock <= minStockThreshold) {
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
        unitName: unit?.name || unit?.unit_code || p.base_unit_code,
        conversionFactor: factor,
        packagingStock: Math.floor(currentStock / factor),
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

  /**
   * Membangun dokumen Spreadsheet HTML (.xls) resmi bergaya surat/laporan perusahaan:
   * 1. Kop Surat Resmi (Nama Toko, Alamat & Kontak, Sub-identitas Sistem SembakoOS + garis ganda)
   * 2. Judul Dokumen Laporan (Merge & Center, Bold)
   * 3. Blok Informasi Dokumen & Periode (Terstruktur per baris di Kiri & Kanan agar tidak terpotong)
   * 4. Ringkasan Eksekutif KPI (Terbagi rata di atas tabel)
   * 5. Tabel Data Utama dengan lebar kolom lega & zebra-striping
   * 6. Baris TOTAL Keseluruhan (Selalu tampil di bawah tabel)
   * 7. Kotak Catatan & Dasar Perhitungan Audit
   * 8. Blok Pengesahan & Tanda Tangan (Disiapkan Oleh & Mengetahui Pemilik Toko)
   */
  buildReportExcelHtml(payload: ReportExportPayload): string {
    const colCount = Math.max(2, payload.columns.length);
    const safeSheetName = escapeHtml(payload.sheetName.slice(0, 31) || 'Laporan SembakoOS');

    const totalTableWidthPx = payload.columns.reduce((sum, c) => sum + c.widthPx, 0);

    const colgroup = payload.columns
      .map(
        (col) =>
          `<col width="${col.widthPx}" style="mso-width-source:userset;mso-width-alt:${Math.round(col.widthPx * 36.5)};width:${col.widthPx}px;" />`
      )
      .join('');

    const leftSpan = Math.max(1, Math.floor(colCount / 2));
    const rightSpan = Math.max(1, colCount - leftSpan);

    // Pisahkan nama pencetak dan jabatan untuk blok tanda tangan
    const roleMatch = payload.printedBy.match(/^(.*?)\s*\((.*?)\)$/);
    const signerName = (roleMatch?.[1] || payload.printedBy || 'Petugas Kasir').trim();
    const signerRole = (roleMatch?.[2] || 'Petugas Operasional').trim();

    // Nomor dokumen otomatis dari nama berkas / tanggal
    const dateDigits = payload.filename.replace(/\D/g, '').slice(0, 8) || '20261030';
    const docNumber = `RPT-SMB/${escapeHtml(payload.sheetName.toUpperCase().replace(/\s+/g, '-'))}/${dateDigits}`;

    // Distribusi colspan proporsional untuk baris KPI
    const kpiCount = payload.kpis.length;
    const kpiCellsHtml =
      kpiCount > 0
        ? (() => {
            const baseSpan = Math.floor(colCount / kpiCount);
            let remainder = colCount % kpiCount;
            const spans = payload.kpis.map(() => {
              if (remainder > 0) {
                remainder -= 1;
                return Math.max(1, baseSpan + 1);
              }
              return Math.max(1, baseSpan);
            });

            // Jika kpiCount > colCount, tampilkan dalam baris ringkas
            if (baseSpan === 0) {
              const summaryInline = payload.kpis
                .map((k) => `<b>${escapeHtml(k.label)}:</b> ${escapeHtml(k.value)}`)
                .join(' &nbsp;&bull;&nbsp; ');
              return `
    <tr height="26" style="height:19.5pt;">
      <td colspan="${colCount}" valign="middle" style="background:#F8FAFC;color:#12202B;font-size:10pt;padding:5px 10px;border:1px solid #CBD5E1;vertical-align:middle;">
        ${summaryInline}
      </td>
    </tr>`;
            }

            const labelCells = payload.kpis
              .map(
                (k, idx) =>
                  `<td colspan="${spans[idx]}" align="center" valign="middle" style="background:#F1F5F9;color:#475569;font-size:9pt;font-weight:bold;text-align:center;vertical-align:middle;border:1px solid #CBD5E1;padding:4px 8px;">${escapeHtml(k.label.toUpperCase())}</td>`
              )
              .join('');

            const valueCells = payload.kpis
              .map(
                (k, idx) =>
                  `<td colspan="${spans[idx]}" align="center" valign="middle" style="background:#FFFFFF;color:#14463C;font-size:11pt;font-weight:bold;text-align:center;vertical-align:middle;border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(k.value)} <span style="font-size:8.5pt;font-weight:normal;color:#64748B;">(${escapeHtml(k.subtext)})</span></td>`
              )
              .join('');

            return `
    <tr height="22" style="height:16.5pt;">${labelCells}</tr>
    <tr height="26" style="height:19.5pt;">${valueCells}</tr>`;
          })()
        : '';

    const headerCells = payload.columns
      .map((col) => {
        const align = col.align || 'left';
        return `<th width="${col.widthPx}" align="${align}" valign="middle" style="width:${col.widthPx}px;background:#14463C;color:#FFFFFF;font-size:10.5pt;font-weight:bold;padding:8px 10px;border:1px solid #0F372F;text-align:${align};vertical-align:middle;white-space:nowrap;">${escapeHtml(col.label)}</th>`;
      })
      .join('');

    const bodyRowsHtml =
      payload.rows.length === 0
        ? `<tr height="34" style="height:25.5pt;"><td colspan="${colCount}" align="center" valign="middle" style="padding:12px;border:1px solid #CBD5E1;text-align:center;vertical-align:middle;color:#64748B;font-style:italic;background:#FFFFFF;">Tidak ada data transaksi pada periode laporan ini.</td></tr>`
        : payload.rows
            .map((row, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
              const cells = payload.columns
                .map((col, colIdx) => {
                  const val = row[colIdx] ?? '';
                  const align = col.align || 'left';
                  const textStyle = col.isTextFormat ? "mso-number-format:'\\@';" : '';
                  return `<td align="${align}" valign="middle" style="background:${rowBg};${textStyle}text-align:${align};vertical-align:middle;padding:6px 10px;border:1px solid #CBD5E1;color:#12202B;font-size:10pt;">${escapeHtml(val)}</td>`;
                })
                .join('');
              return `<tr height="26" style="height:19.5pt;">${cells}</tr>`;
            })
            .join('');

    // Baris TOTAL selalu ditampilkan apabila footerRow tersedia (termasuk saat Rp 0)
    const footerRowHtml = payload.footerRow
      ? `<tr height="30" style="height:22.5pt;">${payload.columns
          .map((col, colIdx) => {
            const val = payload.footerRow?.[colIdx] ?? '';
            const align = col.align || 'left';
            return `<td align="${align}" valign="middle" style="background:#E9F2EC;color:#12202B;font-size:10.5pt;font-weight:bold;text-align:${align};vertical-align:middle;padding:7px 10px;border-top:2px solid #14463C;border-bottom:3px double #14463C;border-left:1px solid #94A3B8;border-right:1px solid #94A3B8;">${escapeHtml(val)}</td>`;
          })
          .join('')}</tr>`
      : '';

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>${safeSheetName}</x:Name>
    <x:WorksheetOptions>
     <x:PageSetup>
      <x:Layout x:Orientation="Landscape"/>
     </x:PageSetup>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml><![endif]-->
<style>
  body, table { font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; color: #12202B; }
  table { border-collapse: collapse; width: ${totalTableWidthPx}px; }
</style>
</head>
<body>
<table width="${totalTableWidthPx}" style="width:${totalTableWidthPx}px;border-collapse:collapse;">
  <colgroup>${colgroup}</colgroup>
  <thead>
    <!-- 1. KOP SURAT / IDENTITAS TOKO -->
    <tr height="34" style="height:25.5pt;">
      <td colspan="${colCount}" align="center" valign="middle" style="background:#FFFFFF;color:#14463C;font-size:16pt;font-weight:bold;text-align:center;vertical-align:middle;border-top:2px solid #14463C;border-left:2px solid #14463C;border-right:2px solid #14463C;padding:4px 12px;">
        ${escapeHtml(payload.storeName.toUpperCase())}
      </td>
    </tr>
    <tr height="22" style="height:16.5pt;">
      <td colspan="${colCount}" align="center" valign="middle" style="background:#FFFFFF;color:#334155;font-size:10pt;text-align:center;vertical-align:middle;border-left:2px solid #14463C;border-right:2px solid #14463C;padding:2px 12px;">
        Alamat: ${escapeHtml(payload.storeAddress)} &nbsp;&bull;&nbsp; Telp: ${escapeHtml(payload.storePhone)}
      </td>
    </tr>
    <tr height="24" style="height:18pt;">
      <td colspan="${colCount}" align="center" valign="middle" style="background:#FFFFFF;color:#14463C;font-size:9.5pt;font-style:italic;text-align:center;vertical-align:middle;border-left:2px solid #14463C;border-right:2px solid #14463C;border-bottom:3px double #14463C;padding:2px 12px;">
        Sistem Kasir (POS) &amp; Manajemen Inventaris Terpadu &mdash; SembakoOS
      </td>
    </tr>

    <!-- 2. JUDUL DOKUMEN LAPORAN RESMI -->
    <tr height="30" style="height:22.5pt;">
      <td colspan="${colCount}" align="center" valign="middle" style="background:#E9F2EC;color:#14463C;font-size:12pt;font-weight:bold;text-align:center;vertical-align:middle;border:1px solid #14463C;padding:5px 12px;">
        ${escapeHtml(payload.reportTitle.toUpperCase())}
      </td>
    </tr>

    <!-- SPASI -->
    <tr height="10" style="height:7.5pt;"><td colspan="${colCount}"></td></tr>

    <!-- 3 & 4. INFORMASI DOKUMEN, PERIODE, DAN IDENTITAS PENCETAK -->
    <tr height="22" style="height:16.5pt;">
      <td colspan="${leftSpan}" valign="middle" style="background:#FAF8F4;color:#12202B;font-size:10pt;padding:4px 10px;border-top:1px solid #CBD5E1;border-left:1px solid #CBD5E1;border-right:1px solid #E2E8F0;vertical-align:middle;">
        <b>No. Dokumen</b> &nbsp;: &nbsp;${docNumber}
      </td>
      <td colspan="${rightSpan}" valign="middle" style="background:#FAF8F4;color:#12202B;font-size:10pt;padding:4px 10px;border-top:1px solid #CBD5E1;border-right:1px solid #CBD5E1;vertical-align:middle;">
        <b>Periode Laporan</b> &nbsp;: &nbsp;${escapeHtml(payload.periodLabel)}
      </td>
    </tr>
    <tr height="22" style="height:16.5pt;">
      <td colspan="${leftSpan}" valign="middle" style="background:#FAF8F4;color:#12202B;font-size:10pt;padding:4px 10px;border-left:1px solid #CBD5E1;border-right:1px solid #E2E8F0;vertical-align:middle;">
        <b>Tanggal Cetak</b> &nbsp;: &nbsp;${escapeHtml(payload.printedAtLabel)} WIB
      </td>
      <td colspan="${rightSpan}" valign="middle" style="background:#FAF8F4;color:#12202B;font-size:10pt;padding:4px 10px;border-right:1px solid #CBD5E1;vertical-align:middle;">
        <b>Dicetak Oleh</b> &nbsp;: &nbsp;${escapeHtml(payload.printedBy)}
      </td>
    </tr>
    <tr height="22" style="height:16.5pt;">
      <td colspan="${leftSpan}" valign="middle" style="background:#FAF8F4;color:#12202B;font-size:10pt;padding:4px 10px;border-bottom:1px solid #CBD5E1;border-left:1px solid #CBD5E1;border-right:1px solid #E2E8F0;vertical-align:middle;">
        <b>Perihal</b> &nbsp;: &nbsp;Rekapitulasi ${escapeHtml(payload.sheetName)}
      </td>
      <td colspan="${rightSpan}" valign="middle" style="background:#FAF8F4;color:#12202B;font-size:10pt;padding:4px 10px;border-bottom:1px solid #CBD5E1;border-right:1px solid #CBD5E1;vertical-align:middle;">
        <b>Cakupan &amp; Mata Uang</b> &nbsp;: &nbsp;Inventaris Gabungan &mdash; Rupiah (IDR)
      </td>
    </tr>

    <!-- SPASI -->
    <tr height="10" style="height:7.5pt;"><td colspan="${colCount}"></td></tr>

    <!-- 5. PENGANTAR & IKHTISAR EKSEKUTIF KPI -->
    <tr height="22" style="height:16.5pt;">
      <td colspan="${colCount}" valign="middle" style="color:#334155;font-size:10pt;padding:2px 4px;vertical-align:middle;">
        Berikut adalah ringkasan performa finansial dan rincian laporan operasional toko pada periode yang dipilih:
      </td>
    </tr>
    ${kpiCellsHtml}

    <!-- SPASI SEBELUM TABEL DATA -->
    <tr height="12" style="height:9pt;"><td colspan="${colCount}"></td></tr>

    <!-- 6. HEADER TABEL DATA UTAMA -->
    <tr height="30" style="height:22.5pt;">${headerCells}</tr>
  </thead>
  <tbody>
    ${bodyRowsHtml}
    <!-- 7. BARIS TOTAL KESELURUHAN -->
    ${footerRowHtml}

    <!-- SPASI SETELAH TABEL -->
    <tr height="14" style="height:10.5pt;"><td colspan="${colCount}"></td></tr>

    <!-- 8. CATATAN & KETENTUAN AUDIT LAPORAN -->
    <tr height="22" style="height:16.5pt;">
      <td colspan="${colCount}" valign="middle" style="background:#F1F5F9;color:#14463C;font-size:9.5pt;font-weight:bold;padding:4px 10px;border-top:1px solid #CBD5E1;border-left:1px solid #CBD5E1;border-right:1px solid #CBD5E1;vertical-align:middle;">
        Catatan &amp; Dasar Perhitungan Audit:
      </td>
    </tr>
    <tr height="20" style="height:15pt;">
      <td colspan="${colCount}" valign="middle" style="background:#FAF8F4;color:#475569;font-size:9pt;padding:2px 10px;border-left:1px solid #CBD5E1;border-right:1px solid #CBD5E1;vertical-align:middle;">
        1. Seluruh nilai nominal keuangan disajikan dalam bilangan bulat Rupiah (IDR) dari transaksi yang berstatus Selesai.
      </td>
    </tr>
    <tr height="20" style="height:15pt;">
      <td colspan="${colCount}" valign="middle" style="background:#FAF8F4;color:#475569;font-size:9pt;padding:2px 10px;border-left:1px solid #CBD5E1;border-right:1px solid #CBD5E1;vertical-align:middle;">
        2. Omzet Bersih dihitung dari Omzet Kotor dikurangi pengembalian dana Retur Pelanggan pada periode terkait.
      </td>
    </tr>
    <tr height="20" style="height:15pt;">
      <td colspan="${colCount}" valign="middle" style="background:#FAF8F4;color:#475569;font-size:9pt;padding:2px 10px;border-bottom:1px solid #CBD5E1;border-left:1px solid #CBD5E1;border-right:1px solid #CBD5E1;vertical-align:middle;">
        3. Estimasi Laba Kotor menggunakan snapshot Harga Pokok Penjualan (HPP) rata-rata tertimbang saat transaksi terjadi.
      </td>
    </tr>

    <!-- SPASI SEBELUM TANDA TANGAN -->
    <tr height="14" style="height:10.5pt;"><td colspan="${colCount}"></td></tr>
    <tr height="22" style="height:16.5pt;">
      <td colspan="${colCount}" valign="middle" style="color:#334155;font-size:10pt;padding:2px 4px;vertical-align:middle;">
        Demikian laporan operasional ini disusun berdasarkan data aktual di sistem SembakoOS untuk dipergunakan sebagaimana mestinya.
      </td>
    </tr>
    <tr height="10" style="height:7.5pt;"><td colspan="${colCount}"></td></tr>

    <!-- 9. BLOK PENGESAHAN / TANDA TANGAN -->
    <tr height="22" style="height:16.5pt;">
      <td colspan="${leftSpan}" align="center" valign="middle" style="text-align:center;vertical-align:middle;font-size:10pt;color:#334155;">
        Disiapkan / Dicetak Oleh,
      </td>
      <td colspan="${rightSpan}" align="center" valign="middle" style="text-align:center;vertical-align:middle;font-size:10pt;color:#334155;">
        Mengetahui &amp; Menyetujui,
      </td>
    </tr>
    <tr height="20" style="height:15pt;"><td colspan="${colCount}"></td></tr>
    <tr height="20" style="height:15pt;"><td colspan="${colCount}"></td></tr>
    <tr height="20" style="height:15pt;"><td colspan="${colCount}"></td></tr>
    <tr height="22" style="height:16.5pt;">
      <td colspan="${leftSpan}" align="center" valign="middle" style="text-align:center;vertical-align:middle;font-size:10pt;font-weight:bold;color:#12202B;">
        <u>( ${escapeHtml(signerName)} )</u>
      </td>
      <td colspan="${rightSpan}" align="center" valign="middle" style="text-align:center;vertical-align:middle;font-size:10pt;font-weight:bold;color:#12202B;">
        <u>( Pemilik / Kepala Toko )</u>
      </td>
    </tr>
    <tr height="20" style="height:15pt;">
      <td colspan="${leftSpan}" align="center" valign="middle" style="text-align:center;vertical-align:middle;font-size:9.5pt;color:#64748B;">
        ${escapeHtml(signerRole)}
      </td>
      <td colspan="${rightSpan}" align="center" valign="middle" style="text-align:center;vertical-align:middle;font-size:9.5pt;color:#64748B;">
        ${escapeHtml(payload.storeName)}
      </td>
    </tr>
  </tbody>
</table>
</body>
</html>`;
  }

  /**
   * Mengunduh laporan dalam format Excel (.xls) yang sudah rapi.
   */
  exportToExcel(payload: ReportExportPayload): void {
    const html = this.buildReportExcelHtml(payload);
    const blob = new Blob(['\uFEFF' + html], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${payload.filename}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Membangun dokumen HTML A4 Portrait resmi untuk Cetak / Simpan sebagai PDF.
   */
  buildReportPdfHtml(payload: ReportExportPayload): string {
    const colCount = Math.max(1, payload.columns.length);

    const kpiCardsHtml = payload.kpis
      .map(
        (kpi) => `
        <div class="kpi-card">
          <div class="kpi-label">${escapeHtml(kpi.label)}</div>
          <div class="kpi-value">${escapeHtml(kpi.value)}</div>
          <div class="kpi-sub">${escapeHtml(kpi.subtext)}</div>
        </div>`
      )
      .join('');

    const headerCellsHtml = payload.columns
      .map((col) => {
        const align = col.align || 'left';
        return `<th style="text-align:${align};">${escapeHtml(col.label)}</th>`;
      })
      .join('');

    const bodyRowsHtml =
      payload.rows.length === 0
        ? `<tr><td colspan="${colCount}" class="empty-cell">Tidak ada data pada periode laporan ini.</td></tr>`
        : payload.rows
            .map((row) => {
              const cells = payload.columns
                .map((col, idx) => {
                  const align = col.align || 'left';
                  const numClass = align === 'right' ? 'num-cell' : '';
                  return `<td class="${numClass}" style="text-align:${align};">${escapeHtml(row[idx] ?? '')}</td>`;
                })
                .join('');
              return `<tr>${cells}</tr>`;
            })
            .join('');

    const footerRowHtml = payload.footerRow
      ? `<tfoot><tr>${payload.columns
          .map((col, idx) => {
            const align = col.align || 'left';
            const numClass = align === 'right' ? 'num-cell' : '';
            return `<td class="${numClass}" style="text-align:${align};">${escapeHtml(payload.footerRow?.[idx] ?? '')}</td>`;
          })
          .join('')}</tr></tfoot>`
      : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.reportTitle)} - ${escapeHtml(payload.storeName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #12202B;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    .page-container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #14463C;
      padding-bottom: 12px;
      margin-bottom: 14px;
      gap: 16px;
    }
    .store-brand {
      font-size: 18px;
      font-weight: 800;
      color: #14463C;
      letter-spacing: -0.02em;
      margin: 0 0 3px 0;
    }
    .store-meta {
      font-size: 10.5px;
      color: #5E646B;
      margin: 0;
    }
    .doc-box {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      background: #E8F0EC;
      color: #14463C;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 800;
      color: #12202B;
      margin: 0 0 2px 0;
    }
    .doc-period {
      font-size: 10.5px;
      color: #5E646B;
      margin: 0;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #FAF8F4;
      border: 1px solid #D9D3C5;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #5E646B;
      margin-bottom: 3px;
    }
    .kpi-value {
      font-size: 13.5px;
      font-weight: 800;
      color: #12202B;
      font-variant-numeric: tabular-nums;
      margin-bottom: 2px;
    }
    .kpi-sub {
      font-size: 9.5px;
      color: #14463C;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 10.5px;
    }
    thead th {
      background: #14463C;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 7px 9px;
      border: 1px solid #14463C;
    }
    tbody td {
      padding: 6.5px 9px;
      border: 1px solid #E6E1D6;
      color: #12202B;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td {
      background: #FAF8F4;
    }
    tfoot td {
      background: #E8F0EC;
      color: #12202B;
      font-weight: 800;
      padding: 8px 9px;
      border-top: 2px solid #14463C;
      border-bottom: 2px solid #14463C;
      border-left: 1px solid #D9D3C5;
      border-right: 1px solid #D9D3C5;
    }
    .num-cell {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .empty-cell {
      text-align: center;
      padding: 20px;
      color: #5E646B;
      font-style: italic;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 22px;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 200px;
      text-align: center;
      font-size: 10.5px;
      color: #12202B;
    }
    .sig-role {
      font-weight: 700;
      color: #5E646B;
      margin-bottom: 48px;
    }
    .sig-line {
      border-top: 1px solid #12202B;
      padding-top: 4px;
      font-weight: 700;
    }
    .doc-footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px dashed #D9D3C5;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #5E646B;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="report-header">
      <div>
        <h1 class="store-brand">${escapeHtml(payload.storeName)}</h1>
        <p class="store-meta">${escapeHtml(payload.storeAddress)} &bull; Telp: ${escapeHtml(payload.storePhone)}</p>
      </div>
      <div class="doc-box">
        <span class="doc-badge">Dokumen Laporan Resmi</span>
        <h2 class="doc-title">${escapeHtml(payload.reportTitle)}</h2>
        <p class="doc-period">Periode: <strong>${escapeHtml(payload.periodLabel)}</strong></p>
      </div>
    </div>

    <div class="kpi-grid">
      ${kpiCardsHtml}
    </div>

    <table>
      <thead>
        <tr>${headerCellsHtml}</tr>
      </thead>
      <tbody>
        ${bodyRowsHtml}
      </tbody>
      ${footerRowHtml}
    </table>

    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-role">Disiapkan / Dicetak Oleh</div>
        <div class="sig-line">${escapeHtml(payload.printedBy)}</div>
      </div>
      <div class="sig-box">
        <div class="sig-role">Diperiksa &amp; Disetujui Oleh</div>
        <div class="sig-line">Pemilik Toko</div>
      </div>
    </div>

    <div class="doc-footer">
      <span>Dicetak otomatis dari sistem kasir &amp; inventaris SembakoOS</span>
      <span>Waktu cetak: ${escapeHtml(payload.printedAtLabel)}</span>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Membuka dialog cetak / Simpan sebagai PDF A4 dari dokumen HTML laporan.
   * Menggunakan jendela cetak khusus, atau fallback ke iframe tersembunyi bila popup diblokir browser.
   */
  openPdfPrintWindow(payload: ReportExportPayload): void {
    const html = this.buildReportPdfHtml(payload);
    const printWin = window.open('', '_blank', 'width=960,height=800');

    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 250);
      return;
    }

    // Fallback iframe jika popup diblokir
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }, 250);
    }
  }
}
