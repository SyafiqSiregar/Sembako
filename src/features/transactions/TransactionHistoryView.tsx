import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { db, type Sale, type SaleItem, type Payment } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { CheckoutService } from '@/services/checkout.service';
import { formatRupiah } from '@/domain/money';
import { useAuthStore } from '@/features/auth/authStore';
import { PinPad } from '@/components/shared/PinPad';

interface TransactionRow {
  sale: Sale;
  payment?: Payment;
  itemCount: number;
  cashierName: string;
}

export const TransactionHistoryView: React.FC = () => {
  const { currentUser } = useAuthStore();
  const inventoryService = useMemo(() => new InventoryService(db), []);
  const checkoutService = useMemo(() => new CheckoutService(db, inventoryService), [inventoryService]);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'all'>('today');

  // Modals
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{
    sale: Sale;
    items: SaleItem[];
    payment?: Payment;
    cashierName: string;
  } | null>(null);

  // Void modal state
  const [voidTargetSale, setVoidTargetSale] = useState<Sale | null>(null);
  const [voidPin, setVoidPin] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  // Return modal state
  const [returnTargetSale, setReturnTargetSale] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [returnSelections, setReturnSelections] = useState<Record<string, number>>({});
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
  }, []);

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
  const handleOpenDetail = async (sale: Sale, cashierName: string) => {
    const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();
    const payment = await db.payments.where('sale_id').equals(sale.id).first();
    setSelectedSaleDetail({ sale, items, payment, cashierName });
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
    setReturnTargetSale({ sale, items });
    setReturnSelections({});
    setReturnReason('');
    setReturnError(null);
  };

  // Confirm return execution (AC-08)
  const handleConfirmReturn = async () => {
    if (!returnTargetSale || !currentUser) return;
    if (!returnReason.trim()) {
      setReturnError('Alasan retur wajib diisi');
      return;
    }

    const returnItemsInput: { saleItemId: string; qtyBase: number; refundAmount: number }[] = [];
    for (const [saleItemId, returnQty] of Object.entries(returnSelections)) {
      if (returnQty > 0) {
        const item = returnTargetSale.items.find((it) => it.id === saleItemId);
        if (item) {
          const unitPrice = item.unit_price_snapshot;
          const refund = Math.floor((returnQty * unitPrice) / item.factor_snapshot);
          returnItemsInput.push({
            saleItemId,
            qtyBase: returnQty * item.factor_snapshot,
            refundAmount: refund,
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
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card">
          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs min-w-[220px]">
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
            <table className="w-full text-left text-xs">
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
                          {t.payment?.method === 'cash' ? 'Tunai' : 'Non-Tunai'}
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
                          <>
                            <button
                              onClick={() => {
                                setVoidTargetSale(t.sale);
                                setVoidPin('');
                                setVoidReason('');
                                setVoidError(null);
                              }}
                              className="px-2.5 py-1 rounded-pill border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive-text text-xs font-semibold transition-colors"
                              title="Batalkan Transaksi (Void)"
                            >
                              Void
                            </button>
                            <button
                              onClick={() => handleOpenReturnModal(t.sale)}
                              className="px-2.5 py-1 rounded-pill border border-warning/40 bg-warning/20 hover:bg-warning/30 text-warning-text text-xs font-semibold transition-colors"
                              title="Retur Barang"
                            >
                              Retur
                            </button>
                          </>
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
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
                    <span>Bayar ({selectedSaleDetail.payment?.method === 'cash' ? 'Tunai' : 'Non-Tunai'})</span>
                    <span>{formatRupiah(selectedSaleDetail.payment?.amount || selectedSaleDetail.sale.total)}</span>
                  </div>
                </div>
              </div>

              {selectedSaleDetail.sale.status === 'voided' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <span className="font-bold">Transaksi ini telah dibatalkan (Void).</span>
                  <p className="mt-0.5 text-stone-600">Alasan: {selectedSaleDetail.sale.void_reason || 'Tidak ada catatan'}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-stone-200 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-[#14463C] text-white rounded-xl text-xs font-bold hover:bg-[#0F352E] flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Cetak Ulang Struk
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
      {/* MODAL: Retur Barang Pelanggan (AC-08)                    */}
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

            {returnError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{returnError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-xl p-3 bg-stone-50/50 space-y-2">
              {returnTargetSale.items.map((it) => {
                const maxQty = it.qty_base / it.factor_snapshot;
                const currentRet = returnSelections[it.id] || 0;

                return (
                  <div key={it.id} className="pt-2 flex items-center justify-between text-xs">
                    <div className="flex-1">
                      <div className="font-semibold text-stone-900">{it.name_snapshot}</div>
                      <div className="text-[11px] text-stone-500">
                        Maks: {maxQty} {it.unit_code_snapshot} @ {formatRupiah(it.unit_price_snapshot)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-stone-500">Retur:</label>
                      <input
                        type="number"
                        min="0"
                        max={maxQty}
                        value={currentRet}
                        onChange={(e) => {
                          const val = Math.min(maxQty, Math.max(0, parseInt(e.target.value, 10) || 0));
                          setReturnSelections((prev) => ({ ...prev, [it.id]: val }));
                        }}
                        className="w-16 px-2 py-1 bg-white border border-stone-300 rounded text-center font-bold"
                      />
                    </div>
                  </div>
                );
              })}
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
                disabled={isReturning || !returnReason.trim()}
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
