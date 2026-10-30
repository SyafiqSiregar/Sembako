import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type CashierSession } from '@/data/db';
import { ReportService, type SalesReportSummary, type InventoryValuationItem } from '@/services/report.service';
import { BatchService } from '@/services/batch.service';
import { InventoryService } from '@/services/inventory.service';
import { CashierSessionService } from '@/services/session.service';
import { formatRupiah, formatRupiahCompact } from '@/domain/money';
import {
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  ChevronRight,
  Truck,
  ShoppingCart,
  Package,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';

interface AttentionItem {
  id: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED' | 'EXPIRING_CRITICAL' | 'EXPIRING_WARNING';
  name: string;
  category: string;
  stockDisplay: string;
  badgeLabel: string;
  badgeClass: string;
  actionLabel: string;
  actionRoute: string;
}

interface ActivityItem {
  id: string;
  type: 'sale' | 'receipt' | 'adjustment' | 'return' | 'stocktake' | 'damage';
  title: string;
  actor: string;
  timeStr: string;
  created_at: number;
  badgeText: string;
  badgeColorClass: string;
  detailText: string;
}

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [isLoading, setIsLoading] = useState(true);

  // Live Data States
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [timelinePoints, setTimelinePoints] = useState<{ label: string; value: number }[]>([
    { label: '08:00', value: 0 },
    { label: '10:00', value: 0 },
    { label: '12:00', value: 0 },
    { label: '14:00', value: 0 },
    { label: '16:00', value: 0 },
    { label: '18:00', value: 0 },
    { label: '20:00+', value: 0 },
  ]);
  const [activeSession, setActiveSession] = useState<{ session: CashierSession; cashierName: string } | null>(null);
  const [valuationData, setValuationData] = useState<{
    items: InventoryValuationItem[];
    totalValuation: number;
    lowStockCount: number;
    outOfStockCount: number;
    categorySegments: { name: string; percentage: number; color: string; value: number }[];
  }>({
    items: [],
    totalValuation: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    categorySegments: [],
  });
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  // Services
  const reportService = useMemo(() => new ReportService(db), []);
  const inventoryService = useMemo(() => new InventoryService(db), []);
  const batchService = useMemo(() => new BatchService(db, inventoryService), [inventoryService]);
  const sessionService = useMemo(() => new CashierSessionService(db), []);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = Date.now();
      const todayDate = new Date();
      const startOfToday = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate(),
        0,
        0,
        0,
        0
      ).getTime();
      const endOfToday = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate(),
        23,
        59,
        59,
        999
      ).getTime();

      let queryStart = startOfToday;
      let queryEnd = endOfToday;

      if (activeTab === '7days') {
        queryStart = startOfToday - 6 * 86400000;
        queryEnd = endOfToday;
      } else if (activeTab === 'month') {
        queryStart = startOfToday - 29 * 86400000;
        queryEnd = endOfToday;
      } else if (activeTab === 'all') {
        queryStart = 0;
        queryEnd = now + 86400000;
      }

      // 1. Sales Report
      const salesResult = await reportService.getSalesReport(queryStart, queryEnd);
      setSalesSummary(salesResult.summary);

      // 2. Timeline points distribution based on activeTab
      if (activeTab === 'today') {
        const todaySales = await db.sales
          .filter((s) => s.completed_at >= startOfToday && s.completed_at <= endOfToday && s.status !== 'voided')
          .toArray();

        const buckets = [0, 0, 0, 0, 0, 0, 0]; // 08-10, 10-12, 12-14, 14-16, 16-18, 18-20, 20-22
        todaySales.forEach((s) => {
          const hour = new Date(s.completed_at).getHours();
          if (hour >= 8 && hour < 10) buckets[0] = (buckets[0] ?? 0) + s.total;
          else if (hour >= 10 && hour < 12) buckets[1] = (buckets[1] ?? 0) + s.total;
          else if (hour >= 12 && hour < 14) buckets[2] = (buckets[2] ?? 0) + s.total;
          else if (hour >= 14 && hour < 16) buckets[3] = (buckets[3] ?? 0) + s.total;
          else if (hour >= 16 && hour < 18) buckets[4] = (buckets[4] ?? 0) + s.total;
          else if (hour >= 18 && hour < 20) buckets[5] = (buckets[5] ?? 0) + s.total;
          else if (hour >= 20) buckets[6] = (buckets[6] ?? 0) + s.total;
        });

        const labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00+'];
        setTimelinePoints(labels.map((lbl, idx) => ({ label: lbl, value: buckets[idx] ?? 0 })));
      } else if (activeTab === '7days') {
        const recentSales = await db.sales
          .filter((s) => s.completed_at >= queryStart && s.completed_at <= queryEnd && s.status !== 'voided')
          .toArray();

        const days: { label: string; value: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(todayDate.getTime() - i * 86400000);
          const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
          const endMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
          const label = i === 0 ? 'Hari Ini' : `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`;

          const daySales = recentSales.filter((s) => s.completed_at >= startMs && s.completed_at <= endMs);
          const totalVal = daySales.reduce((sum, s) => sum + s.total, 0);
          days.push({ label, value: totalVal });
        }
        setTimelinePoints(days);
      } else if (activeTab === 'month') {
        const monthSales = await db.sales
          .filter((s) => s.completed_at >= queryStart && s.completed_at <= queryEnd && s.status !== 'voided')
          .toArray();

        // 6 interval 5-harian
        const intervals: { label: string; value: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const endDaysAgo = i * 5;
          const startDaysAgo = endDaysAgo + 4;
          const startMs = new Date(todayDate.getTime() - startDaysAgo * 86400000).setHours(0, 0, 0, 0);
          const endMs = new Date(todayDate.getTime() - endDaysAgo * 86400000).setHours(23, 59, 59, 999);

          const dStart = new Date(startMs);
          const dEnd = new Date(endMs);
          const label =
            i === 0
              ? `${dStart.getDate()} - Hari Ini`
              : `${dStart.getDate()}/${dStart.getMonth() + 1} - ${dEnd.getDate()}/${dEnd.getMonth() + 1}`;

          const intervalSales = monthSales.filter((s) => s.completed_at >= startMs && s.completed_at <= endMs);
          const totalVal = intervalSales.reduce((sum, s) => sum + s.total, 0);
          intervals.push({ label, value: totalVal });
        }
        setTimelinePoints(intervals);
      } else if (activeTab === 'all') {
        const allSales = await db.sales.filter((s) => s.status !== 'voided').toArray();

        if (allSales.length === 0) {
          setTimelinePoints([
            { label: 'Bln 1', value: 0 },
            { label: 'Bln 2', value: 0 },
            { label: 'Bln 3', value: 0 },
            { label: 'Bln 4', value: 0 },
            { label: 'Bln 5', value: 0 },
            { label: 'Bulan Ini', value: 0 },
          ]);
        } else {
          const monthMap = new Map<string, { label: string; value: number }>();
          allSales.forEach((s) => {
            const d = new Date(s.completed_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
            const item = monthMap.get(key) || { label: monthLabel, value: 0 };
            item.value += s.total;
            monthMap.set(key, item);
          });

          const sortedKeys = Array.from(monthMap.keys()).sort();
          const recentKeys = sortedKeys.slice(-6);
          if (recentKeys.length === 1) {
            setTimelinePoints([
              { label: 'Awal', value: 0 },
              monthMap.get(recentKeys[0]!)!,
            ]);
          } else {
            setTimelinePoints(recentKeys.map((k) => monthMap.get(k)!));
          }
        }
      }

      // 3. Active Cashier Session
      const currentActiveSession = await sessionService.getActiveSession();
      if (currentActiveSession) {
        const user = await db.users.get(currentActiveSession.user_id);
        setActiveSession({
          session: currentActiveSession,
          cashierName: user?.name || 'Kasir',
        });
      } else {
        setActiveSession(null);
      }

      // 4. Valuation & Stock Health
      const valuation = await reportService.getInventoryValuationReport();

      // Group valuation by Category for Donut chart
      const catTotals = new Map<string, number>();
      for (const it of valuation.items) {
        catTotals.set(it.categoryName, (catTotals.get(it.categoryName) || 0) + it.valuationRupiah);
      }
      const sortedCats = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]);
      const palette = ['#14463C', '#7DB594', '#F4B091', '#E69F73', '#D6D3C8'];

      let allocatedVal = 0;
      const topSegments: { name: string; percentage: number; color: string; value: number }[] = [];
      const topCount = Math.min(sortedCats.length, 4);

      for (let i = 0; i < topCount; i++) {
        const [cName, val] = sortedCats[i]!;
        allocatedVal += val;
        const pct = valuation.totalValuation > 0 ? (val / valuation.totalValuation) * 100 : 0;
        topSegments.push({
          name: cName,
          percentage: Math.round(pct * 10) / 10,
          color: palette[i % palette.length]!,
          value: val,
        });
      }

      if (sortedCats.length > 4) {
        const remainingVal = valuation.totalValuation - allocatedVal;
        const remainingPct =
          valuation.totalValuation > 0 ? (remainingVal / valuation.totalValuation) * 100 : 0;
        topSegments.push({
          name: 'Lainnya',
          percentage: Math.round(remainingPct * 10) / 10,
          color: palette[4]!,
          value: remainingVal,
        });
      }

      setValuationData({
        items: valuation.items,
        totalValuation: valuation.totalValuation,
        lowStockCount: valuation.lowStockCount,
        outOfStockCount: valuation.outOfStockCount,
        categorySegments: topSegments,
      });

      // 5. Perlu Perhatian (Low Stock + Expiring Batches)
      const listAttention: AttentionItem[] = [];

      // A. Out of stock or low stock items
      const criticalStock = valuation.items.filter((it) => it.status === 'Habis' || it.status === 'Menipis');
      for (const it of criticalStock.slice(0, 5)) {
        listAttention.push({
          id: `stock-${it.productId}`,
          type: it.status === 'Habis' ? 'OUT_OF_STOCK' : 'LOW_STOCK',
          name: it.productName,
          category: it.categoryName,
          stockDisplay: `${it.currentStock} ${it.unitCode}`,
          badgeLabel: it.status,
          badgeClass:
            it.status === 'Habis'
              ? 'bg-destructive text-destructive-text'
              : 'bg-warning text-warning-text',
          actionLabel: 'Kelola Stok',
          actionRoute: '/inventory',
        });
      }

      // B. Expiring Batches (<= 30 days)
      const expiringBatches = await batchService.getExpiringBatches(undefined, 30);
      for (const b of expiringBatches.slice(0, 5)) {
        let badgeLabel = `Exp: ${b.expiryDate}`;
        let badgeClass = 'bg-warning text-warning-text';

        if (b.status === 'EXPIRED') {
          badgeLabel = 'Kedaluwarsa';
          badgeClass = 'bg-destructive text-destructive-text';
        } else if (b.status === 'CRITICAL') {
          badgeLabel = `Kritis H-${b.daysRemaining}`;
          badgeClass = 'bg-destructive text-destructive-text';
        } else if (b.status === 'WARNING') {
          badgeLabel = `H-${b.daysRemaining}`;
          badgeClass = 'bg-warning text-warning-text';
        }

        listAttention.push({
          id: `batch-${b.batchId}`,
          type: b.status === 'EXPIRED' ? 'EXPIRED' : 'EXPIRING_CRITICAL',
          name: `${b.productName} (${b.batchCode})`,
          category: b.categoryName || 'Batch Produk',
          stockDisplay: `${b.currentStock} ${b.unitCode}`,
          badgeLabel,
          badgeClass,
          actionLabel: b.status === 'EXPIRED' ? 'Pemusnahan' : 'Lihat Batch',
          actionRoute: '/expiry',
        });
      }

      setAttentionItems(listAttention);

      // 6. Recent Activity Feed (Sales & Movements)
      const rawSales = await db.sales.orderBy('completed_at').reverse().limit(6).toArray();
      const rawMovements = await db.stock_movements.orderBy('occurred_at').reverse().limit(6).toArray();

      const userList = await db.users.toArray();
      const userMap = new Map(userList.map((u) => [u.id, u.name]));

      const combined: ActivityItem[] = [];

      for (const s of rawSales) {
        const timeStr = new Date(s.completed_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const isVoid = s.status === 'voided';
        const saleItemsCount = await db.sale_items.where('sale_id').equals(s.id).count();

        combined.push({
          id: `sale-${s.id}`,
          type: 'sale',
          title: `Penjualan #${s.receipt_no}`,
          actor: `Kasir: ${userMap.get(s.cashier_id) || 'Staff'}`,
          timeStr: `${timeStr} WIB`,
          created_at: s.completed_at,
          badgeText: isVoid ? 'Batal' : `+${formatRupiah(s.total)}`,
          badgeColorClass: isVoid ? 'text-destructive-text' : 'text-success-text',
          detailText: isVoid ? 'Transaksi Dibatalkan' : `${saleItemsCount} item (Tunai)`,
        });
      }

      for (const m of rawMovements) {
        const timeStr = new Date(m.occurred_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // Compute total qty from items
        const movItems = await db.stock_movement_items.where('movement_id').equals(m.id).toArray();
        const totalQty = movItems.reduce((acc, it) => acc + Math.abs(it.qty_delta_base), 0);

        if (m.type === 'RECEIPT') {
          combined.push({
            id: `mov-${m.id}`,
            type: 'receipt',
            title: 'Penerimaan Barang',
            actor: `Penerima: ${userMap.get(m.user_id) || 'Staff'}`,
            timeStr: `${timeStr} WIB`,
            created_at: m.occurred_at,
            badgeText: `+${totalQty} unit`,
            badgeColorClass: 'text-foreground font-semibold',
            detailText: m.ref_id ? `Faktur #${m.ref_id}` : 'Pemasok',
          });
        } else if (m.type === 'COUNT_ADJUSTMENT' || m.type === 'STOCKTAKE_ADJUSTMENT') {
          combined.push({
            id: `mov-${m.id}`,
            type: 'adjustment',
            title: m.type === 'STOCKTAKE_ADJUSTMENT' ? 'Penyesuaian Opname' : 'Koreksi Stok',
            actor: m.reason || 'Koreksi inventaris',
            timeStr: `${timeStr} WIB`,
            created_at: m.occurred_at,
            badgeText: `${totalQty} unit`,
            badgeColorClass: 'text-warning-text',
            detailText: `Oleh: ${userMap.get(m.user_id) || 'Supervisor'}`,
          });
        } else if (m.type === 'DAMAGE_SPOILAGE') {
          combined.push({
            id: `mov-${m.id}`,
            type: 'damage',
            title: 'Pemusnahan Barang',
            actor: m.reason || 'Rusak / Kedaluwarsa',
            timeStr: `${timeStr} WIB`,
            created_at: m.occurred_at,
            badgeText: `-${totalQty} unit`,
            badgeColorClass: 'text-destructive-text',
            detailText: 'Pemusnahan Batch',
          });
        }
      }

      combined.sort((a, b) => b.created_at - a.created_at);
      setRecentActivities(combined.slice(0, 5));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, reportService, batchService, sessionService]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // SVG Area Chart points calculation
  const maxVal = Math.max(...timelinePoints.map((p) => p.value), 1);
  const chartPoints = useMemo(() => {
    const totalPoints = timelinePoints.length;
    const xStep = totalPoints > 1 ? 600 / (totalPoints - 1) : 600;
    return timelinePoints.map((pt, idx) => {
      const x = idx * xStep;
      // Range: 140 (bottom) down to 20 (top)
      const y = 140 - (pt.value / maxVal) * 115;
      return { x, y, val: pt.value, label: pt.label };
    });
  }, [timelinePoints, maxVal]);

  const svgPathD = useMemo(() => {
    if (chartPoints.length === 0) return 'M 0,140 L 600,140';
    return chartPoints.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x},${pt.y}`;
      const prev = arr[i - 1]!;
      const cpX = (prev.x + pt.x) / 2;
      return `${acc} C ${cpX},${prev.y} ${cpX},${pt.y} ${pt.x},${pt.y}`;
    }, '');
  }, [chartPoints]);

  const svgAreaD = useMemo(() => {
    return `${svgPathD} L 600,160 L 0,160 Z`;
  }, [svgPathD]);

  // Donut chart stroke segments
  const circumference = 2 * Math.PI * 41; // ≈ 257.61

  return (
    <div className="flex flex-col gap-6">
      {/* Sesi Kasir Bar / Quick Nav Banner */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`size-11 rounded-full flex items-center justify-center shrink-0 ${
              activeSession ? 'bg-success/20 text-success-text' : 'bg-muted text-muted-foreground'
            }`}
          >
            <ShoppingCart className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-semibold text-base text-foreground">
                {activeSession ? 'Sesi Kasir Aktif' : 'Belum Ada Sesi Kasir'}
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${
                  activeSession
                    ? 'bg-success text-success-text'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {activeSession ? 'Aktif' : 'Tutup'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeSession
                ? `Kasir: ${activeSession.cashierName} · Modal Awal ${formatRupiah(activeSession.session.opening_cash)}`
                : 'Buka sesi kasir baru dengan modal awal untuk mulai melayani penjualan.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-pill hover:bg-primary-hover shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <ShoppingCart className="size-3.5" />
            <span>{activeSession ? 'Lanjut ke Kasir' : 'Buka Kasir Sekarang'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-pill hover:bg-accent transition-colors flex items-center gap-1.5"
          >
            <Package className="size-3.5" />
            <span>Katalog</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri / Utama (8 Kolom) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Kartu Hero: Penjualan + Grafik Area */}
          <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  <span>
                    {activeTab === 'today'
                      ? 'Penjualan Hari Ini'
                      : activeTab === '7days'
                      ? 'Penjualan 7 Hari Terakhir'
                      : activeTab === 'month'
                      ? 'Penjualan Bulan Ini'
                      : 'Semua Penjualan'}
                  </span>
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="font-serif font-bold text-3xl sm:text-4xl text-foreground tabular-nums">
                    {formatRupiah(salesSummary ? salesSummary.netSales : 0)}
                  </span>
                  {salesSummary && salesSummary.totalTransactions > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-pill bg-success text-success-text">
                      <TrendingUp className="size-3" />
                      <span>{salesSummary.totalTransactions} transaksi</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Switcher Rentang Waktu */}
              <div className="inline-flex p-1 bg-muted rounded-pill text-xs font-medium self-start sm:self-auto">
                {(
                  [
                    { id: 'today', label: 'Hari Ini' },
                    { id: '7days', label: '7 Hari' },
                    { id: 'month', label: '30 Hari' },
                    { id: 'all', label: 'Semua' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1 rounded-pill transition-colors ${
                      activeTab === tab.id
                        ? 'bg-card text-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Area Chart SVG */}
            <div className="w-full h-48 relative">
              {isLoading ? (
                <div className="size-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : (
                <>
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 600 160"
                    preserveAspectRatio="none"
                    aria-label="Grafik tren penjualan per jam"
                  >
                    <defs>
                      <linearGradient id="orbitGreenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7DB594" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#7DB594" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Garis Grid Horizontal Tipis */}
                    <line x1="0" y1="40" x2="600" y2="40" stroke="#E6E1D6" strokeDasharray="3 3" />
                    <line x1="0" y1="80" x2="600" y2="80" stroke="#E6E1D6" strokeDasharray="3 3" />
                    <line x1="0" y1="120" x2="600" y2="120" stroke="#E6E1D6" strokeDasharray="3 3" />

                    {/* Area gradasi */}
                    <path d={svgAreaD} fill="url(#orbitGreenGradient)" />

                    {/* Garis utama hijau pekat */}
                    <path
                      d={svgPathD}
                      fill="none"
                      stroke="#14463C"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Titik data */}
                    {chartPoints.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r={pt.val > 0 ? 4 : 2} fill="#14463C">
                          <title>{`${pt.label}: ${formatRupiah(pt.val)}`}</title>
                        </circle>
                        {pt.val > 0 && (
                          <circle cx={pt.x} cy={pt.y} r={7} fill="#14463C" fillOpacity={0.2} />
                        )}
                      </g>
                    ))}
                  </svg>

                  {/* Label Waktu Bawah Dinamis */}
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-2 font-medium">
                    {timelinePoints.map((pt, i) => (
                      <span key={i} className="text-center truncate px-0.5">
                        {pt.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Baris 3 Kartu Metrik */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Kartu 1: Laba Kotor */}
            <div
              onClick={() => navigate('/reports')}
              className="bg-card border border-border rounded-card p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span className="uppercase tracking-wider">Est. Laba Kotor</span>
                <ChevronRight className="size-4" />
              </div>
              <div className="mt-3">
                <div className="font-serif font-bold text-2xl text-foreground tabular-nums">
                  {formatRupiah(salesSummary ? salesSummary.estimatedGrossProfit : 0)}
                </div>
                <div className="flex items-center gap-1 text-xs text-success-text font-medium mt-1">
                  <span>
                    {salesSummary ? `${salesSummary.grossProfitMarginPercent}%` : '0%'} margin rata-rata
                  </span>
                </div>
              </div>
            </div>

            {/* Kartu 2: Transaksi Kasir */}
            <div
              onClick={() => navigate('/transactions')}
              className="bg-card border border-border rounded-card p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span className="uppercase tracking-wider">Jumlah Transaksi</span>
                <ChevronRight className="size-4" />
              </div>
              <div className="mt-3">
                <div className="font-serif font-bold text-2xl text-foreground tabular-nums">
                  {salesSummary ? salesSummary.totalTransactions : 0} struk
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-1">
                  <span>
                    Rata-rata{' '}
                    {formatRupiah(salesSummary ? salesSummary.averageBasketSize : 0)}/struk
                  </span>
                </div>
              </div>
            </div>

            {/* Kartu 3: Stok Menipis */}
            <div
              onClick={() => navigate('/inventory')}
              className="bg-card border border-border rounded-card p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span className="uppercase tracking-wider">Stok Menipis & Kritis</span>
                <ChevronRight className="size-4" />
              </div>
              <div className="mt-3">
                <div className="font-serif font-bold text-2xl text-destructive-text tabular-nums">
                  {valuationData.lowStockCount + valuationData.outOfStockCount} produk
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-1">
                  <span>
                    {valuationData.outOfStockCount} habis · {valuationData.lowStockCount} menipis
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabel: Perlu Perhatian (Stok Menipis & Batch Kedaluwarsa) */}
          <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif font-semibold text-lg text-foreground">
                  Perlu Perhatian
                </h2>
                <p className="text-xs text-muted-foreground">
                  Produk dengan stok kritis atau mendekati batas kedaluwarsa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1"
              >
                <span>Lihat inventaris</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>

            {attentionItems.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-card">
                <CheckCircle2 className="size-8 text-success-text mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  Semua stok dan batch dalam kondisi aman
                </p>
                <p className="text-xs mt-0.5">
                  Tidak ada barang yang menipis atau mendekati batas kedaluwarsa saat ini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="pb-3 font-semibold">Produk / Item</th>
                      <th className="pb-3 font-semibold">Kategori</th>
                      <th className="pb-3 font-semibold text-right">Stok Fisik</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attentionItems.map((item) => (
                      <tr key={item.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3.5 font-medium text-foreground">{item.name}</td>
                        <td className="py-3.5 text-xs text-muted-foreground">{item.category}</td>
                        <td className="py-3.5 text-right font-semibold text-foreground tabular-nums">
                          {item.stockDisplay}
                        </td>
                        <td className="py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-medium ${item.badgeClass}`}
                          >
                            <AlertTriangle className="size-3" />
                            <span>{item.badgeLabel}</span>
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(item.actionRoute)}
                            className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold rounded-pill hover:bg-accent transition-colors"
                          >
                            {item.actionLabel}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan (4 Kolom): Donut Persediaan & Aktivitas Terbaru */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Kartu: Komposisi Nilai Persediaan (Donut Chart) */}
          <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-lg text-foreground">
                Nilai Persediaan
              </h2>
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center"
              >
                <span>Rincian</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>

            {/* SVG Donut Chart */}
            <div className="relative flex items-center justify-center size-52 mx-auto my-3">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="none"
                  stroke="#EFEBE4"
                  strokeWidth="9"
                />

                {/* Slices */}
                {valuationData.totalValuation > 0 &&
                  (() => {
                    let accOffset = 0;
                    return valuationData.categorySegments.map((seg, idx) => {
                      const dashLength = (seg.percentage / 100) * circumference;
                      const segmentEl = (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="41"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="9"
                          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                          strokeDashoffset={-accOffset}
                        />
                      );
                      accOffset += dashLength;
                      return segmentEl;
                    });
                  })()}
              </svg>

              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-3"
                title={`Total Nilai Stok: ${formatRupiah(valuationData.totalValuation)}`}
              >
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                  Total Nilai Stok
                </span>
                <span className="font-serif font-bold text-2xl text-foreground tracking-tight leading-none tabular-nums">
                  {formatRupiahCompact(valuationData.totalValuation)}
                </span>
                <span className="text-[10px] text-muted-foreground/80 font-medium tabular-nums mt-1.5">
                  {formatRupiah(valuationData.totalValuation)}
                </span>
              </div>
            </div>

            {/* Legenda Kategori */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-border text-xs">
              {valuationData.categorySegments.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-2">
                  Belum ada data persediaan barang
                </p>
              ) : (
                valuationData.categorySegments.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-foreground font-medium">{seg.name}</span>
                    </div>
                    <span className="font-semibold text-muted-foreground">
                      {seg.percentage}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kartu: Aktivitas Terbaru */}
          <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-lg text-foreground">
                Aktivitas Terbaru
              </h2>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="text-xs font-semibold text-primary hover:text-primary-hover"
              >
                Lihat semua
              </button>
            </div>

            {recentActivities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Belum ada aktivitas transaksi atau mutasi stok.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`size-9 rounded-full flex items-center justify-center ${
                          act.type === 'sale'
                            ? 'bg-secondary text-primary'
                            : act.type === 'receipt'
                            ? 'bg-muted text-foreground'
                            : act.type === 'adjustment'
                            ? 'bg-warning/20 text-warning-text'
                            : 'bg-destructive/15 text-destructive-text'
                        }`}
                      >
                        {act.type === 'sale' ? (
                          <ArrowDownLeft className="size-4" />
                        ) : act.type === 'receipt' ? (
                          <Truck className="size-4" />
                        ) : act.type === 'adjustment' ? (
                          <Layers className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{act.title}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {act.actor} · {act.timeStr}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold ${act.badgeColorClass}`}>
                        {act.badgeText}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {act.detailText}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
