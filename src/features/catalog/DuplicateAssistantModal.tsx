import React, { useState, useEffect, useCallback } from 'react';
import { CatalogService } from '@/services/catalog.service';
import { type DuplicateGroup } from '@/domain/catalog/duplicate-detector';
import { formatRupiah } from '@/domain/money';
import {
  HelpCircle,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Layers,
  Barcode as BarcodeIcon,
  Boxes,
  EyeOff,
  Loader2,
} from 'lucide-react';

interface DuplicateAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogService: CatalogService;
  currentUserId: string;
  onMergeCompleted: () => void;
}

export const DuplicateAssistantModal: React.FC<DuplicateAssistantModalProps> = ({
  isOpen,
  onClose,
  catalogService,
  currentUserId,
  onMergeCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'guide'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [ignoredPairs, setIgnoredPairs] = useState<Set<string>>(new Set());
  const [selectedPrimaryByGroup, setSelectedPrimaryByGroup] = useState<Record<string, string>>({});
  const [mergingGroupId, setMergingGroupId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const runScan = useCallback(async () => {
    setIsScanning(true);
    setNotification(null);
    try {
      const groups = await catalogService.scanDuplicates(ignoredPairs);
      setDuplicateGroups(groups);

      // Inisialisasi default primary target
      const initialPrimaries: Record<string, string> = {};
      for (const g of groups) {
        initialPrimaries[g.id] = g.suggested_primary_id;
      }
      setSelectedPrimaryByGroup(initialPrimaries);
    } catch (err: unknown) {
      console.error('Error scanning duplicates:', err);
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal memindai katalog produk',
      });
    } finally {
      setIsScanning(false);
    }
  }, [catalogService, ignoredPairs]);

  useEffect(() => {
    if (isOpen) {
      runScan();
    }
  }, [isOpen, runScan]);

  // Keyboard shortcut Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !mergingGroupId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mergingGroupId, onClose]);

  if (!isOpen) return null;

  const handleSelectPrimary = (groupId: string, productId: string) => {
    setSelectedPrimaryByGroup((prev) => ({
      ...prev,
      [groupId]: productId,
    }));
  };

  const handleIgnoreGroup = (group: DuplicateGroup) => {
    if (group.products.length < 2) return;
    const pairKey = [group.products[0]!.id, group.products[1]!.id].sort().join(':');
    setIgnoredPairs((prev) => {
      const next = new Set(prev);
      next.add(pairKey);
      return next;
    });
    setDuplicateGroups((prev) => prev.filter((g) => g.id !== group.id));
  };

  const handleMerge = async (group: DuplicateGroup) => {
    if (group.products.length < 2) return;

    const primaryId = selectedPrimaryByGroup[group.id] || group.suggested_primary_id;
    const duplicateProduct = group.products.find((p) => p.id !== primaryId);
    const primaryProduct = group.products.find((p) => p.id === primaryId);

    if (!duplicateProduct || !primaryProduct) return;

    setMergingGroupId(group.id);
    setNotification(null);

    try {
      const result = await catalogService.mergeDuplicateProduct({
        primaryProductId: primaryProduct.id,
        duplicateProductId: duplicateProduct.id,
        actor: { id: currentUserId, roles: ['owner'] },
      });

      setNotification({
        type: 'success',
        message: `Berhasil memindahkan ${result.transferredStock} stok ke "${result.primaryName}" dan mengarsipkan "${result.duplicateName}".`,
      });

      // Refresh list
      await runScan();
      onMergeCompleted();
    } catch (err: unknown) {
      console.error('Merge error:', err);
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menggabungkan produk',
      });
    } finally {
      setMergingGroupId(null);
    }
  };

  const getReasonBadge = (reason: DuplicateGroup['reason']) => {
    switch (reason) {
      case 'identical_barcode':
        return {
          label: 'Barcode Fisik Sama',
          icon: BarcodeIcon,
          className: 'bg-destructive/10 text-destructive border-destructive/20',
        };
      case 'multi_unit_variant':
        return {
          label: 'Potensi Eceran vs Dus',
          icon: Layers,
          className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
        };
      default:
        return {
          label: 'Kemiripan Nama Tinggi',
          icon: AlertTriangle,
          className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !mergingGroupId) {
          onClose();
        }
      }}
    >
      <div className="relative bg-background border border-border w-full max-w-2xl rounded-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Tombol Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 size-8 rounded-full border border-input bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-ring z-10"
          title="Tutup Modal"
        >
          <X className="size-4" />
        </button>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
              <Boxes className="size-5" />
            </div>
            <div className="flex flex-col pr-8">
              <h2 id="duplicate-modal-title" className="font-serif font-bold text-lg text-foreground leading-tight">
                Asisten Deteksi & Penggabungan Barang Duplikat
              </h2>
              <span className="text-xs text-muted-foreground mt-0.5">
                Pindai otomatis barang ganda, barcode tabrakan, dan gabungkan stok secara aman.
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className={`px-3 py-1.5 rounded-pill text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                activeTab === 'scan'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-background text-muted-foreground border-input hover:text-foreground hover:bg-muted'
              }`}
            >
              <RefreshCw className={`size-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Pemindaian Duplikat</span>
              {duplicateGroups.length > 0 && (
                <span className="ml-1 size-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {duplicateGroups.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-pill text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                activeTab === 'guide'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-background text-muted-foreground border-input hover:text-foreground hover:bg-muted'
              }`}
            >
              <HelpCircle className="size-3.5" />
              <span>Panduan & Kebijakan</span>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`mx-5 sm:mx-6 mt-3 p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
              notification.type === 'success'
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-destructive/10 border-destructive/20 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {notification.type === 'success' ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 text-destructive" />
              )}
              <span className="truncate">{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {activeTab === 'scan' ? (
            <>
              {/* Header Action Bar */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {isScanning
                    ? 'Sedang memindai seluruh katalog toko...'
                    : duplicateGroups.length === 0
                    ? 'Hasil pemindaian: Katalog sehat'
                    : `Ditemukan ${duplicateGroups.length} potensi barang duplikat:`}
                </span>

                <button
                  type="button"
                  onClick={runScan}
                  disabled={isScanning || !!mergingGroupId}
                  className="h-8 px-2.5 rounded-pill border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 text-primary ${isScanning ? 'animate-spin' : ''}`} />
                  <span>Pindai Ulang</span>
                </button>
              </div>

              {/* Status 1: Loading */}
              {isScanning ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="size-8 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Menganalisis kemiripan nama, kesamaan barcode, dan multi-satuan...
                  </span>
                </div>
              ) : duplicateGroups.length === 0 ? (
                /* Status 2: Clean Catalog */
                <div className="py-10 px-4 bg-primary/5 border border-primary/15 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                  <div className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-sm">
                    <h3 className="font-serif font-bold text-base text-foreground">
                      Katalog Bersih & Teratur!
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Tidak ditemukan barcode yang bertabrakan maupun nama produk yang memiliki kemiripan mencurigakan di katalog toko Anda.
                    </p>
                  </div>
                </div>
              ) : (
                /* Status 3: Daftar Duplikat */
                <div className="space-y-4">
                  {duplicateGroups.map((group) => {
                    const primaryId = selectedPrimaryByGroup[group.id] || group.suggested_primary_id;
                    const badge = getReasonBadge(group.reason);
                    const BadgeIcon = badge.icon;
                    const isMergingThis = mergingGroupId === group.id;

                    return (
                      <div
                        key={group.id}
                        className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs"
                      >
                        {/* Header Kartu Duplikat */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.className}`}
                            >
                              <BadgeIcon className="size-3" />
                              <span>{badge.label}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {group.description}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleIgnoreGroup(group)}
                            disabled={isMergingThis}
                            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            title="Abaikan pasangan ini jika keduanya memang produk berbeda"
                          >
                            <EyeOff className="size-3" />
                            <span>Bukan Duplikat</span>
                          </button>
                        </div>

                        {/* Petunjuk Pemilihan */}
                        <p className="text-[11px] text-muted-foreground">
                          Klik untuk memilih <strong>Produk Utama</strong> yang ingin dipertahankan. Produk lainnya akan otomatis digabungkan sisa stoknya lalu diarsipkan:
                        </p>

                        {/* Grid Perbandingan Berdampingan (Side-by-Side) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {group.products.map((prod) => {
                            const isPrimary = prod.id === primaryId;

                            return (
                              <button
                                key={prod.id}
                                type="button"
                                onClick={() => handleSelectPrimary(group.id, prod.id)}
                                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all relative ${
                                  isPrimary
                                    ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary'
                                    : 'bg-muted/40 border-border hover:border-input'
                                }`}
                              >
                                {/* Role Pill: Target vs Duplikat */}
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border leading-tight ${
                                      isPrimary
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                    }`}
                                  >
                                    {isPrimary ? '✓ Produk Utama (Dipertahankan)' : '⇄ Akan Digabung & Diarsipkan'}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-semibold">
                                    {prod.category_name}
                                  </span>
                                </div>

                                {/* Informasi Produk */}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs sm:text-sm font-bold text-foreground leading-snug truncate">
                                    {prod.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground mt-0.5">
                                    Satuan: {prod.base_unit_name || 'Pcs'}
                                  </span>
                                </div>

                                {/* Metrik: Stok, Harga, Struk */}
                                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/60 text-[10px] w-full">
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground">Stok Fisik</span>
                                    <span className="font-bold text-foreground">
                                      {prod.stock} {prod.base_unit_code}
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground">Harga Jual</span>
                                    <span className="font-bold text-foreground">
                                      Rp {formatRupiah(prod.price)}
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground">Riwayat</span>
                                    <span className="font-bold text-foreground">
                                      {prod.tx_count || 0} struk
                                    </span>
                                  </div>
                                </div>

                                {/* Barcode Info */}
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate w-full pt-0.5">
                                  <BarcodeIcon className="size-3 shrink-0" />
                                  <span className="truncate">
                                    {prod.barcodes.length > 0 ? prod.barcodes.join(', ') : 'Tanpa Barcode'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Tombol Eksekusi Penggabungan */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                          <button
                            type="button"
                            onClick={() => handleMerge(group)}
                            disabled={isMergingThis}
                            className="h-9 px-4 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            {isMergingThis ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Memindahkan Stok & Mengarsipkan...</span>
                              </>
                            ) : (
                              <>
                                <ArrowRightLeft className="size-3.5" />
                                <span>Gabungkan Stok & Arsipkan</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* TAB 2: PANDUAN & KEBIJAKAN AMAN */
            <div className="space-y-4 text-xs text-foreground leading-relaxed">
              <p className="text-muted-foreground">
                SembakoOS menerapkan aturan akuntansi ketat agar data toko tidak rusak saat terjadi kesalahan penginputan barang:
              </p>

              <div className="space-y-3">
                <div className="p-3.5 bg-card border border-border rounded-xl flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-foreground">Perpindahan Stok Atomik (Ledger Resmi)</span>
                    <p className="text-muted-foreground">
                      Saat penggabungan dijalankan, sisa stok dari produk keliru dipindahkan ke produk utama melalui mutasi <code>COUNT_ADJUSTMENT</code> di ledger inventaris. Angka stok toko dijamin akurat dan tidak ada saldo yang hilang.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-card border border-border rounded-xl flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-foreground">Pengarsipan Aman (Bukan Penghapusan Permanen)</span>
                    <p className="text-muted-foreground">
                      Produk keliru diubah statusnya menjadi diarsipkan (<code>archived</code>). Produk tersebut tidak akan muncul lagi di kasir POS maupun daftar katalog aktif, namun seluruh catatan struk penjualan masa lalu tetap utuh.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-card border border-border rounded-xl flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-primary">Integritas Riwayat Penjualan Terjaga 100%</span>
                    <p className="text-muted-foreground">
                      Semua struk lama yang pernah mencatat produk tersebut tidak akan rusak, karena sistem menyimpan salinan permanen (snapshot) harga jual dan modal pokok pada saat transaksi terjadi.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-pill border border-input text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
