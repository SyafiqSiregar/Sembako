import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  Search,
  Plus,
  Minus,
  Trash2,
  Tag,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { type ProductDetail } from '@/services/catalog.service';
import {
  buildLabelSheetHtml,
  type LabelPaperPreset,
  type LabelPrintItem,
} from '@/services/label.service';
import { renderEan13Svg, isInternalBarcode, isValidEan13 } from '@/domain/barcode/ean13';
import { formatRupiah } from '@/domain/money';
import { printHtmlDocument } from '@/lib/print';
import { useAuthStore } from '@/features/auth/authStore';
import { CatalogService } from '@/services/catalog.service';
import { db } from '@/data/db';

export interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductDetail[];
  initialProduct?: ProductDetail | null;
  storeName?: string;
  onBarcodeCreated?: () => void;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProduct,
  storeName = 'TOKO SEMBAKO BERKAH',
  onBarcodeCreated,
}) => {
  const { currentUser, roleCodes } = useAuthStore();
  const [selectedItems, setSelectedItems] = useState<LabelPrintItem[]>([]);
  const [preset, setPreset] = useState<LabelPaperPreset>('thermal-50x30');
  const [showPrice, setShowPrice] = useState(false);
  const [showStoreName, setShowStoreName] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Inisialisasi barang saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    setFeedback(null);
    setSearchQuery('');

    if (initialProduct) {
      const baseUnit = initialProduct.units[0];
      const bc = initialProduct.barcodes[0]?.barcode || '';
      setSelectedItems([
        {
          productName: initialProduct.product.name,
          unitName: baseUnit?.name || baseUnit?.unit_code || 'Pcs',
          barcode: bc,
          price: baseUnit?.price || 0,
          copies: 20,
        },
      ]);
    } else {
      setSelectedItems([]);
    }
  }, [isOpen, initialProduct]);

  // Filter pencarian barang untuk ditambahkan ke daftar cetak
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter((p) => p.product.active === 1)
      .filter(
        (p) =>
          p.product.name.toLowerCase().includes(q) ||
          p.product.sku?.toLowerCase().includes(q) ||
          p.barcodes.some((b) => b.barcode.includes(q))
      )
      .slice(0, 6);
  }, [searchQuery, products]);

  if (!isOpen) return null;

  // Handler menambah produk ke daftar cetak
  const handleAddItem = (prod: ProductDetail) => {
    const baseUnit = prod.units[0];
    const bc = prod.barcodes[0]?.barcode || '';

    // Periksa apakah sudah ada di daftar
    const existingIdx = selectedItems.findIndex((it) => it.productName === prod.product.name);
    if (existingIdx !== -1) {
      const updated = [...selectedItems];
      updated[existingIdx]!.copies += 10;
      setSelectedItems(updated);
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          productName: prod.product.name,
          unitName: baseUnit?.name || baseUnit?.unit_code || 'Pcs',
          barcode: bc,
          price: baseUnit?.price || 0,
          copies: 20,
        },
      ]);
    }
    setSearchQuery('');
  };

  // Handler update kuantitas copies
  const handleUpdateCopies = (index: number, delta: number) => {
    const updated = [...selectedItems];
    const item = updated[index]!;
    const newCount = Math.min(Math.max(1, item.copies + delta), 500);
    item.copies = newCount;
    setSelectedItems(updated);
  };

  // Handler hapus item
  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, idx) => idx !== index));
  };

  // Handler buat barcode internal langsung di dalam modal bila barang belum punya barcode
  const handleGenerateInternalBarcode = async (index: number) => {
    const item = selectedItems[index];
    if (!item || !currentUser) return;

    const matchedProd = products.find((p) => p.product.name === item.productName);
    const matchedUnit = matchedProd?.units[0];
    if (!matchedProd || !matchedUnit) return;

    try {
      setIsGeneratingBarcode(true);
      const catalogService = new CatalogService(db);
      const res = await catalogService.assignInternalBarcode({
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          roles: roleCodes,
        },
        productId: matchedProd.product.id,
        productUnitId: matchedUnit.id,
      });

      // Update state lokal
      const updated = [...selectedItems];
      updated[index]!.barcode = res.barcode;
      setSelectedItems(updated);

      setFeedback({
        type: 'success',
        message: `Barcode internal ${res.barcode} berhasil dibuat untuk ${item.productName}!`,
      });

      if (onBarcodeCreated) {
        onBarcodeCreated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat barcode internal';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsGeneratingBarcode(false);
    }
  };

  // Total dan status
  const totalStickers = selectedItems.reduce((sum, it) => sum + (it.barcode && isValidEan13(it.barcode) ? it.copies : 0), 0);
  const itemsWithoutBarcode = selectedItems.filter((it) => !it.barcode || !isValidEan13(it.barcode));

  // Pratinjau stiker pertama yang valid
  const firstValidItem = selectedItems.find((it) => it.barcode && isValidEan13(it.barcode));
  const previewSvg = firstValidItem
    ? renderEan13Svg(firstValidItem.barcode, {
        moduleMm: preset === 'thermal-40x30' ? 0.25 : 0.33,
        barHeightMm: preset === 'thermal-40x30' ? 10 : 11,
        showText: true,
        quietZoneModules: 6,
      })
    : null;

  // Eksekusi cetak
  const handlePrint = () => {
    if (totalStickers === 0) return;

    const { html, skippedCount } = buildLabelSheetHtml({
      preset,
      showPrice,
      showStoreName,
      storeName,
      items: selectedItems,
    });

    if (!html) return;

    printHtmlDocument(html);
    setFeedback({
      type: 'success',
      message: `Jendela cetak dibuka untuk ${totalStickers} stiker.${
        skippedCount > 0 ? ` (${skippedCount} stiker dilewati karena barcode kosong)` : ''
      }`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-print-title"
    >
      <div className="bg-background border border-border w-full max-w-4xl rounded-card p-4 sm:p-6 shadow-2xl flex flex-col gap-4 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
              <Printer className="size-5" />
            </div>
            <div>
              <h2 id="label-print-title" className="font-serif font-bold text-lg text-foreground">
                Cetak Label Barcode
              </h2>
              <span className="text-xs text-muted-foreground">
                Cetak stiker barcode rak atau kemasan produk (EAN-13 standar toko &amp; pabrikan)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition"
            title="Tutup dialog"
            aria-label="Tutup dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-card text-xs flex items-center justify-between gap-2 border ${
              feedback.type === 'success'
                ? 'bg-success/15 border-success/30 text-success-foreground font-medium'
                : 'bg-destructive/15 border-destructive/30 text-destructive-foreground font-medium'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="size-4 shrink-0 text-success-foreground" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 text-destructive-foreground" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body: 2 Kolom di Tablet/Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Kolom Kiri: Konfigurasi Barang & Ukuran (7 Kolom) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Langkah 1: Tambah Barang */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                1. PILIH BARANG
              </span>

              {/* Input Pencarian */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama produk untuk menambah..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-background border border-input rounded-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />

                {/* Dropdown Hasil Pencarian */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-card shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-border/60">
                    {searchResults.map((p) => {
                      const bc = p.barcodes[0]?.barcode;
                      return (
                        <button
                          key={p.product.id}
                          type="button"
                          onClick={() => handleAddItem(p)}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <div className="font-semibold text-foreground">{p.product.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {bc ? `Barcode: ${bc}` : 'Belum ada barcode'}
                            </div>
                          </div>
                          <Plus className="size-3.5 text-primary" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Daftar Barang Terpilih */}
              {selectedItems.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border rounded-card bg-muted/20 flex flex-col items-center gap-1.5 text-muted-foreground">
                  <Tag className="size-6 stroke-[1.5] text-muted-foreground/60 mb-1" />
                  <p className="text-xs font-semibold text-foreground">Belum ada barang dipilih</p>
                  <p className="text-[11px]">Cari nama barang di atas untuk menambahkan ke lembar stiker.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {selectedItems.map((it, idx) => {
                    const hasValidBc = it.barcode && isValidEan13(it.barcode);
                    const isInt = hasValidBc && isInternalBarcode(it.barcode);

                    return (
                      <div
                        key={`${it.productName}-${idx}`}
                        className="p-3 bg-card border border-border rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-foreground truncate">
                            {it.productName}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">{it.unitName}</span>
                            <span>•</span>
                            {hasValidBc ? (
                              <span className="font-mono text-foreground font-medium flex items-center gap-1">
                                {it.barcode}
                                {isInt && (
                                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold uppercase">
                                    Internal
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-warning-text font-semibold flex items-center gap-1">
                                <AlertTriangle className="size-3" />
                                Belum ada barcode
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stepper Jumlah atau Tombol Buat Barcode */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {!hasValidBc ? (
                            <button
                              type="button"
                              onClick={() => handleGenerateInternalBarcode(idx)}
                              disabled={isGeneratingBarcode}
                              className="h-8 px-2.5 rounded-pill bg-primary/15 text-primary text-[11px] font-semibold hover:bg-primary/25 transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                              title="Buat barcode internal otomatis untuk barang ini"
                            >
                              <Sparkles className="size-3" />
                              <span>{isGeneratingBarcode ? 'Membuat...' : 'Buat Barcode'}</span>
                            </button>
                          ) : (
                            <div className="flex items-center border border-input rounded-pill bg-background overflow-hidden shadow-xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateCopies(idx, -5)}
                                className="size-7 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
                                title="Kurang 5"
                              >
                                <Minus className="size-3" />
                              </button>
                              <span className="px-2 text-xs font-bold font-mono text-foreground tabular-nums min-w-[28px] text-center">
                                {it.copies}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCopies(idx, 5)}
                                className="size-7 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
                                title="Tambah 5"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive-text hover:bg-destructive/15 transition"
                            title="Hapus dari daftar cetak"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Langkah 2: Pilihan Kertas & Opsi */}
            <div className="p-3 bg-muted/40 border border-border rounded-card flex flex-col gap-3">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                2. UKURAN KERTAS &amp; INFORMASI LABEL
              </span>

              {/* Radio Preset Kertas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPreset('thermal-50x30')}
                  className={`p-2.5 rounded-card border text-left flex flex-col gap-1 transition ${
                    preset === 'thermal-50x30'
                      ? 'bg-background border-primary shadow-xs ring-1 ring-primary'
                      : 'bg-card border-border hover:bg-muted/70 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Thermal 50×30</span>
                    <span className="text-[9px] bg-success/20 text-success-foreground px-1.5 py-0.2 rounded font-semibold">
                      Disarankan
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Stiker barcode rak toko standar
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('thermal-40x30')}
                  className={`p-2.5 rounded-card border text-left flex flex-col gap-1 transition ${
                    preset === 'thermal-40x30'
                      ? 'bg-background border-primary shadow-xs ring-1 ring-primary'
                      : 'bg-card border-border hover:bg-muted/70 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Thermal 40×30</span>
                    <span className="text-[9px] bg-warning/20 text-warning-foreground px-1.5 py-0.2 rounded font-semibold">
                      Kompak
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Stiker kemasan kecil / bumbu
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('a4-3x8')}
                  className={`p-2.5 rounded-card border text-left flex flex-col gap-1 transition ${
                    preset === 'a4-3x8'
                      ? 'bg-background border-primary shadow-xs ring-1 ring-primary'
                      : 'bg-card border-border hover:bg-muted/70 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Lembar A4 (3×8)</span>
                    <span className="text-[9px] bg-muted text-foreground px-1.5 py-0.2 rounded font-semibold">
                      Laser/Inkjet
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    24 stiker per lembar A4
                  </span>
                </button>
              </div>

              {/* Opsi Tambahan Checkbox */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="size-4 rounded text-primary focus:ring-ring border-input cursor-pointer"
                  />
                  <span>Tampilkan nama toko di atas label</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="size-4 rounded text-primary focus:ring-ring border-input cursor-pointer"
                  />
                  <span>Tampilkan harga jual</span>
                </label>
              </div>

              {showPrice && (
                <div className="text-[11px] text-warning-foreground bg-warning/15 p-2 rounded flex items-center gap-1.5">
                  <Info className="size-3.5 shrink-0" />
                  <span>
                    Catatan: Harga di stiker tidak otomatis berubah bila di kemudian hari harga barang diubah di sistem.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Stiker & Panduan Cetak (5 Kolom) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 bg-muted/30 p-4 rounded-card border border-border">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  3. PRATINJAU STIKER
                </span>
                <span className="text-xs font-bold text-foreground font-mono">
                  {preset === 'a4-3x8' ? '70 × 37 mm' : preset === 'thermal-40x30' ? '40 × 30 mm' : '50 × 30 mm'}
                </span>
              </div>

              {/* Box Pratinjau Visual */}
              {previewSvg ? (
                <div className="flex flex-col items-center justify-center p-4 bg-background border-2 border-dashed border-border rounded-card shadow-inner min-h-[160px]">
                  <div
                    className="bg-white text-black p-3 rounded shadow-md border border-stone-300 flex flex-col items-center justify-between text-center select-none"
                    style={{
                      width: preset === 'thermal-40x30' ? '180px' : '220px',
                      minHeight: '120px',
                    }}
                  >
                    {showStoreName && (
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-stone-800 truncate w-full">
                        {storeName}
                      </div>
                    )}
                    <div className="text-[11px] font-bold text-stone-900 leading-snug line-clamp-2 mt-0.5">
                      {firstValidItem?.productName}{' '}
                      <span className="font-normal text-[9px] text-stone-600">({firstValidItem?.unitName})</span>
                    </div>

                    <div
                      className="my-1.5 flex justify-center w-full"
                      dangerouslySetInnerHTML={{ __html: previewSvg }}
                    />

                    {showPrice && (
                      <div className="text-xs font-black text-stone-950 font-mono mt-0.5">
                        {formatRupiah(firstValidItem?.price || 0)}{' '}
                        <span className="text-[9px] font-normal text-stone-600">/{firstValidItem?.unitName}</span>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-muted-foreground mt-2 italic">
                    Contoh pratinjau barang pertama
                  </span>
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-border rounded-card bg-background/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground min-h-[160px]">
                  <Printer className="size-8 stroke-[1.5] text-muted-foreground/40 mb-1" />
                  <span className="text-xs font-semibold text-foreground">Belum ada pratinjau</span>
                  <span className="text-[11px]">Pilih barang dengan barcode di sisi kiri.</span>
                </div>
              )}

              {/* Status Parsial & Peringatan Skala */}
              {itemsWithoutBarcode.length > 0 && (
                <div className="p-2.5 rounded bg-warning/15 border border-warning/30 text-[11px] text-warning-foreground flex items-start gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>
                    Ada {itemsWithoutBarcode.length} barang tanpa barcode valid. Klik tombol &ldquo;Buat Barcode&rdquo; agar bisa dicetak.
                  </span>
                </div>
              )}

              <div className="p-2.5 rounded bg-card border border-border text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Info className="size-3.5 shrink-0 text-primary mt-0.5" />
                <span>
                  <strong>Tips Printer:</strong> Pada jendela dialog cetak sistem, pastikan opsi <em>Skala</em> diatur ke <strong>100%</strong> atau <strong>Ukuran Sebenarnya</strong> agar batang barcode tidak bergeser.
                </span>
              </div>
            </div>

            {/* Total Stiker */}
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Stiker Siap:</span>
              <span className="font-extrabold text-foreground font-mono text-sm tabular-nums">
                {totalStickers} lembar stiker
              </span>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-pill border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground transition"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={totalStickers === 0}
            className="h-10 px-5 rounded-pill bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="size-4" />
            <span>Cetak {totalStickers} Label</span>
          </button>
        </div>
      </div>
    </div>
  );
};
