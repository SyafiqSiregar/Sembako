import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingBag,
  FileSpreadsheet,
  FileText,
  Calendar,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Inbox,
} from 'lucide-react';
import { db } from '@/data/db';
import {
  ReportService,
  type SalesReportSummary,
  type ProductPerformanceItem,
  type InventoryValuationItem,
  type CashierSessionReportItem,
  type ReportExportPayload,
} from '@/services/report.service';
import {
  SettingsService,
  DEFAULT_STORE_SETTINGS,
  type StoreSettings,
} from '@/services/settings.service';
import { useAuthStore } from '@/features/auth/authStore';
import { formatRupiah, formatRupiahCompact } from '@/domain/money';
import { ReportPdfPreviewModal } from './ReportPdfPreviewModal';

type ReportTab = 'sales' | 'products' | 'inventory' | 'sessions';
type PeriodPreset = 'today' | '7days' | 'month' | 'all';

export const ReportsView: React.FC = () => {
  const reportService = useMemo(() => new ReportService(db), []);
  const settingsService = useMemo(() => new SettingsService(db), []);
  const { currentUser, roles } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'all' | 'Aman' | 'Menipis' | 'Habis'>('all');
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [dailySales, setDailySales] = useState<
    {
      dateStr: string;
      transactionCount: number;
      grossRevenue: number;
      netRevenue: number;
      estimatedProfit: number;
    }[]
  >([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceItem[]>([]);
  const [inventoryReport, setInventoryReport] = useState<{
    items: InventoryValuationItem[];
    totalValuation: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  } | null>(null);
  const [sessionReports, setSessionReports] = useState<CashierSessionReportItem[]>([]);

  const getDateRange = () => {
    const now = new Date();
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    ).getTime();

    if (periodPreset === 'today') {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      ).getTime();
      return { start, end };
    }
    if (periodPreset === '7days') {
      const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (periodPreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      return { start, end };
    }
    return { start: 0, end };
  };

  const periodDisplayLabel = useMemo(() => {
    const { start, end } = getDateRange();
    const fmt = (ms: number) =>
      new Date(ms).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

    if (periodPreset === 'today') {
      return `Hari Ini (${fmt(end)})`;
    }
    if (periodPreset === '7days') {
      return `7 Hari Terakhir (${fmt(start)} - ${fmt(end)})`;
    }
    if (periodPreset === 'month') {
      return `Bulan Ini (${fmt(start)} - ${fmt(end)})`;
    }
    return `Semua Waktu (s.d. ${fmt(end)})`;
  }, [periodPreset]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { start, end } = getDateRange();

      const [settingsRes, salesRes, productsRes, invRes, sessRes] = await Promise.all([
        settingsService.getStoreSettings(),
        reportService.getSalesReport(start, end),
        reportService.getProductPerformance(start, end),
        reportService.getInventoryValuationReport(),
        reportService.getCashierSessionsReport(start, end),
      ]);

      setStoreSettings(settingsRes);
      setSalesSummary(salesRes.summary);
      setDailySales(salesRes.dailyBreakdown);
      setProductPerformance(productsRes);
      setInventoryReport(invRes);
      setSessionReports(sessRes);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Gagal memuat data laporan. Silakan muat ulang.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodPreset]);

  // Filtered datasets per tab
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredDailySales = useMemo(() => {
    if (!normalizedQuery) return dailySales;
    return dailySales.filter((d) => d.dateStr.toLowerCase().includes(normalizedQuery));
  }, [dailySales, normalizedQuery]);

  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) return productPerformance;
    return productPerformance.filter(
      (p) =>
        p.productName.toLowerCase().includes(normalizedQuery) ||
        p.categoryName.toLowerCase().includes(normalizedQuery)
    );
  }, [productPerformance, normalizedQuery]);

  const filteredInventory = useMemo(() => {
    const items = inventoryReport?.items || [];
    return items.filter((item) => {
      const matchesStatus =
        inventoryStatusFilter === 'all' || item.status === inventoryStatusFilter;
      const matchesQuery =
        !normalizedQuery ||
        item.productName.toLowerCase().includes(normalizedQuery) ||
        item.categoryName.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [inventoryReport, inventoryStatusFilter, normalizedQuery]);

  const filteredSessions = useMemo(() => {
    if (!normalizedQuery) return sessionReports;
    return sessionReports.filter(
      (s) =>
        s.cashierName.toLowerCase().includes(normalizedQuery) ||
        s.sessionId.toLowerCase().includes(normalizedQuery) ||
        (s.notes && s.notes.toLowerCase().includes(normalizedQuery))
    );
  }, [sessionReports, normalizedQuery]);

  // Totals for footer rows
  const salesTotals = useMemo(() => {
    return filteredDailySales.reduce(
      (acc, d) => ({
        transactions: acc.transactions + d.transactionCount,
        gross: acc.gross + d.grossRevenue,
        net: acc.net + d.netRevenue,
        profit: acc.profit + d.estimatedProfit,
      }),
      { transactions: 0, gross: 0, net: 0, profit: 0 }
    );
  }, [filteredDailySales]);

  const productTotals = useMemo(() => {
    return filteredProducts.reduce(
      (acc, p) => ({
        qty: acc.qty + p.qtySold,
        gross: acc.gross + p.grossRevenue,
        cost: acc.cost + p.estimatedCost,
        profit: acc.profit + p.estimatedProfit,
      }),
      { qty: 0, gross: 0, cost: 0, profit: 0 }
    );
  }, [filteredProducts]);

  const inventoryTotals = useMemo(() => {
    return filteredInventory.reduce(
      (acc, i) => ({
        stock: acc.stock + i.currentStock,
        valuation: acc.valuation + i.valuationRupiah,
      }),
      { stock: 0, valuation: 0 }
    );
  }, [filteredInventory]);

  const sessionTotals = useMemo(() => {
    return filteredSessions.reduce(
      (acc, s) => ({
        opening: acc.opening + s.openingCash,
        systemCash: acc.systemCash + s.systemCashSales,
        expected: acc.expected + s.expectedClosingCash,
        actual: acc.actual + (s.actualClosingCash ?? 0),
        discrepancy: acc.discrepancy + (s.discrepancyCash ?? 0),
      }),
      { opening: 0, systemCash: 0, expected: 0, actual: 0, discrepancy: 0 }
    );
  }, [filteredSessions]);

  // Build unified export payload for Excel (.xls) and PDF (A4)
  const activeExportPayload = useMemo<ReportExportPayload>(() => {
    const dateStamp = new Date().toISOString().split('T')[0] || 'laporan';
    const printedAtLabel = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const roleLabel = roles[0]?.name;
    const cleanUserName = currentUser
      ? currentUser.name.replace(/\s*\(.*?\)\s*/g, '').trim()
      : 'Pemilik Toko';
    const printedBy = currentUser
      ? roleLabel
        ? `${cleanUserName} (${roleLabel})`
        : cleanUserName
      : 'Pemilik Toko';

    const kpis = [
      {
        label: 'Omzet Bersih',
        value: formatRupiah(salesSummary?.netSales || 0),
        subtext: `${salesSummary?.totalTransactions || 0} transaksi berhasil`,
      },
      {
        label: 'Estimasi Laba Kotor',
        value: formatRupiah(salesSummary?.estimatedGrossProfit || 0),
        subtext: `Margin ~${salesSummary?.grossProfitMarginPercent || 0}%`,
      },
      {
        label: 'Rata-rata Keranjang',
        value: formatRupiah(salesSummary?.averageBasketSize || 0),
        subtext: 'Rata-rata per struk',
      },
      {
        label: 'Nilai Persediaan',
        value: formatRupiah(inventoryReport?.totalValuation || 0),
        subtext: `${inventoryReport?.totalProducts || 0} jenis produk aktif`,
      },
    ];

    if (activeTab === 'sales') {
      return {
        filename: `Laporan_Penjualan_Harian_${dateStamp}`,
        sheetName: 'Penjualan Harian',
        reportTitle: 'Laporan Penjualan & Estimasi Laba Harian',
        storeName: storeSettings.storeName,
        storeAddress: storeSettings.storeAddress,
        storePhone: storeSettings.storePhone,
        periodLabel: periodDisplayLabel,
        printedBy,
        printedAtLabel,
        kpis,
        columns: [
          { label: 'No.', widthPx: 55, align: 'center', isTextFormat: true },
          { label: 'Tanggal Transaksi', widthPx: 155, align: 'left', isTextFormat: true },
          { label: 'Jumlah Transaksi', widthPx: 160, align: 'right' },
          { label: 'Omzet Kotor (Rp)', widthPx: 190, align: 'right' },
          { label: 'Omzet Bersih (Rp)', widthPx: 190, align: 'right' },
          { label: 'Estimasi Laba Kotor (Rp)', widthPx: 225, align: 'right' },
        ],
        rows: filteredDailySales.map((d, idx) => [
          String(idx + 1),
          d.dateStr,
          `${d.transactionCount} struk`,
          formatRupiah(d.grossRevenue),
          formatRupiah(d.netRevenue),
          formatRupiah(d.estimatedProfit),
        ]),
        footerRow: [
          '',
          `TOTAL (${filteredDailySales.length} Hari)`,
          `${salesTotals.transactions} struk`,
          formatRupiah(salesTotals.gross),
          formatRupiah(salesTotals.net),
          formatRupiah(salesTotals.profit),
        ],
      };
    }

    if (activeTab === 'products') {
      return {
        filename: `Laporan_Produk_Terlaris_${dateStamp}`,
        sheetName: 'Produk Terlaris',
        reportTitle: 'Laporan Produk Terlaris (Fast-Moving)',
        storeName: storeSettings.storeName,
        storeAddress: storeSettings.storeAddress,
        storePhone: storeSettings.storePhone,
        periodLabel: periodDisplayLabel,
        printedBy,
        printedAtLabel,
        kpis,
        columns: [
          { label: 'No.', widthPx: 55, align: 'center', isTextFormat: true },
          { label: 'Nama Produk', widthPx: 230, align: 'left' },
          { label: 'Kategori Barang', widthPx: 165, align: 'left' },
          { label: 'Kuantitas Terjual', widthPx: 155, align: 'right' },
          { label: 'Omzet Penjualan (Rp)', widthPx: 185, align: 'right' },
          { label: 'Estimasi HPP (Rp)', widthPx: 185, align: 'right' },
          { label: 'Estimasi Laba (Rp)', widthPx: 185, align: 'right' },
        ],
        rows: filteredProducts.map((p, idx) => [
          String(idx + 1),
          p.productName,
          p.categoryName,
          `${p.qtySold} ${p.baseUnitCode}`,
          formatRupiah(p.grossRevenue),
          formatRupiah(p.estimatedCost),
          formatRupiah(p.estimatedProfit),
        ]),
        footerRow: [
          '',
          `TOTAL (${filteredProducts.length} Produk)`,
          '-',
          `${productTotals.qty} unit`,
          formatRupiah(productTotals.gross),
          formatRupiah(productTotals.cost),
          formatRupiah(productTotals.profit),
        ],
      };
    }

    if (activeTab === 'inventory') {
      return {
        filename: `Laporan_Nilai_Persediaan_${dateStamp}`,
        sheetName: 'Nilai Persediaan',
        reportTitle: 'Laporan Status & Nilai Persediaan Barang',
        storeName: storeSettings.storeName,
        storeAddress: storeSettings.storeAddress,
        storePhone: storeSettings.storePhone,
        periodLabel: `Posisi Stok Saat Ini (${dateStamp})`,
        printedBy,
        printedAtLabel,
        kpis,
        columns: [
          { label: 'No.', widthPx: 55, align: 'center', isTextFormat: true },
          { label: 'Nama Produk', widthPx: 230, align: 'left' },
          { label: 'Kategori Barang', widthPx: 160, align: 'left' },
          { label: 'Stok Fisik', widthPx: 135, align: 'right' },
          { label: 'Stok Minimum', widthPx: 135, align: 'right' },
          { label: 'Biaya Modal / Unit', widthPx: 175, align: 'right' },
          { label: 'Nilai Persediaan (Rp)', widthPx: 190, align: 'right' },
          { label: 'Status Stok', widthPx: 130, align: 'center' },
        ],
        rows: filteredInventory.map((i, idx) => [
          String(idx + 1),
          i.productName,
          i.categoryName,
          `${i.currentStock} ${i.unitCode}`,
          `${i.minStock} ${i.unitCode}`,
          formatRupiah(i.costPerUnit),
          formatRupiah(i.valuationRupiah),
          i.status,
        ]),
        footerRow: [
          '',
          `TOTAL (${filteredInventory.length} Produk)`,
          '-',
          `${inventoryTotals.stock} unit`,
          '-',
          '-',
          formatRupiah(inventoryTotals.valuation),
          '-',
        ],
      };
    }

    return {
      filename: `Laporan_Rekonsiliasi_Kasir_${dateStamp}`,
      sheetName: 'Sesi Kasir',
      reportTitle: 'Laporan Rekonsiliasi Kas & Sesi Kasir',
      storeName: storeSettings.storeName,
      storeAddress: storeSettings.storeAddress,
      storePhone: storeSettings.storePhone,
      periodLabel: periodDisplayLabel,
      printedBy,
      printedAtLabel,
      kpis,
      columns: [
        { label: 'No.', widthPx: 50, align: 'center', isTextFormat: true },
        { label: 'Kasir', widthPx: 155, align: 'left' },
        { label: 'Waktu Buka', widthPx: 165, align: 'left', isTextFormat: true },
        { label: 'Waktu Tutup', widthPx: 165, align: 'left', isTextFormat: true },
        { label: 'Modal Awal (Rp)', widthPx: 155, align: 'right' },
        { label: 'Tunai Sistem (Rp)', widthPx: 155, align: 'right' },
        { label: 'Kas Diharapkan (Rp)', widthPx: 165, align: 'right' },
        { label: 'Kas Fisik Aktual (Rp)', widthPx: 165, align: 'right' },
        { label: 'Selisih Kas (Rp)', widthPx: 160, align: 'right' },
        { label: 'Status', widthPx: 115, align: 'center' },
      ],
      rows: filteredSessions.map((s, idx) => [
        String(idx + 1),
        s.cashierName,
        new Date(s.openedAt).toLocaleString('id-ID'),
        s.closedAt ? new Date(s.closedAt).toLocaleString('id-ID') : 'Masih Aktif',
        formatRupiah(s.openingCash),
        formatRupiah(s.systemCashSales),
        formatRupiah(s.expectedClosingCash),
        s.actualClosingCash !== undefined ? formatRupiah(s.actualClosingCash) : '-',
        s.discrepancyCash === undefined
          ? '-'
          : s.discrepancyCash === 0
            ? 'Rp 0 (Pas)'
            : s.discrepancyCash > 0
              ? `+${formatRupiah(s.discrepancyCash)}`
              : formatRupiah(s.discrepancyCash),
        s.status === 'open' ? 'Aktif' : 'Ditutup',
      ]),
      footerRow: [
        '',
        `TOTAL (${filteredSessions.length} Sesi)`,
        '-',
        '-',
        formatRupiah(sessionTotals.opening),
        formatRupiah(sessionTotals.systemCash),
        formatRupiah(sessionTotals.expected),
        formatRupiah(sessionTotals.actual),
        sessionTotals.discrepancy === 0
          ? 'Rp 0 (Pas)'
          : sessionTotals.discrepancy > 0
            ? `+${formatRupiah(sessionTotals.discrepancy)}`
            : formatRupiah(sessionTotals.discrepancy),
        '-',
      ],
    };
  }, [
    activeTab,
    currentUser,
    roles,
    storeSettings,
    periodDisplayLabel,
    salesSummary,
    inventoryReport,
    filteredDailySales,
    filteredProducts,
    filteredInventory,
    filteredSessions,
    salesTotals,
    productTotals,
    inventoryTotals,
    sessionTotals,
  ]);

  const handleExportExcel = () => {
    reportService.exportToExcel(activeExportPayload);
  };

  const handlePrintPdf = () => {
    reportService.openPdfPrintWindow(activeExportPayload);
  };

  return (
    <div className="space-y-5">
      {/* Top Control Bar: Filter Periode + Tanggal Aktif + Tombol Ekspor Excel & PDF */}
      <div className="bg-card border border-border rounded-card p-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Preset Filter */}
          <div
            className="inline-flex items-center bg-muted p-1 rounded-pill border border-border/80 text-xs font-semibold text-muted-foreground flex-wrap gap-1"
            role="group"
            aria-label="Filter periode laporan"
          >
            {(
              [
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'all', label: 'Semua' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPeriodPreset(preset.id)}
                className={`min-h-[34px] px-3.5 py-1 rounded-pill transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  periodPreset === preset.id
                    ? 'bg-card text-foreground font-bold shadow-sm ring-1 ring-border/70'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Active Calendar Range Pill */}
          <div className="inline-flex items-center gap-2 min-h-[36px] px-3.5 py-1.5 rounded-pill bg-secondary/70 border border-border text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-foreground">{periodDisplayLabel}</span>
          </div>
        </div>

        {/* Action Buttons: Segarkan, Unduh Excel (.xls), Ekspor PDF */}
        <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Muat ulang data laporan"
            className="min-h-[40px] px-3.5 py-2 rounded-pill border border-input bg-card hover:bg-muted active:scale-[0.98] text-muted-foreground hover:text-foreground text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all duration-150 shadow-sm cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[40px] px-4 py-2 rounded-pill border border-primary/35 bg-secondary/80 hover:bg-accent active:scale-[0.98] text-primary text-xs font-bold inline-flex items-center justify-center gap-2 transition-all duration-150 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
            <span>Unduh Excel (.xls)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPdfPreviewOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-pill bg-primary hover:bg-primary-hover active:scale-[0.98] text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-2 transition-all duration-150 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Ekspor PDF</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-card bg-destructive border border-destructive-foreground/20 text-destructive-foreground text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="min-h-[36px] px-4 py-1.5 rounded-pill bg-card text-foreground font-bold border border-input shadow-sm hover:bg-muted transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 4 Executive Metric Cards (KPIs) - menggunakan font-sans tabular-nums sesuai DESIGN_SYSTEM.md */}
      {salesSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {/* Card 1: Omzet Bersih */}
          <div
            className="p-3.5 sm:p-4 bg-card border border-border rounded-card shadow-sm min-w-0 overflow-hidden flex flex-col justify-between"
            title={formatRupiah(salesSummary.netSales)}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-snug">
                Omzet Bersih
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent text-primary flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tabular-nums tracking-tight truncate">
                {salesSummary.netSales >= 1_000_000
                  ? formatRupiahCompact(salesSummary.netSales)
                  : formatRupiah(salesSummary.netSales)}
              </div>
              {salesSummary.netSales >= 1_000_000 && (
                <div className="text-[11px] font-medium text-muted-foreground tabular-nums truncate mt-0.5">
                  {formatRupiah(salesSummary.netSales)}
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{salesSummary.totalTransactions} transaksi berhasil</span>
              {salesSummary.totalDiscount > 0 && (
                <span className="text-[11px] tabular-nums shrink-0">
                  Diskon: {formatRupiahCompact(salesSummary.totalDiscount)}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Estimasi Laba Kotor */}
          <div
            className="p-3.5 sm:p-4 bg-card border border-border rounded-card shadow-sm min-w-0 overflow-hidden flex flex-col justify-between"
            title={formatRupiah(salesSummary.estimatedGrossProfit)}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-snug">
                Estimasi Laba Kotor
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-success text-success-foreground flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-extrabold text-success-foreground tabular-nums tracking-tight truncate">
                {salesSummary.estimatedGrossProfit >= 1_000_000
                  ? formatRupiahCompact(salesSummary.estimatedGrossProfit)
                  : formatRupiah(salesSummary.estimatedGrossProfit)}
              </div>
              {salesSummary.estimatedGrossProfit >= 1_000_000 && (
                <div className="text-[11px] font-medium text-muted-foreground tabular-nums truncate mt-0.5">
                  {formatRupiah(salesSummary.estimatedGrossProfit)}
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-success text-success-foreground font-bold text-[11px] tabular-nums shrink-0">
                Margin ~{salesSummary.grossProfitMarginPercent}%
              </span>
              {salesSummary.isEstimatedCostIncomplete && (
                <span
                  className="text-warning-foreground text-[11px] font-medium truncate"
                  title="Beberapa item belum memiliki HPP lengkap"
                >
                  HPP parsial
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Rata-rata Keranjang */}
          <div
            className="p-3.5 sm:p-4 bg-card border border-border rounded-card shadow-sm min-w-0 overflow-hidden flex flex-col justify-between"
            title={formatRupiah(salesSummary.averageBasketSize)}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-snug">
                Rata-rata Keranjang
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-secondary text-foreground flex items-center justify-center shrink-0">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tabular-nums tracking-tight truncate">
                {salesSummary.averageBasketSize >= 1_000_000
                  ? formatRupiahCompact(salesSummary.averageBasketSize)
                  : formatRupiah(salesSummary.averageBasketSize)}
              </div>
              {salesSummary.averageBasketSize >= 1_000_000 && (
                <div className="text-[11px] font-medium text-muted-foreground tabular-nums truncate mt-0.5">
                  {formatRupiah(salesSummary.averageBasketSize)}
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/60 text-xs text-muted-foreground truncate">
              Rata-rata nilai belanja per struk
            </div>
          </div>

          {/* Card 4: Nilai Persediaan */}
          <div
            className="p-3.5 sm:p-4 bg-card border border-border rounded-card shadow-sm min-w-0 overflow-hidden flex flex-col justify-between"
            title={formatRupiah(inventoryReport?.totalValuation || 0)}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-snug">
                Nilai Persediaan
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-secondary text-foreground flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tabular-nums tracking-tight truncate">
                {(inventoryReport?.totalValuation || 0) >= 1_000_000
                  ? formatRupiahCompact(inventoryReport?.totalValuation || 0)
                  : formatRupiah(inventoryReport?.totalValuation || 0)}
              </div>
              {(inventoryReport?.totalValuation || 0) >= 1_000_000 && (
                <div className="text-[11px] font-medium text-muted-foreground tabular-nums truncate mt-0.5">
                  {formatRupiah(inventoryReport?.totalValuation || 0)}
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{inventoryReport?.totalProducts || 0} produk aktif</span>
              {inventoryReport &&
                (inventoryReport.lowStockCount > 0 || inventoryReport.outOfStockCount > 0) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-warning text-warning-foreground font-bold text-[10px] shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    {inventoryReport.lowStockCount + inventoryReport.outOfStockCount}
                  </span>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Report Table Card */}
      <div className="bg-card border border-border rounded-card shadow-sm overflow-hidden">
        {/* Tab Navigation with Counts */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 sm:px-4 overflow-x-auto">
          <div className="flex items-center gap-1">
            {(
              [
                {
                  id: 'sales',
                  label: 'Penjualan & Laba Harian',
                  count: dailySales.length,
                },
                {
                  id: 'products',
                  label: 'Produk Terlaris (Fast-Moving)',
                  count: productPerformance.length,
                },
                {
                  id: 'inventory',
                  label: 'Status & Nilai Stok',
                  count: inventoryReport?.items.length || 0,
                },
                {
                  id: 'sessions',
                  label: 'Rekonsiliasi Sesi Kasir',
                  count: sessionReports.length,
                },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                  className={`min-h-[44px] py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap inline-flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:bg-accent/30 ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-pill text-[10px] tabular-nums ${
                      isActive
                        ? 'bg-accent text-primary font-extrabold'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-Toolbar: Context Description, Status Filter (for Inventory), and Search Box */}
        <div className="p-3.5 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'sales' && (
              <span className="text-xs text-muted-foreground">
                Rekapitulasi transaksi selesai per tanggal beserta HPP &amp; estimasi laba kotor.
              </span>
            )}
            {activeTab === 'products' && (
              <span className="text-xs text-muted-foreground">
                Peringkat barang berdasarkan kuantitas terjual tertinggi pada periode terpilih.
              </span>
            )}
            {activeTab === 'inventory' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Filter status stok:</span>
                {(['all', 'Aman', 'Menipis', 'Habis'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setInventoryStatusFilter(st)}
                    className={`min-h-[32px] px-3 py-1 rounded-pill text-xs font-bold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      inventoryStatusFilter === st
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {st === 'all' ? 'Semua' : st}
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'sessions' && (
              <span className="text-xs text-muted-foreground">
                Perbandingan uang kas sistem dengan kas fisik aktual saat kasir tutup sif.
              </span>
            )}
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'sales'
                  ? 'Cari tanggal (YYYY-MM-DD)...'
                  : activeTab === 'sessions'
                    ? 'Cari nama kasir...'
                    : 'Cari nama produk / kategori...'
              }
              className="h-9 w-full pl-9 pr-3.5 rounded-pill border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* TAB 1: PENJUALAN & LABA HARIAN */}
        {activeTab === 'sales' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-3 py-3 text-right">Jumlah Transaksi</th>
                  <th className="px-3 py-3 text-right">Omzet Kotor</th>
                  <th className="px-3 py-3 text-right">Omzet Bersih</th>
                  <th className="px-4 py-3 text-right">Estimasi Laba Kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      Memuat laporan penjualan harian...
                    </td>
                  </tr>
                ) : filteredDailySales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center">
                          <Inbox className="w-5 h-5" />
                        </div>
                        <div className="font-bold text-foreground text-sm">
                          Belum ada transaksi penjualan pada periode ini
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Transaksi kasir yang selesai pada rentang <strong>{periodDisplayLabel}</strong> akan otomatis direkap di sini.
                        </p>
                        {periodPreset !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setPeriodPreset('all')}
                            className="mt-1 min-h-[38px] px-4 py-2 rounded-pill border border-input bg-card hover:bg-muted active:scale-[0.98] text-foreground text-xs font-bold shadow-sm transition-all cursor-pointer"
                          >
                            Tampilkan Semua Periode
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDailySales.map((d) => (
                    <tr key={d.dateStr} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground tabular-nums">
                        {d.dateStr}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-foreground tabular-nums">
                        {d.transactionCount} struk
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatRupiah(d.grossRevenue)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-foreground tabular-nums">
                        {formatRupiah(d.netRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-success-foreground tabular-nums">
                        {formatRupiah(d.estimatedProfit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && filteredDailySales.length > 0 && (
                <tfoot>
                  <tr className="bg-accent/70 border-t-2 border-primary text-foreground font-extrabold">
                    <td className="px-4 py-3">
                      TOTAL ({filteredDailySales.length} Hari)
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {salesTotals.transactions} struk
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(salesTotals.gross)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(salesTotals.net)}
                    </td>
                    <td className="px-4 py-3 text-right text-success-foreground tabular-nums">
                      {formatRupiah(salesTotals.profit)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* TAB 2: PRODUK TERLARIS */}
        {activeTab === 'products' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3 w-16">Rank</th>
                  <th className="px-4 py-3">Produk &amp; Kategori</th>
                  <th className="px-3 py-3 text-right">Kuantitas Terjual</th>
                  <th className="px-3 py-3 text-right">Omzet Penjualan</th>
                  <th className="px-3 py-3 text-right">Estimasi HPP</th>
                  <th className="px-4 py-3 text-right">Estimasi Laba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Memuat laporan produk terlaris...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div className="font-bold text-foreground text-sm">
                          Belum ada data produk terjual
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Daftar produk terlaris (fast-moving) akan muncul setelah ada transaksi penjualan pada periode ini.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <tr key={p.productId} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-extrabold text-muted-foreground tabular-nums">
                        #{idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{p.productName}</div>
                        <div className="text-[11px] text-muted-foreground">{p.categoryName}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-foreground tabular-nums">
                        {p.qtySold} {p.baseUnitCode}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-foreground tabular-nums">
                        {formatRupiah(p.grossRevenue)}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatRupiah(p.estimatedCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-success-foreground tabular-nums">
                        {formatRupiah(p.estimatedProfit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && filteredProducts.length > 0 && (
                <tfoot>
                  <tr className="bg-accent/70 border-t-2 border-primary text-foreground font-extrabold">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3">{filteredProducts.length} Produk</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {productTotals.qty} unit
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(productTotals.gross)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(productTotals.cost)}
                    </td>
                    <td className="px-4 py-3 text-right text-success-foreground tabular-nums">
                      {formatRupiah(productTotals.profit)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* TAB 3: STATUS & NILAI STOK */}
        {activeTab === 'inventory' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Produk &amp; Kategori</th>
                  <th className="px-3 py-3 text-right">Stok Fisik</th>
                  <th className="px-3 py-3 text-right">Stok Min</th>
                  <th className="px-3 py-3 text-right">Biaya Satuan</th>
                  <th className="px-3 py-3 text-right">Nilai Persediaan</th>
                  <th className="px-4 py-3 text-center">Status Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Memuat valuasi persediaan...
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center">
                          <Package className="w-5 h-5" />
                        </div>
                        <div className="font-bold text-foreground text-sm">
                          Tidak ada produk yang cocok dengan filter
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Coba ubah filter status stok atau kata kunci pencarian.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((i) => (
                    <tr key={i.productId} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{i.productName}</div>
                        <div className="text-[11px] text-muted-foreground">{i.categoryName}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-foreground tabular-nums">
                        {i.currentStock} {i.unitCode}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {i.minStock} {i.unitCode}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatRupiah(i.costPerUnit)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-foreground tabular-nums">
                        {formatRupiah(i.valuationRupiah)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {i.status === 'Aman' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold bg-success text-success-foreground">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Aman</span>
                          </span>
                        )}
                        {i.status === 'Menipis' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold bg-warning text-warning-foreground">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Menipis</span>
                          </span>
                        )}
                        {i.status === 'Habis' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold bg-destructive text-destructive-foreground">
                            <XCircle className="w-3 h-3" />
                            <span>Habis</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && filteredInventory.length > 0 && (
                <tfoot>
                  <tr className="bg-accent/70 border-t-2 border-primary text-foreground font-extrabold">
                    <td className="px-4 py-3">
                      TOTAL ({filteredInventory.length} Produk)
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {inventoryTotals.stock} unit
                    </td>
                    <td className="px-3 py-3 text-right">-</td>
                    <td className="px-3 py-3 text-right">-</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(inventoryTotals.valuation)}
                    </td>
                    <td className="px-4 py-3 text-center">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* TAB 4: REKONSILIASI SESI KASIR */}
        {activeTab === 'sessions' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Kasir &amp; Waktu Sif</th>
                  <th className="px-3 py-3 text-right">Modal Awal</th>
                  <th className="px-3 py-3 text-right">Tunai Sistem</th>
                  <th className="px-3 py-3 text-right">Kas Diharapkan</th>
                  <th className="px-3 py-3 text-right">Kas Fisik Aktual</th>
                  <th className="px-3 py-3 text-right">Selisih Kas</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      Memuat rekonsiliasi sesi kasir...
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="font-bold text-foreground text-sm">
                          Belum ada sesi kasir pada periode ini
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Rekonsiliasi modal awal, penjualan tunai, dan uang fisik laci kasir akan tercatat setiap sif dibuka/ditutup.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr key={s.sessionId} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{s.cashierName}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {new Date(s.openedAt).toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatRupiah(s.openingCash)}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatRupiah(s.systemCashSales)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-foreground tabular-nums">
                        {formatRupiah(s.expectedClosingCash)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-foreground tabular-nums">
                        {s.actualClosingCash !== undefined
                          ? formatRupiah(s.actualClosingCash)
                          : '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">
                        {s.discrepancyCash === undefined ? (
                          <span className="text-muted-foreground">-</span>
                        ) : s.discrepancyCash === 0 ? (
                          <span className="inline-flex items-center gap-1 text-success-foreground">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Rp 0 (Pas)</span>
                          </span>
                        ) : s.discrepancyCash > 0 ? (
                          <span className="text-info-foreground">
                            +{formatRupiah(s.discrepancyCash)}
                          </span>
                        ) : (
                          <span className="text-destructive-foreground">
                            {formatRupiah(s.discrepancyCash)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold ${
                            s.status === 'open'
                              ? 'bg-success text-success-foreground'
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {s.status === 'open' ? (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ditutup</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && filteredSessions.length > 0 && (
                <tfoot>
                  <tr className="bg-accent/70 border-t-2 border-primary text-foreground font-extrabold">
                    <td className="px-4 py-3">
                      TOTAL ({filteredSessions.length} Sesi)
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(sessionTotals.opening)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(sessionTotals.systemCash)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(sessionTotals.expected)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatRupiah(sessionTotals.actual)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {sessionTotals.discrepancy === 0
                        ? 'Rp 0 (Pas)'
                        : sessionTotals.discrepancy > 0
                          ? `+${formatRupiah(sessionTotals.discrepancy)}`
                          : formatRupiah(sessionTotals.discrepancy)}
                    </td>
                    <td className="px-4 py-3 text-center">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Modal Pratinjau Dokumen PDF A4 */}
      <ReportPdfPreviewModal
        isOpen={isPdfPreviewOpen}
        onClose={() => setIsPdfPreviewOpen(false)}
        payload={activeExportPayload}
        onPrintOrSavePdf={handlePrintPdf}
        onDownloadExcel={handleExportExcel}
      />
    </div>
  );
};
