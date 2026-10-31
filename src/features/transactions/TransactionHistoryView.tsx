import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Receipt,
  RotateCcw,
  Printer,
  AlertCircle,
  Eye,
  Undo2,
  Lock,
  ChevronDown,
  Info,
  History,
} from 'lucide-react';
import { db, type Sale, type SaleItem, type Payment } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { CheckoutService } from '@/services/checkout.service';
import { formatRupiah } from '@/domain/money';
import { authorize } from '@/domain/permissions';
import { SettingsService } from '@/services/settings.service';
import { buildReceiptHtml } from '@/services/receipt.service';
import { printHtmlDocument } from '@/lib/print';
import { useAuthStore } from '@/features/auth/authStore';
import { PinPad } from '@/components/shared/PinPad';

interface TransactionRow {
  sale: Sale;
  payment?: Payment;
  itemCount: number;
  cashierName: string;
}

export const TransactionHistoryView: React.FC = () => {
  const { currentUser, activeSession, roleCodes } = useAuthStore();
  const inventoryService = useMemo(() => new InventoryService(db), []);
  const checkoutService = useMemo(() => new CheckoutService(db, inventoryService), [inventoryService]);
  const settingsService = useMemo(() => new SettingsService(db), []);
  const [isReprinting, setIsReprinting] = useState(false);
  const [reprintError, setReprintError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'all'>(
    searchParams.get('search') ? 'all' : 'today'
  );
  const [returnDaysLimit, setReturnDaysLimit] = useState(7);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q) {
      setSearchQuery(q);
      setDateFilter('all');
    }
  }, [searchParams]);

  // Modals
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{
    sale: Sale;
    items: SaleItem[];
    payment?: Payment;
    cashierName: string;
    returns: Array<{
      ret: any;
      items: Array<{
        id: string;
        qty_base: number;
        condition?: 'sellable' | 'damaged' | 'expired';
        productName: string;
        unitCode: string;
        factor: number;
      }>;
    }>;
  } | null>(null);

  // Void modal state
  const [voidTargetSale, setVoidTargetSale] = useState<Sale | null>(null);
  const [voidPin, setVoidPin] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  // Return modal state
  const [returnTargetSale, setReturnTargetSale] = useState<{
    sale: Sale;
    items: (SaleItem & { maxReturnableQty: number })[];
  } | null>(null);
  const [returnSelections, setReturnSelections] = useState<Record<string, number>>({});
  const [returnConditions, setReturnConditions] = useState<Record<string, 'sellable' | 'damaged' | 'expired'>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const sales = await db.sales.orderBy('completed_at').reverse().toArray();
      const users = await db.users.toArray();
      const userMap = new Map(users.map((u) => [u.id, u.name]));

      const rows: TransactionRow[] = [];
      for (const sale of sales) {
        const payment = await db.payments.where('sale_id').equals(sale.id).first();
        const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();
        const cashierName = userMap.get(sale.cashier_id) || 'Kasir';

        rows.push({
          sale,
          payment,
          itemCount: items.reduce((s, it) => s + it.qty_base / it.factor_snapshot, 0),
          cashierName,
        });
      }

      setTransactions(rows);
    } catch (e) {
      console.error('Error loading transactions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    const loadSettings = async () => {
      const s = await db.app_settings.get('store_settings');
      if (s) {
        try {
          const parsed = JSON.parse(s.value_json);
          if (typeof parsed.returnDaysLimit === 'number') {
            setReturnDaysLimit(parsed.returnDaysLimit);
          }
        } catch {}
      }
    };
    loadSettings();
  }, []);

  const isPastReturnLimit = (sale: Sale) => {
    if (returnDaysLimit <= 0) return false;
    const elapsedMs = Date.now() - sale.completed_at;
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    return elapsedDays > returnDaysLimit;
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    let list = transactions;

    // Filter status
    if (statusFilter !== 'all') {
      list = list.filter((t) => t.sale.status === statusFilter);
    }

    // Filter tanggal
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (dateFilter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      list = list.filter((t) => t.sale.completed_at >= startOfDay.getTime());
    } else if (dateFilter === '7days') {
      list = list.filter((t) => t.sale.completed_at >= now - 7 * oneDay);
    }

    // Filter search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.sale.receipt_no.toLowerCase().includes(q) ||
          t.cashierName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [transactions, statusFilter, dateFilter, searchQuery]);

  // View detail
  const handleReprint = async () => {
    if (!selectedSaleDetail) return;
    setReprintError(null);
    try {
      authorize(roleCodes, 'sale.reprint', currentUser?.name);
      setIsReprinting(true);
      const store = await settingsService.getStoreSettings();
      const { sale, items, payment, cashierName } = selectedSaleDetail;
      await printHtmlDocument(
        buildReceiptHtml({
          sale,
          items,
          payment: payment ?? null,
          cashierName,
          store,
          paperWidth: store.defaultPaperWidth,
          reprintedAt: Date.now(),
        })
      );
    } catch (err) {
      setReprintError(err instanceof Error ? err.message : 'Gagal mencetak ulang struk.');
    } finally {
      setIsReprinting(false);
    }
  };

  const handleOpenDetail = async (sale: Sale, cashierName: string) => {
    setReprintError(null);
    const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();
    const payment = await db.payments.where('sale_id').equals(sale.id).first();
    const saleReturns = await db.returns.where('original_sale_id').equals(sale.id).toArray();
    const returnDetails = await Promise.all(
      saleReturns.map(async (ret) => {
        const retItems = await db.return_items.where('return_id').equals(ret.id).toArray();
        const enrichedItems = retItems.map((ri) => {
          const match = items.find((it) => it.id === ri.sale_item_id);
          return {
            ...ri,
            productName: match?.name_snapshot || 'Barang',
            unitCode: match?.unit_code_snapshot || 'pcs',
            factor: match?.factor_snapshot || 1,
          };
        });
        return { ret, items: enrichedItems };
      })
    );

    setSelectedSaleDetail({
      sale,
      items,
      payment,
      cashierName,
      returns: returnDetails,
    });
  };

  // Void execution (requires Supervisor/Owner authorization)
  const handleConfirmVoid = async () => {
    if (!voidTargetSale) return;
    if (!voidReason.trim()) {
      setVoidError('Alasan pembatalan (void) wajib diisi');
      return;
    }

    try {
      setIsVoiding(true);
      setVoidError(null);

      // Verifikasi PIN Supervisor (AC-07, BR-15)
      // Cek apakah ada supervisor/owner dengan PIN ini
      const users = await db.users.where('status').equals('active').toArray();
      let supervisorUser = null;
      for (const u of users) {
        // Cek peran
        const roles = await db.user_roles.where('user_id').equals(u.id).toArray();
        const roleObjs = await db.roles.where('id').anyOf(roles.map((r) => r.role_id)).toArray();
        const isSpvOrOwner = roleObjs.some((r) => r.code === 'supervisor' || r.code === 'owner');
        if (isSpvOrOwner) {
          // Verify PIN
          const { verifyPin } = await import('@/domain/auth/pin');
          const ok = await verifyPin(voidPin, u.pin_hash, u.pin_salt);
          if (ok) {
            supervisorUser = u;
            break;
          }
        }
      }

      if (!supervisorUser) {
        setVoidError('Otorisasi gagal: PIN Supervisor tidak valid');
        setIsVoiding(false);
        return;
      }

      await checkoutService.voidSale({
        saleId: voidTargetSale.id,
        voidedBy: supervisorUser.id,
        voidReason: voidReason.trim(),
        currentSessionId: activeSession?.id,
      });

      showNotification('success', `Transaksi #${voidTargetSale.receipt_no} berhasil dibatalkan (void)`);
      setVoidTargetSale(null);
      setVoidPin('');
      setVoidReason('');
      await loadTransactions();
      if (selectedSaleDetail?.sale.id === voidTargetSale.id) {
        setSelectedSaleDetail(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal membatalkan transaksi';
      setVoidError(msg);
    } finally {
      setIsVoiding(false);
    }
  };

  // Open return modal
  const handleOpenReturnModal = async (sale: Sale) => {
    const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();
    const existingReturns = await db.returns.where('original_sale_id').equals(sale.id).toArray();
    const existingReturnIds = existingReturns.map((r) => r.id);
    const existingReturnItems = existingReturnIds.length > 0
      ? await db.return_items.where('return_id').anyOf(existingReturnIds).toArray()
      : [];

    const itemsWithMax = items.map((it) => {
      const prevReturnedBase = existingReturnItems
        .filter((ri) => ri.sale_item_id === it.id)
        .reduce((sum, ri) => sum + ri.qty_base, 0);
      const maxReturnableBase = Math.max(0, it.qty_base - prevReturnedBase);
      const maxReturnableQty = Math.floor(maxReturnableBase / it.factor_snapshot);
      return { ...it, maxReturnableQty };
    });

    setReturnTargetSale({ sale, items: itemsWithMax });
    setReturnSelections({});
    setReturnConditions({});
    setReturnReason('');
    setReturnError(null);
  };

  // Computed live refund total
  const computedRefundTotal = useMemo(() => {
    if (!returnTargetSale) return 0;
    let total = 0;
    for (const [saleItemId, returnQty] of Object.entries(returnSelections)) {
      if (returnQty > 0) {
        const item = returnTargetSale.items.find((it) => it.id === saleItemId);
        if (item) {
          total += Math.floor((returnQty * item.unit_price_snapshot) / item.factor_snapshot);
        }
      }
    }
    return total;
  }, [returnTargetSale, returnSelections]);

  // Confirm return execution (AC-08, BR-18, BR-19, AC-28)
  const handleConfirmReturn = async () => {
    if (!returnTargetSale || !currentUser) return;
    if (!returnReason.trim()) {
      setReturnError('Alasan retur wajib diisi');
      return;
    }

    const returnItemsInput: {
      saleItemId: string;
      qtyBase: number;
      refundAmount: number;
      condition: 'sellable' | 'damaged' | 'expired';
    }[] = [];

    for (const [saleItemId, returnQty] of Object.entries(returnSelections)) {
      if (returnQty > 0) {
        const item = returnTargetSale.items.find((it) => it.id === saleItemId);
        if (item) {
          const unitPrice = item.unit_price_snapshot;
          const refund = Math.floor((returnQty * unitPrice) / item.factor_snapshot);
          const cond = returnConditions[saleItemId] || 'sellable';
          returnItemsInput.push({
            saleItemId,
            qtyBase: returnQty * item.factor_snapshot,
            refundAmount: refund,
            condition: cond,
          });
        }
      }
    }

    if (returnItemsInput.length === 0) {
      setReturnError('Pilih minimal satu barang dengan kuantitas > 0 untuk diretur');
      return;
    }

    try {
      setIsReturning(true);
      setReturnError(null);

      const res = await checkoutService.processReturn({
        saleId: returnTargetSale.sale.id,
        returnedBy: currentUser.id,
        reason: returnReason.trim(),
        items: returnItemsInput,
      });

      showNotification('success', `Retur #${res.returnNo} berhasil! Pengembalian dana: ${formatRupiah(res.totalRefund)}`);
      setReturnTargetSale(null);
      await loadTransactions();
      if (selectedSaleDetail?.sale.id === returnTargetSale.sale.id) {
        setSelectedSaleDetail(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memproses retur';
      setReturnError(msg);
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Unified Table Card */}
      <div className="bg-card border border-border rounded-card shadow-sm overflow-hidden">
        {/* Card Header Toolbar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. Struk atau Kasir..."
              className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-pill text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Periode Tanggal */}
            <div className="inline-flex p-1 bg-muted rounded-pill border border-border/40 text-xs font-medium">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1 rounded-pill transition-all ${
                  dateFilter === 'today'
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setDateFilter('7days')}
                className={`px-3 py-1 rounded-pill transition-all ${
                  dateFilter === '7days'
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                7 Hari
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1 rounded-pill transition-all ${
                  dateFilter === 'all'
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua
              </button>
            </div>

            {/* Filter Status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 pl-3 pr-8 bg-background border border-input rounded-pill text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai</option>
                <option value="voided">Dibatalkan (Void)</option>
                <option value="partially_returned">Retur Sebagian</option>
                <option value="fully_returned">Retur Penuh</option>
              </select>
              <ChevronDown className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Action Button */}
            <button
              onClick={loadTransactions}
              className="size-9 rounded-pill border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-xs shrink-0"
              title="Segarkan Data"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Content Area directly inside Card */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Memuat data transaksi...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="size-12 stroke-[1.5] text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Tidak ada transaksi ditemukan</p>
              <p className="text-xs text-muted-foreground mt-0.5">Coba sesuaikan filter pencarian atau periode tanggal</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">No. Struk</th>
                  <th className="px-4 py-3.5">Waktu Transaksi</th>
                  <th className="px-4 py-3.5">Kasir</th>
                  <th className="px-4 py-3.5">Metode</th>
                  <th className="px-4 py-3.5 text-right">Total Belanja</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTransactions.map((t) => {
                  const dateStr = new Date(t.sale.completed_at).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });

                  return (
                    <tr key={t.sale.id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-foreground">
                        {t.sale.receipt_no}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{dateStr}</td>
                      <td className="px-4 py-3.5 font-medium text-foreground">{t.cashierName}</td>
                      <td className="px-4 py-3.5">
                        <span className="capitalize text-muted-foreground">
                          {t.payment?.method === 'cash'
                            ? 'Tunai'
                            : t.payment?.reference_no
                            ? t.payment.reference_no.split(' - ')[0]
                            : 'Non-Tunai'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold font-mono text-foreground">
                        {formatRupiah(t.sale.total)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider ${
                            t.sale.status === 'completed'
                              ? 'bg-success text-success-foreground border border-success/30'
                              : t.sale.status === 'voided'
                              ? 'bg-destructive text-destructive-foreground border border-destructive/30'
                              : 'bg-warning text-warning-foreground border border-warning/30'
                          }`}
                        >
                          {t.sale.status === 'completed'
                            ? 'Selesai'
                            : t.sale.status === 'voided'
                            ? 'Void'
                            : t.sale.status === 'partially_returned'
                            ? 'Retur Sebagian'
                            : 'Retur Penuh'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleOpenDetail(t.sale, t.cashierName)}
                          className="px-2.5 py-1 rounded-pill border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                          title="Lihat Detail & Cetak Ulang"
                        >
                          <Eye className="size-3 inline mr-1" />
                          Detail
                        </button>

                        {t.sale.status === 'completed' && (
                          <button
                            onClick={() => {
                              setVoidTargetSale(t.sale);
                              setVoidPin('');
                              setVoidReason('');
                              setVoidError(null);
                            }}
                            disabled={t.sale.session_id !== activeSession?.id}
                            className={`px-2.5 py-1 rounded-pill border text-xs font-semibold transition-colors ${
                              t.sale.session_id === activeSession?.id
                                ? 'border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive-text'
                                : 'opacity-40 cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                            }`}
                            title={
                              t.sale.session_id === activeSession?.id
                                ? 'Batalkan Transaksi (Void)'
                                : 'Sesi kasir sudah ditutup. Gunakan Retur untuk pengembalian barang.'
                            }
                          >
                            Void
                          </button>
                        )}

                        {(t.sale.status === 'completed' || t.sale.status === 'partially_returned') && (
                          <button
                            onClick={() => handleOpenReturnModal(t.sale)}
                            disabled={isPastReturnLimit(t.sale)}
                            className={`px-2.5 py-1 rounded-pill border text-xs font-semibold transition-colors ${
                              !isPastReturnLimit(t.sale)
                                ? 'border-warning/40 bg-warning/20 hover:bg-warning/30 text-warning-text'
                                : 'opacity-40 cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                            }`}
                            title={
                              !isPastReturnLimit(t.sale)
                                ? 'Retur Barang Pelanggan'
                                : `Batas waktu retur (${returnDaysLimit} hari) telah terlampaui`
                            }
                          >
                            Retur
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: Detail Penjualan & Cetak Ulang Struk              */}
      {/* ======================================================== */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg">Struk #{selectedSaleDetail.sale.receipt_no}</h3>
                <p className="text-xs text-white/80">Kasir: {selectedSaleDetail.cashierName}</p>
              </div>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-[#FBF8F3] space-y-4">
              {/* Item Lines */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Item Pembelian</span>
                <div className="divide-y divide-stone-100 pt-1">
                  {selectedSaleDetail.items.map((it) => (
                    <div key={it.id} className="py-2 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-stone-800">{it.name_snapshot}</div>
                        <div className="text-[11px] text-stone-500">
                          {it.qty_base / it.factor_snapshot} {it.unit_code_snapshot} x {formatRupiah(it.unit_price_snapshot)}
                        </div>
                      </div>
                      <div className="font-bold text-stone-900">{formatRupiah(it.line_total)}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-stone-200 space-y-1 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span>{formatRupiah(selectedSaleDetail.sale.subtotal)}</span>
                  </div>
                  {selectedSaleDetail.sale.discount_total > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Diskon Transaksi</span>
                      <span>-{formatRupiah(selectedSaleDetail.sale.discount_total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-[#14463C] pt-1 border-t border-stone-100">
                    <span>Total</span>
                    <span>{formatRupiah(selectedSaleDetail.sale.total)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 pt-1">
                    <span>
                      Bayar ({selectedSaleDetail.payment?.method === 'cash' ? 'Tunai' : (selectedSaleDetail.payment?.reference_no || 'Non-Tunai')})
                    </span>
                    <span>{formatRupiah(selectedSaleDetail.payment?.amount || selectedSaleDetail.sale.total)}</span>
                  </div>
                  {selectedSaleDetail.payment?.reference_no && (
                    <div className="flex justify-between text-[11px] text-stone-500">
                      <span>Referensi Pembayaran</span>
                      <span className="font-mono">{selectedSaleDetail.payment.reference_no}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* GAP-08: Visual Audit Timeline per Transaksi */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#14463C]" />
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    Kronologi & Audit Transaksi
                  </span>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                  {/* Event 1: Transaksi Selesai */}
                  <div className="relative">
                    <div className="absolute -left-6 top-0.5 size-4 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-[9px] text-white">
                      ✓
                    </div>
                    <div className="text-xs font-semibold text-stone-800">
                      Transaksi Selesai Diposting
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {new Date(selectedSaleDetail.sale.completed_at || selectedSaleDetail.sale.created_at).toLocaleString('id-ID')} • Kasir: {selectedSaleDetail.cashierName}
                    </div>
                  </div>

                  {/* Event 2: Riwayat Retur (jika ada) */}
                  {selectedSaleDetail.returns && selectedSaleDetail.returns.length > 0 && selectedSaleDetail.returns.map(({ ret, items }) => (
                    <div key={ret.id} className="relative">
                      <div className="absolute -left-6 top-0.5 size-4 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-[9px] text-white">
                        ↩
                      </div>
                      <div className="text-xs font-semibold text-amber-900">
                        Retur Barang Pelanggan #{ret.receipt_no}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {new Date(ret.created_at).toLocaleString('id-ID')} • Pengembalian Dana: <strong className="text-amber-800">{formatRupiah(ret.refund_total)}</strong>
                      </div>
                      <div className="text-[11px] text-stone-600 italic mt-0.5">
                        Alasan: &ldquo;{ret.reason || 'Tidak ada catatan'}&rdquo;
                      </div>
                      <div className="mt-1 space-y-1">
                        {items.map((ri) => (
                          <div key={ri.id} className="text-[11px] text-stone-700 flex items-center gap-1.5 bg-stone-50 px-2 py-1 rounded">
                            <span>• {ri.productName} ({ri.qty_base / (ri.factor || 1)} {ri.unitCode})</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                              ri.condition === 'sellable'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {ri.condition === 'sellable'
                                ? '✓ Layak Jual (Kembali ke Stok)'
                                : ri.condition === 'expired'
                                ? '⏱ Kedaluwarsa (Pemusnahan)'
                                : '✕ Rusak/Cacat (Pemusnahan)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Event 3: Void (jika status voided) */}
                  {selectedSaleDetail.sale.status === 'voided' && (
                    <div className="relative">
                      <div className="absolute -left-6 top-0.5 size-4 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center text-[9px] text-white">
                        ✕
                      </div>
                      <div className="text-xs font-semibold text-rose-800">
                        Transaksi Dibatalkan (Void)
                      </div>
                      <div className="text-[11px] text-stone-600 mt-0.5">
                        Alasan: &ldquo;{selectedSaleDetail.sale.void_reason || 'Tidak ada catatan'}&rdquo;
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        Seluruh saldo stok barang telah dipulihkan otomatis ke inventaris via SALE_VOID movement.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-stone-200 flex flex-col gap-2">
              {reprintError && (
                <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {reprintError}
                </div>
              )}
              <button
                type="button"
                onClick={handleReprint}
                disabled={isReprinting}
                className="w-full py-3 bg-[#14463C] text-white rounded-xl text-xs font-bold hover:bg-[#0F352E] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                {isReprinting ? 'Membuka cetak...' : 'Cetak Ulang Struk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Void Transaksi (Membutuhkan Otorisasi Supervisor) */}
      {/* ======================================================== */}
      {voidTargetSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <Lock className="w-5 h-5" />
              <h3 className="font-serif font-bold text-base">Otorisasi Void Transaksi</h3>
            </div>
            <p className="text-xs text-stone-600">
              Membatalkan struk <strong>#{voidTargetSale.receipt_no}</strong> ({formatRupiah(voidTargetSale.total)}) dan mengembalikan stok barang ke inventaris.
            </p>

            {voidError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{voidError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Alasan Pembatalan (Wajib)
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Contoh: Pelanggan keliru membawa barang & membatalkan"
                className="w-full p-2.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                PIN Supervisor / Pemilik
              </label>
              <PinPad value={voidPin} onChange={setVoidPin} maxLength={6} />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setVoidTargetSale(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={isVoiding || voidPin.length < 4 || !voidReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-40"
              >
                {isVoiding ? 'Memproses...' : 'Konfirmasi Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Retur Barang Pelanggan (AC-08, BR-18, BR-19, AC-28) */}
      {/* ======================================================== */}
      {returnTargetSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-2 text-amber-800">
              <Undo2 className="w-5 h-5" />
              <h3 className="font-serif font-bold text-base">Retur Barang Pelanggan</h3>
            </div>
            <p className="text-xs text-stone-600">
              Pilih item dan kuantitas barang yang dikembalikan dari struk <strong>#{returnTargetSale.sale.receipt_no}</strong>.
            </p>

            {/* Banner Aturan Stok Retur */}
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Aturan Stok:</strong> Barang <em>Layak Jual</em> akan kembali ke stok jual toko. Barang <em>Rusak/Kedaluwarsa</em> tidak menambah stok jual (dicatat sebagai kerugian/write-off).
              </div>
            </div>

            {returnError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{returnError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-xl p-3 bg-stone-50/50 space-y-3">
              {returnTargetSale.items.map((it) => {
                const maxQty = it.maxReturnableQty;
                const currentRet = returnSelections[it.id] || 0;
                const currentCond = returnConditions[it.id] || 'sellable';

                return (
                  <div key={it.id} className="pt-2 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-stone-900">{it.name_snapshot}</div>
                        <div className="text-[11px] text-stone-500">
                          Sisa retur: <strong>{maxQty}</strong> {it.unit_code_snapshot} @ {formatRupiah(it.unit_price_snapshot)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-stone-500">Retur:</label>
                        <input
                          type="number"
                          min="0"
                          max={maxQty}
                          disabled={maxQty === 0}
                          value={currentRet}
                          onChange={(e) => {
                            const val = Math.min(maxQty, Math.max(0, parseInt(e.target.value, 10) || 0));
                            setReturnSelections((prev) => ({ ...prev, [it.id]: val }));
                          }}
                          className="w-16 px-2 py-1 bg-white border border-stone-300 rounded text-center font-bold disabled:opacity-40"
                        />
                      </div>
                    </div>

                    {/* Selector Kondisi Barang jika item diretur */}
                    {currentRet > 0 && (
                      <div className="pt-2 border-t border-stone-200/60 flex flex-wrap items-center justify-between gap-2 bg-stone-100/60 p-2 rounded-lg">
                        <span className="text-[11px] font-medium text-stone-600">Kondisi Barang:</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReturnConditions((prev) => ({ ...prev, [it.id]: 'sellable' }))}
                            className={`px-2 py-0.5 rounded-pill text-[10px] font-semibold border transition-colors ${
                              currentCond === 'sellable'
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            ✓ Layak Jual
                          </button>
                          <button
                            type="button"
                            onClick={() => setReturnConditions((prev) => ({ ...prev, [it.id]: 'damaged' }))}
                            className={`px-2 py-0.5 rounded-pill text-[10px] font-semibold border transition-colors ${
                              currentCond === 'damaged'
                                ? 'bg-rose-100 border-rose-400 text-rose-800 font-bold'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            ✕ Rusak/Cacat
                          </button>
                          <button
                            type="button"
                            onClick={() => setReturnConditions((prev) => ({ ...prev, [it.id]: 'expired' }))}
                            className={`px-2 py-0.5 rounded-pill text-[10px] font-semibold border transition-colors ${
                              currentCond === 'expired'
                                ? 'bg-amber-100 border-amber-400 text-amber-800 font-bold'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            ⏱ Kedaluwarsa
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live Refund Summary */}
            <div className="flex justify-between items-center text-xs font-bold text-stone-900 pt-1 border-t border-stone-200">
              <span>Total Pengembalian Dana:</span>
              <span className="text-sm text-amber-700 font-mono font-bold">
                {formatRupiah(computedRefundTotal)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Alasan Retur (Wajib)
              </label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Contoh: Kemasan bocor / rusak saat dibawa"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setReturnTargetSale(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReturn}
                disabled={isReturning || !returnReason.trim() || computedRefundTotal === 0}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-40"
              >
                {isReturning ? 'Memproses...' : 'Proses Retur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
