import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Download,
  ShoppingBag,
} from 'lucide-react';
import { db } from '@/data/db';
import {
  ReportService,
  type SalesReportSummary,
  type ProductPerformanceItem,
  type InventoryValuationItem,
  type CashierSessionReportItem,
} from '@/services/report.service';
import { formatRupiah } from '@/domain/money';

export const ReportsView: React.FC = () => {
  const reportService = useMemo(() => new ReportService(db), []);

  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'inventory' | 'sessions'>('sales');
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [loading, setLoading] = useState(true);

  // Data states
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [dailySales, setDailySales] = useState<{
    dateStr: string;
    transactionCount: number;
    grossRevenue: number;
    netRevenue: number;
    estimatedProfit: number;
  }[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceItem[]>([]);
  const [inventoryReport, setInventoryReport] = useState<{
    items: InventoryValuationItem[];
    totalValuation: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  } | null>(null);
  const [sessionReports, setSessionReports] = useState<CashierSessionReportItem[]>([]);

  // Calculate start & end epoch MS
  const getDateRange = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (periodPreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      return { start, end };
    }
    if (periodPreset === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (periodPreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      return { start, end };
    }
    // 'all'
    return { start: 0, end };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const salesRes = await reportService.getSalesReport(start, end);
      setSalesSummary(salesRes.summary);
      setDailySales(salesRes.dailyBreakdown);

      const productsRes = await reportService.getProductPerformance(start, end);
      setProductPerformance(productsRes);

      const invRes = await reportService.getInventoryValuationReport();
      setInventoryReport(invRes);

      const sessRes = await reportService.getCashierSessionsReport(start, end);
      setSessionReports(sessRes);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodPreset]);

  // Export handlers
  const handleExportCsv = () => {
    const timestamp = new Date().toISOString().split('T')[0];

    if (activeTab === 'sales') {
      const headers = ['Tanggal', 'Jumlah Transaksi', 'Omzet Kotor (Rp)', 'Omzet Bersih (Rp)', 'Estimasi Laba Kotor (Rp)'];
      const rows = dailySales.map((d) => [
        d.dateStr,
        d.transactionCount,
        d.grossRevenue,
        d.netRevenue,
        d.estimatedProfit,
      ]);
      reportService.exportToCsv(`laporan_penjualan_harian_${timestamp}`, headers, rows);
    } else if (activeTab === 'products') {
      const headers = ['Produk', 'Kategori', 'Satuan', 'Qty Terjual', 'Omzet Kotor (Rp)', 'Estimasi HPP (Rp)', 'Estimasi Laba (Rp)'];
      const rows = productPerformance.map((p) => [
        p.productName,
        p.categoryName,
        p.baseUnitCode,
        p.qtySold,
        p.grossRevenue,
        p.estimatedCost,
        p.estimatedProfit,
      ]);
      reportService.exportToCsv(`laporan_produk_terlaris_${timestamp}`, headers, rows);
    } else if (activeTab === 'inventory') {
      if (!inventoryReport) return;
      const headers = ['Produk', 'Kategori', 'Stok Saat Ini', 'Satuan', 'Stok Minimum', 'Biaya Beli/Unit (Rp)', 'Nilai Persediaan (Rp)', 'Status'];
      const rows = inventoryReport.items.map((i) => [
        i.productName,
        i.categoryName,
        i.currentStock,
        i.unitCode,
        i.minStock,
        i.costPerUnit,
        i.valuationRupiah,
        i.status,
      ]);
      reportService.exportToCsv(`laporan_nilai_persediaan_${timestamp}`, headers, rows);
    } else if (activeTab === 'sessions') {
      const headers = ['ID Sesi', 'Kasir', 'Waktu Buka', 'Waktu Tutup', 'Modal Awal (Rp)', 'Penjualan Tunai Sistem (Rp)', 'Kas Diharapkan (Rp)', 'Kas Aktual (Rp)', 'Selisih Kas (Rp)', 'Status', 'Catatan'];
      const rows = sessionReports.map((s) => [
        s.sessionId,
        s.cashierName,
        new Date(s.openedAt).toLocaleString('id-ID'),
        s.closedAt ? new Date(s.closedAt).toLocaleString('id-ID') : '-',
        s.openingCash,
        s.systemCashSales,
        s.expectedClosingCash,
        s.actualClosingCash ?? '-',
        s.discrepancyCash ?? '-',
        s.status,
        s.notes || '',
      ]);
      reportService.exportToCsv(`laporan_sesi_kasir_${timestamp}`, headers, rows);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#14463C]" />
            <h1 className="text-xl font-bold text-stone-900 font-serif">
              Laporan & Analitik Bisnis
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Omzet, estimasi laba kotor, produk terlaris, status stok, dan rekonsiliasi kas (FR-RPT-01..08)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs font-semibold text-stone-600">
            <button
              onClick={() => setPeriodPreset('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodPreset === 'today' ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setPeriodPreset('7days')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodPreset === '7days' ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriodPreset('month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodPreset === 'month' ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPeriodPreset('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodPreset === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
              }`}
            >
              Semua
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-[#14463C] text-white hover:bg-[#0F352E] text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner (Sales Summary) */}
      {salesSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Omzet Bersih
              </span>
              <DollarSign className="w-4 h-4 text-[#14463C]" />
            </div>
            <div className="text-xl font-bold font-serif text-stone-900">
              {formatRupiah(salesSummary.netSales)}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              {salesSummary.totalTransactions} transaksi berhasil
            </div>
          </div>

          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Estimasi Laba Kotor
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-serif text-emerald-900">
              {formatRupiah(salesSummary.estimatedGrossProfit)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
              <span>Margin ~{salesSummary.grossProfitMarginPercent}%</span>
              {salesSummary.isEstimatedCostIncomplete && (
                <span className="text-amber-600 text-[10px] font-normal" title="Beberapa item belum ada HPP lengkap">
                  (Estimasi parsial)
                </span>
              )}
            </div>
          </div>

          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Rata-rata Keranjang
              </span>
              <ShoppingBag className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-xl font-bold font-serif text-stone-900">
              {formatRupiah(salesSummary.averageBasketSize)}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              Rata-rata per transaksi
            </div>
          </div>

          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Nilai Persediaan
              </span>
              <Package className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-xl font-bold font-serif text-stone-900">
              {formatRupiah(inventoryReport?.totalValuation || 0)}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              {inventoryReport?.totalProducts || 0} jenis produk aktif
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-stone-200 bg-stone-50/50 px-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sales')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'sales'
                ? 'border-[#14463C] text-[#14463C]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Penjualan & Laba Harian
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'products'
                ? 'border-[#14463C] text-[#14463C]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Produk Terlaris (Fast-Moving)
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'border-[#14463C] text-[#14463C]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Status & Nilai Stok
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'sessions'
                ? 'border-[#14463C] text-[#14463C]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Rekonsiliasi Sesi Kasir
          </button>
        </div>

        {/* Tab 1: Penjualan & Laba Harian */}
        {activeTab === 'sales' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-3 py-3 text-right">Jumlah Transaksi</th>
                  <th className="px-3 py-3 text-right">Omzet Kotor</th>
                  <th className="px-3 py-3 text-right">Omzet Bersih</th>
                  <th className="px-4 py-3 text-right">Estimasi Laba Kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      Memuat laporan penjualan...
                    </td>
                  </tr>
                ) : dailySales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      Tidak ada transaksi pada periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  dailySales.map((d) => (
                    <tr key={d.dateStr} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        {d.dateStr}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-stone-700">
                        {d.transactionCount}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-stone-600">
                        {formatRupiah(d.grossRevenue)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-stone-900">
                        {formatRupiah(d.netRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                        {formatRupiah(d.estimatedProfit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Produk Terlaris */}
        {activeTab === 'products' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Produk & Kategori</th>
                  <th className="px-3 py-3 text-right">Kuantitas Terjual</th>
                  <th className="px-3 py-3 text-right">Omzet Penjualan</th>
                  <th className="px-4 py-3 text-right">Estimasi Laba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      Memuat produk terlaris...
                    </td>
                  </tr>
                ) : productPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      Belum ada penjualan produk pada periode ini.
                    </td>
                  </tr>
                ) : (
                  productPerformance.map((p, idx) => (
                    <tr key={p.productId} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-bold text-stone-400">
                        #{idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-stone-900">{p.productName}</div>
                        <div className="text-[11px] text-stone-500">{p.categoryName}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-stone-900">
                        {p.qtySold} {p.baseUnitCode}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-stone-800">
                        {formatRupiah(p.grossRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                        {formatRupiah(p.estimatedProfit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Status & Nilai Stok */}
        {activeTab === 'inventory' && inventoryReport && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Produk & Kategori</th>
                  <th className="px-3 py-3 text-right">Stok Fisik</th>
                  <th className="px-3 py-3 text-right">Stok Min</th>
                  <th className="px-3 py-3 text-right">Biaya Satuan</th>
                  <th className="px-3 py-3 text-right">Nilai Persediaan</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {inventoryReport.items.map((i) => (
                  <tr key={i.productId} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-stone-900">{i.productName}</div>
                      <div className="text-[11px] text-stone-500">{i.categoryName}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-stone-900">
                      {i.currentStock} {i.unitCode}
                    </td>
                    <td className="px-3 py-3 text-right text-stone-600">
                      {i.minStock} {i.unitCode}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-stone-600">
                      {formatRupiah(i.costPerUnit)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-stone-900">
                      {formatRupiah(i.valuationRupiah)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {i.status === 'Aman' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Aman
                        </span>
                      )}
                      {i.status === 'Menipis' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Menipis
                        </span>
                      )}
                      {i.status === 'Habis' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Habis
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Rekonsiliasi Sesi Kasir */}
        {activeTab === 'sessions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Kasir & Waktu</th>
                  <th className="px-3 py-3 text-right">Modal Awal</th>
                  <th className="px-3 py-3 text-right">Tunai Sistem</th>
                  <th className="px-3 py-3 text-right">Kas Diharapkan</th>
                  <th className="px-3 py-3 text-right">Kas Fisik Aktual</th>
                  <th className="px-3 py-3 text-right">Selisih</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sessionReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                      Belum ada sesi kasir pada periode ini.
                    </td>
                  </tr>
                ) : (
                  sessionReports.map((s) => (
                    <tr key={s.sessionId} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-stone-900">{s.cashierName}</div>
                        <div className="text-[11px] text-stone-500">
                          {new Date(s.openedAt).toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-stone-700">
                        {formatRupiah(s.openingCash)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-stone-700">
                        {formatRupiah(s.systemCashSales)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-stone-900">
                        {formatRupiah(s.expectedClosingCash)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-stone-900">
                        {s.actualClosingCash !== undefined ? formatRupiah(s.actualClosingCash) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold">
                        {s.discrepancyCash === undefined ? (
                          <span className="text-stone-400">-</span>
                        ) : s.discrepancyCash === 0 ? (
                          <span className="text-emerald-700">Rp 0 (Pas)</span>
                        ) : s.discrepancyCash > 0 ? (
                          <span className="text-blue-700">+{formatRupiah(s.discrepancyCash)}</span>
                        ) : (
                          <span className="text-rose-700">{formatRupiah(s.discrepancyCash)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'open'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {s.status === 'open' ? 'Aktif' : 'Ditutup'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
