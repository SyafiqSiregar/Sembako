import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell,
  Package,
  CalendarClock,
  HardDriveDownload,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  CheckCheck,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { db } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { BatchService } from '@/services/batch.service';
import { formatRupiah } from '@/domain/money';

export type NotificationCategory = 'stock_expiry' | 'audit' | 'backup';
export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface OperationalNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  description: string;
  timestampLabel: string;
  targetRoute: string;
  actionLabel: string;
}

interface NotificationCenterPopoverProps {
  onBackupStatusChange?: (label: string, isSafe: boolean) => void;
}

export const NotificationCenterPopover: React.FC<NotificationCenterPopoverProps> = ({
  onBackupStatusChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  const inventoryService = useMemo(() => new InventoryService(db), []);
  const batchService = useMemo(
    () => new BatchService(db, inventoryService),
    [inventoryService]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<OperationalNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | NotificationCategory>('all');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const items: OperationalNotification[] = [];
      const now = Date.now();
      const todayDate = new Date();
      const startOfTodayMs = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate(),
        0,
        0,
        0,
        0
      ).getTime();

      // 1. Peringatan Stok Habis & Stok Menipis
      const stockSummaries = await inventoryService.listProductStockSummaries();
      const outOfStock = stockSummaries.filter((s) => s.status === 'out_of_stock');
      const lowStock = stockSummaries.filter((s) => s.status === 'low');

      if (outOfStock.length > 0) {
        const previewNames = outOfStock
          .slice(0, 2)
          .map((p) => `"${p.name}"`)
          .join(', ');
        const extra =
          outOfStock.length > 2 ? ` dan ${outOfStock.length - 2} lainnya` : '';
        items.push({
          id: `stock-out-${outOfStock.length}`,
          category: 'stock_expiry',
          severity: 'critical',
          title: `${outOfStock.length} Produk Stok Habis (0)`,
          description: `Produk ${previewNames}${extra} sudah kosong di inventaris dan tidak dapat dijual di kasir.`,
          timestampLabel: 'Stok Kritis',
          targetRoute: '/inventory',
          actionLabel: 'Cek Stok Habis',
        });
      }

      if (lowStock.length > 0) {
        const previewNames = lowStock
          .slice(0, 2)
          .map((p) => `"${p.name}" (${p.currentStock} ${p.baseUnitCode})`)
          .join(', ');
        const extra =
          lowStock.length > 2 ? ` dan ${lowStock.length - 2} lainnya` : '';
        items.push({
          id: `stock-low-${lowStock.length}`,
          category: 'stock_expiry',
          severity: 'warning',
          title: `${lowStock.length} Produk Stok Menipis`,
          description: `Persediaan ${previewNames}${extra} telah menyentuh batas stok minimum kulakan.`,
          timestampLabel: 'Perlu Kulakan',
          targetRoute: '/inventory',
          actionLabel: 'Lihat Inventaris',
        });
      }

      // 2. Peringatan Batch Kedaluwarsa & Kritis H-7
      const expiringBatches = await batchService.getExpiringBatches(undefined, 30);
      const expiredList = expiringBatches.filter((b) => b.status === 'EXPIRED');
      const criticalList = expiringBatches.filter((b) => b.status === 'CRITICAL');

      if (expiredList.length > 0) {
        const previewBatches = expiredList
          .slice(0, 2)
          .map((b) => `"${b.productName}" (#${b.batchCode})`)
          .join(', ');
        items.push({
          id: `batch-expired-${expiredList.length}`,
          category: 'stock_expiry',
          severity: 'critical',
          title: `${expiredList.length} Batch Sudah Kedaluwarsa`,
          description: `Batch ${previewBatches} otomatis diblokir dari POS dan perlu segera dimusnahkan (write-off).`,
          timestampLabel: 'FEFO Blokir',
          targetRoute: '/expiry',
          actionLabel: 'Musnahkan Batch',
        });
      }

      if (criticalList.length > 0) {
        const previewBatches = criticalList
          .slice(0, 2)
          .map((b) => `"${b.productName}" (${b.daysRemaining} hari lagi)`)
          .join(', ');
        items.push({
          id: `batch-critical-${criticalList.length}`,
          category: 'stock_expiry',
          severity: 'warning',
          title: `${criticalList.length} Batch Kritis Kedaluwarsa (≤ 7 Hari)`,
          description: `Batch ${previewBatches} mendekati tanggal kedaluwarsa. Prioritaskan penjualan lebih dulu.`,
          timestampLabel: 'H-7 Kedaluwarsa',
          targetRoute: '/expiry',
          actionLabel: 'Pantau Kedaluwarsa',
        });
      }

      // 3. Peringatan Audit Hari Ini (Void, Retur, Koreksi Stok)
      const [todaySales, todayReturns, todayMovements] = await Promise.all([
        db.sales
          .filter(
            (s) =>
              s.status === 'voided' &&
              (s.voided_at ?? s.updated_at) >= startOfTodayMs
          )
          .toArray(),
        db.returns.filter((r) => r.created_at >= startOfTodayMs).toArray(),
        db.stock_movements
          .filter(
            (m) =>
              m.occurred_at >= startOfTodayMs &&
              [
                'COUNT_ADJUSTMENT',
                'DAMAGE_SPOILAGE',
                'REVERSAL',
                'RETURN_WRITE_OFF',
              ].includes(m.type)
          )
          .toArray(),
      ]);

      if (todaySales.length > 0) {
        const totalVoidNominal = todaySales.reduce((acc, s) => acc + s.total, 0);
        items.push({
          id: `audit-void-${todaySales.length}-${totalVoidNominal}`,
          category: 'audit',
          severity: 'critical',
          title: `${todaySales.length} Transaksi Di-Void Hari Ini`,
          description: `Total nilai struk dibatalkan hari ini mencapai ${formatRupiah(totalVoidNominal)}. Periksa alasan pembatalan kasir.`,
          timestampLabel: 'Audit Kasir',
          targetRoute: '/transactions',
          actionLabel: 'Periksa Struk Void',
        });
      }

      if (todayReturns.length > 0) {
        const totalRefundNominal = todayReturns.reduce(
          (acc, r) => acc + r.total_refund,
          0
        );
        items.push({
          id: `audit-return-${todayReturns.length}-${totalRefundNominal}`,
          category: 'audit',
          severity: 'warning',
          title: `${todayReturns.length} Retur Pelanggan Hari Ini`,
          description: `Tercatat pengembalian dana retur pelanggan hari ini sebesar ${formatRupiah(totalRefundNominal)}.`,
          timestampLabel: 'Audit Retur',
          targetRoute: '/transactions',
          actionLabel: 'Lihat Riwayat Retur',
        });
      }

      if (todayMovements.length > 0) {
        items.push({
          id: `audit-movement-${todayMovements.length}`,
          category: 'audit',
          severity: 'info',
          title: `${todayMovements.length} Koreksi / Pemusnahan Stok Hari Ini`,
          description: `Terdapat ${todayMovements.length} aktivitas penyesuaian saldo stok manual, barang rusak, atau reversal hari ini.`,
          timestampLabel: 'Audit Inventaris',
          targetRoute: '/settings',
          actionLabel: 'Buka Audit Log',
        });
      }

      // 4. Pengingat Backup Database Lokal
      const allSuccessBackups = await db.backup_history
        .filter((b) => b.status === 'success')
        .toArray();
      allSuccessBackups.sort((a, b) => b.created_at - a.created_at);
      const latestBackup = allSuccessBackups[0];

      if (!latestBackup) {
        onBackupStatusChange?.('Belum pernah di-backup', false);
        items.push({
          id: 'backup-never',
          category: 'backup',
          severity: 'warning',
          title: 'Database Toko Belum Pernah Di-backup',
          description:
            'Data toko disimpan lokal di perangkat ini. Buat file cadangan (backup) secara berkala agar data barang & transaksi tetap aman.',
          timestampLabel: 'Keamanan Data',
          targetRoute: '/settings',
          actionLabel: 'Backup Sekarang',
        });
      } else {
        const hoursSinceBackup = (now - latestBackup.created_at) / (1000 * 60 * 60);
        const formattedTime = new Date(latestBackup.created_at).toLocaleString(
          'id-ID',
          {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }
        );

        onBackupStatusChange?.(formattedTime, hoursSinceBackup <= 24);

        if (hoursSinceBackup > 24) {
          const daysAgo = Math.floor(hoursSinceBackup / 24);
          items.push({
            id: `backup-stale-${latestBackup.id}`,
            category: 'backup',
            severity: 'warning',
            title: `Belum Backup Data (${daysAgo} Hari Terakhir)`,
            description: `Backup terakhir dibuat pada ${formattedTime}. Disarankan mengunduh backup setiap selesai tutup sesi kasir.`,
            timestampLabel: 'Pengingat Backup',
            targetRoute: '/settings',
            actionLabel: 'Buka Menu Backup',
          });
        }
      }

      setNotifications(items);
    } catch (err) {
      console.error('Error loading operational notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [inventoryService, batchService, onBackupStatusChange]);

  // Muat notifikasi saat awal dan setiap berpindah halaman
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, location.pathname]);

  // Tutup popover saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeNotifications = useMemo(
    () => notifications.filter((n) => !dismissedIds.has(n.id)),
    [notifications, dismissedIds]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return activeNotifications;
    return activeNotifications.filter((n) => n.category === activeFilter);
  }, [activeNotifications, activeFilter]);

  const unreadCount = activeNotifications.length;
  const hasCritical = activeNotifications.some((n) => n.severity === 'critical');

  const handleToggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      loadNotifications();
    }
  };

  const handleDismissOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleMarkAllRead = () => {
    setDismissedIds(new Set(notifications.map((n) => n.id)));
  };

  const handleResetDismissed = () => {
    setDismissedIds(new Set());
    loadNotifications();
  };

  const handleNavigate = (route: string) => {
    setIsOpen(false);
    navigate(route);
  };

  const renderIcon = (item: OperationalNotification) => {
    const iconColorClass =
      item.severity === 'critical'
        ? 'bg-destructive text-destructive-foreground border-destructive-foreground/15'
        : item.severity === 'warning'
          ? 'bg-warning text-warning-foreground border-warning-foreground/15'
          : 'bg-info text-info-foreground border-info-foreground/15';

    if (item.category === 'backup') {
      return (
        <div
          className={`size-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconColorClass}`}
        >
          <HardDriveDownload className="size-4" />
        </div>
      );
    }
    if (item.category === 'audit') {
      return (
        <div
          className={`size-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconColorClass}`}
        >
          <ShieldAlert className="size-4" />
        </div>
      );
    }
    if (item.id.startsWith('batch-')) {
      return (
        <div
          className={`size-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconColorClass}`}
        >
          <CalendarClock className="size-4" />
        </div>
      );
    }
    return (
      <div
        className={`size-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconColorClass}`}
      >
        <Package className="size-4" />
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Tombol Lonceng Notifikasi */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label={`Notifikasi operasional toko (${unreadCount} peringatan aktif)`}
        aria-expanded={isOpen}
        title="Pusat Peringatan Operasional Toko"
        className={`relative size-9 rounded-full border flex items-center justify-center transition-all active:scale-95 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ${
          isOpen
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-input text-foreground hover:bg-muted'
        }`}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center tabular-nums shadow-sm ring-2 ring-background ${
              hasCritical
                ? 'bg-destructive-foreground text-white'
                : 'bg-warning-foreground text-white'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel Popover Notifikasi (Responsif Mobile & Desktop, Bebas Scrollbar Horizontal) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Panel Peringatan Operasional Toko"
          className="fixed inset-x-3 top-16 sm:inset-x-auto sm:absolute sm:right-0 sm:top-12 z-50 sm:w-[420px] bg-card border border-border rounded-card shadow-2xl overflow-hidden flex flex-col max-h-[82vh] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 1. Header Bersih dengan Ghost Actions */}
          <div className="px-4 pt-3.5 pb-2.5 bg-card flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-serif font-bold text-base text-foreground tracking-tight truncate">
                Peringatan Toko
              </h3>
              <span
                className={`px-2 py-0.5 rounded-pill text-[11px] font-bold tabular-nums shrink-0 ${
                  unreadCount > 0
                    ? hasCritical
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-warning text-warning-foreground'
                    : 'bg-success text-success-foreground'
                }`}
              >
                {unreadCount > 0 ? `${unreadCount} Aktif` : 'Aman'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="Tandai semua peringatan sudah dilihat"
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold text-primary hover:bg-secondary/80 active:scale-[0.98] inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCheck className="size-3.5" />
                  <span>Tandai dibaca</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetDismissed}
                disabled={loading}
                title="Perbarui & tampilkan ulang semua peringatan"
                aria-label="Segarkan peringatan"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 flex items-center justify-center transition-all cursor-pointer"
              >
                <RotateCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup panel notifikasi"
                className="sm:hidden size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* 2. Segmented Tab Bar 4-Kolom (100% Tanpa Scrollbar Horizontal) */}
          <div className="px-3.5 pb-3 bg-card border-b border-border">
            <div
              role="tablist"
              aria-label="Filter kategori peringatan"
              className="grid grid-cols-4 gap-1 p-1 bg-muted/80 rounded-xl border border-border/60"
            >
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'stock_expiry', label: 'Stok & ED' },
                  { id: 'audit', label: 'Audit' },
                  { id: 'backup', label: 'Backup' },
                ] as const
              ).map((tab) => {
                const count =
                  tab.id === 'all'
                    ? activeNotifications.length
                    : activeNotifications.filter((n) => n.category === tab.id).length;
                const active = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`min-h-[30px] px-1.5 py-1 rounded-lg text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer select-none ${
                      active
                        ? 'bg-card text-foreground font-bold shadow-sm ring-1 ring-border/70'
                        : 'text-muted-foreground hover:text-foreground font-semibold hover:bg-card/50'
                    }`}
                  >
                    <span className="truncate">{tab.label}</span>
                    {count > 0 && (
                      <span
                        className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-extrabold tabular-nums inline-flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-foreground/10 text-foreground'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Feed Kartu Peringatan Berstruktur */}
          <div className="flex-1 overflow-y-auto p-3 bg-muted/30 flex flex-col gap-2.5 max-h-[380px]">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 px-6 bg-card border border-border/70 rounded-xl text-center flex flex-col items-center justify-center gap-2 shadow-sm">
                <div className="size-11 rounded-2xl bg-success text-success-foreground flex items-center justify-center">
                  <CheckCircle2 className="size-6" />
                </div>
                <div className="font-bold text-sm text-foreground mt-1">
                  Semua Operasional Toko Aman
                </div>
                <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  Tidak ada peringatan aktif pada kategori ini. Stok mencukupi, batch terkendali, dan audit terpantau.
                </p>
                {dismissedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleResetDismissed}
                    className="mt-2 min-h-[34px] px-3.5 py-1.5 rounded-pill border border-input bg-card hover:bg-muted text-xs font-semibold text-primary transition cursor-pointer shadow-sm"
                  >
                    Tampilkan kembali {dismissedIds.size} peringatan
                  </button>
                )}
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNavigate(item.targetRoute)}
                  className={`group relative bg-card hover:bg-card/95 border border-border/80 hover:border-primary/40 rounded-xl p-3.5 shadow-sm hover:shadow transition-all cursor-pointer flex items-start gap-3 border-l-4 ${
                    item.severity === 'critical'
                      ? 'border-l-destructive-foreground'
                      : item.severity === 'warning'
                        ? 'border-l-warning-foreground'
                        : 'border-l-info-foreground'
                  }`}
                >
                  {renderIcon(item)}

                  <div className="flex-1 min-w-0">
                    {/* Baris 1: Overline Status & Tombol Sembunyikan */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider ${
                          item.severity === 'critical'
                            ? 'text-destructive-foreground'
                            : item.severity === 'warning'
                              ? 'text-warning-foreground'
                              : 'text-info-foreground'
                        }`}
                      >
                        {item.timestampLabel}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleDismissOne(e, item.id)}
                        title="Sembunyikan peringatan ini"
                        aria-label="Sembunyikan peringatan"
                        className="-mr-1.5 -mt-1 size-6 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    {/* Baris 2: Judul Peringatan */}
                    <h4 className="text-[13px] font-bold text-foreground leading-snug mt-0.5">
                      {item.title}
                    </h4>

                    {/* Baris 3: Deskripsi Rapi */}
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      {item.description}
                    </p>

                    {/* Baris 4: Chip CTA Kontekstual */}
                    <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground font-medium truncate">
                        Tindak lanjuti sekarang
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/80 group-hover:bg-primary text-secondary-foreground group-hover:text-primary-foreground text-[11px] font-bold transition-colors shrink-0">
                        <span>{item.actionLabel}</span>
                        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 4. Footer Status & Pintasan Laporan */}
          <div className="px-4 py-2.5 bg-card border-t border-border flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="size-1.5 rounded-full bg-success-foreground shrink-0" />
              <span className="truncate">Sinkron otomatis dari database lokal</span>
            </div>
            <button
              type="button"
              onClick={() => handleNavigate('/reports')}
              className="font-bold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
            >
              <span>Lihat Laporan</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
