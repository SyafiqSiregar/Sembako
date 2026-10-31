import React, { useState, useEffect } from 'react';
import { type Category, type ProductDetail } from '@/services/catalog.service';
import { CatalogService } from '@/services/catalog.service';
import { db } from '@/data/db';
import { parseRupiah, formatRupiah } from '@/domain/money';
import { isInternalBarcode } from '@/domain/barcode/ean13';
import { useAuthStore } from '@/features/auth/authStore';
import { X, AlertTriangle, Package, Check, Layers, Barcode as BarcodeIcon, Info, Calendar, Sparkles } from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  editingProduct?: ProductDetail | null;
  currentUserId: string;
}

const COMMON_BASE_UNITS = [
  { code: 'pcs', name: 'Pcs / Bungkus', kind: 'count' as const },
  { code: 'kg', name: 'Kilogram (Kg)', kind: 'weight' as const },
  { code: 'l', name: 'Liter (L)', kind: 'volume' as const },
  { code: 'btr', name: 'Butir', kind: 'count' as const },
  { code: 'sch', name: 'Sachet', kind: 'count' as const },
  { code: 'klg', name: 'Kaleng', kind: 'count' as const },
];

const COMMON_WHOLESALE_UNITS = ['Dus', 'Karton', 'Slop', 'Pack', 'Renceng', 'Pres'];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  categories,
  editingProduct,
  currentUserId,
}) => {
  // 1. Informasi Barang
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [trackExpiry, setTrackExpiry] = useState(false);

  // 2. Satuan Eceran (Utama)
  const [baseUnitName, setBaseUnitName] = useState('Pcs / Bungkus');
  const [baseUnitCode, setBaseUnitCode] = useState('pcs');
  const [baseUnitKind, setBaseUnitKind] = useState<'count' | 'weight' | 'volume'>('count');
  const [costText, setCostText] = useState('');
  const [priceText, setPriceText] = useState('');
  const [baseBarcode, setBaseBarcode] = useState('');

  // 3. Satuan Grosir / Dus (Opsional)
  const [hasWholesale, setHasWholesale] = useState(false);
  const [wholesaleUnitName, setWholesaleUnitName] = useState('Dus');
  const [wholesaleFactorText, setWholesaleFactorText] = useState('40');
  const [wholesalePriceText, setWholesalePriceText] = useState('');
  const [wholesaleBarcode, setWholesaleBarcode] = useState('');

  // 4. Stok Awal & Tanggal Kedaluwarsa (untuk produk baru)
  const [initialStockText, setInitialStockText] = useState('');
  const [initialExpiryDate, setInitialExpiryDate] = useState('');
  const [initialBatchCode, setInitialBatchCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogService = new CatalogService(db);

  useEffect(() => {
    if (editingProduct) {
      const p = editingProduct.product;
      setName(p.name);
      setSku(p.sku || '');
      setCategoryId(p.category_id);
      setBaseUnitKind(p.base_unit_kind);
      setTrackExpiry(p.track_expiry === 1);
      setMinStock(p.min_stock_base.toString());

      const base = editingProduct.units.find((u) => u.is_base === 1) || editingProduct.units[0];
      if (base) {
        setBaseUnitCode(base.unit_code);
        setBaseUnitName(base.name);
        setPriceText(base.price.toString());
        setCostText(Math.round(base.cost_x10k / 10000).toString());

        const baseBc = editingProduct.barcodes.find((b) => b.product_unit_id === base.id);
        setBaseBarcode(baseBc ? baseBc.barcode : '');
      }

      // Check if there is a secondary unit (wholesale/dus)
      const secondary = editingProduct.units.find((u) => u.is_base === 0 || u.conversion_factor > 1);
      if (secondary) {
        setHasWholesale(true);
        setWholesaleUnitName(secondary.name);
        setWholesaleFactorText(secondary.conversion_factor.toString());
        setWholesalePriceText(secondary.price.toString());

        const secBc = editingProduct.barcodes.find((b) => b.product_unit_id === secondary.id);
        setWholesaleBarcode(secBc ? secBc.barcode : '');
      } else {
        setHasWholesale(false);
        setWholesaleUnitName('Dus');
        setWholesaleFactorText('40');
        setWholesalePriceText('');
        setWholesaleBarcode('');
      }
    } else {
      setName('');
      setSku('');
      setCategoryId(categories[0]?.id || '');
      setMinStock('5');
      setTrackExpiry(false);

      setBaseUnitName('Pcs / Bungkus');
      setBaseUnitCode('pcs');
      setBaseUnitKind('count');
      setCostText('');
      setPriceText('');
      setBaseBarcode('');

      setHasWholesale(false);
      setWholesaleUnitName('Dus');
      setWholesaleFactorText('40');
      setWholesalePriceText('');
      setWholesaleBarcode('');

      setInitialStockText('');
      setInitialExpiryDate('');
      setInitialBatchCode('');
    }
    setError(null);
  }, [editingProduct, categories, isOpen]);

  if (!isOpen) return null;

  // Real-time calculation helpers for laypeople
  const parsedCost = parseRupiah(costText);
  const parsedPrice = parseRupiah(priceText);
  const parsedWholesaleFactor = parseInt(wholesaleFactorText, 10) || 0;
  const parsedWholesalePrice = parseRupiah(wholesalePriceText);

  const calculatedWholesaleCost = parsedCost * (parsedWholesaleFactor || 1);
  const calculatedWholesaleProfit = parsedWholesalePrice - calculatedWholesaleCost;

  const [isGeneratingInternalBc, setIsGeneratingInternalBc] = useState(false);
  const { currentUser, roleCodes } = useAuthStore();

  const handleGenerateInternalBarcode = async () => {
    if (!editingProduct || !currentUser) return;
    const base = editingProduct.units.find((u) => u.is_base === 1) || editingProduct.units[0];
    if (!base) return;

    try {
      setIsGeneratingInternalBc(true);
      setError(null);
      const res = await catalogService.assignInternalBarcode({
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          roles: roleCodes,
        },
        productId: editingProduct.product.id,
        productUnitId: base.id,
      });
      setBaseBarcode(res.barcode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat barcode internal';
      setError(msg);
    } finally {
      setIsGeneratingInternalBc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const minStockNum = parseInt(minStock, 10) || 0;

    if (!name.trim()) {
      setError('Nama barang wajib diisi');
      return;
    }
    if (!categoryId) {
      setError('Pilih kategori barang');
      return;
    }
    if (parsedPrice <= 0) {
      setError('Harga jual eceran harus lebih besar dari 0');
      return;
    }

    if (hasWholesale) {
      if (!wholesaleUnitName.trim()) {
        setError('Nama kemasan grosir wajib diisi (misal: Dus)');
        return;
      }
      if (parsedWholesaleFactor <= 1) {
        setError('Isi per kemasan grosir harus lebih dari 1 (misal: 1 Dus isi 40 bungkus)');
        return;
      }
      if (parsedWholesalePrice <= 0) {
        setError('Harga jual grosir/dus harus lebih besar dari 0');
        return;
      }
      if (baseBarcode.trim() && wholesaleBarcode.trim() && baseBarcode.trim() === wholesaleBarcode.trim()) {
        setError('Barcode eceran dan barcode dus tidak boleh sama persis');
        return;
      }
    }

    const parsedInitialStock = parseInt(initialStockText, 10) || 0;
    if (!editingProduct) {
      if (initialStockText.trim() && parsedInitialStock < 0) {
        setError('Jumlah stok awal tidak boleh bernilai negatif');
        return;
      }

      if (trackExpiry && parsedInitialStock > 0) {
        if (!initialExpiryDate) {
          setError('Tanggal kedaluwarsa wajib dipilih untuk stok awal barang ini');
          return;
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        if (initialExpiryDate < todayStr) {
          setError('Tanggal kedaluwarsa tidak boleh sudah lewat dari hari ini');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const unitsPayload: Array<{
        unitCode: string;
        name: string;
        conversionFactor: number;
        price: number;
        costX10k: number;
        isBase: boolean;
      }> = [
        {
          unitCode: baseUnitCode.trim(),
          name: baseUnitName.trim(),
          conversionFactor: 1,
          price: parsedPrice,
          costX10k: parsedCost * 10000,
          isBase: true,
        },
      ];

      const wholesaleCode = wholesaleUnitName.trim().toLowerCase().slice(0, 6) || 'pack';

      if (hasWholesale) {
        unitsPayload.push({
          unitCode: wholesaleCode,
          name: wholesaleUnitName.trim(),
          conversionFactor: parsedWholesaleFactor,
          price: parsedWholesalePrice,
          costX10k: calculatedWholesaleCost * 10000,
          isBase: false,
        });
      }

      const barcodesPayload: Array<{ barcode: string; unitCode: string }> = [];
      if (baseBarcode.trim()) {
        barcodesPayload.push({ barcode: baseBarcode.trim(), unitCode: baseUnitCode.trim() });
      }
      if (hasWholesale && wholesaleBarcode.trim()) {
        barcodesPayload.push({ barcode: wholesaleBarcode.trim(), unitCode: wholesaleCode });
      }

      if (editingProduct) {
        await catalogService.updateProduct({
          id: editingProduct.product.id,
          name: name.trim(),
          sku: sku.trim() || undefined,
          categoryId,
          minStockBase: minStockNum,
          trackExpiry,
          updatedBy: currentUserId,
          units: unitsPayload,
          barcodes: barcodesPayload,
          priceChangeReason: 'Pembaruan data dari form katalog',
        });
      } else {
        await catalogService.createProduct({
          name: name.trim(),
          sku: sku.trim() || undefined,
          categoryId,
          baseUnitKind,
          baseUnitCode: baseUnitCode.trim(),
          trackExpiry,
          minStockBase: minStockNum,
          createdBy: currentUserId,
          units: unitsPayload,
          barcodes: barcodesPayload.length > 0 ? barcodesPayload : undefined,
          initialStockBase: parsedInitialStock > 0 ? parsedInitialStock : undefined,
          initialExpiryDate: trackExpiry && parsedInitialStock > 0 ? initialExpiryDate : undefined,
          initialBatchCode: trackExpiry && parsedInitialStock > 0 && initialBatchCode.trim() ? initialBatchCode.trim() : undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan barang');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-background border border-border w-full max-w-xl rounded-card p-5 sm:p-6 shadow-2xl flex flex-col gap-4 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
              <Package className="size-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-foreground">
                {editingProduct ? 'Edit Barang' : 'Tambah Barang Baru'}
              </h2>
              <span className="text-xs text-muted-foreground">
                Lengkapi data barang, harga eceran, dan kemasan dus (opsional)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition"
            title="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-destructive-text font-medium bg-destructive/15 p-3 rounded-card border border-destructive/20 flex items-start gap-2">
            <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* ========================================================================= */}
          {/* KOTAK 1: INFORMASI BARANG */}
          {/* ========================================================================= */}
          <div className="p-4 bg-card rounded-card border border-border flex flex-col gap-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider pb-1 border-b border-border/50">
              <Info className="size-3.5 text-primary" />
              <span>1. Informasi Barang</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-foreground">
                Nama Barang <span className="text-destructive-text">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Indomie Goreng Spesial 85g"
                className="h-10 px-3 bg-background border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">
                  Kategori <span className="text-destructive-text">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-10 px-3 bg-background border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Pengingat Stok Minimum</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder="5"
                    min="0"
                    className="h-10 px-3 w-full bg-background border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                  />
                  <span className="text-muted-foreground whitespace-nowrap text-[11px]">unit dasar</span>
                </div>
              </div>
            </div>

            {/* Checkbox FEFO */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trackExpiry}
                onChange={(e) => setTrackExpiry(e.target.checked)}
                className="size-4 rounded border-input text-primary focus:ring-ring"
              />
              <span className="text-xs text-foreground font-medium">
                Lacak tanggal kedaluwarsa & batch (FEFO)
              </span>
            </label>

            {/* Sub-card Stok Awal & Tanggal Kedaluwarsa (Khusus produk baru) */}
            {!editingProduct && (
              trackExpiry ? (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-card flex flex-col gap-3 mt-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider pb-1 border-b border-amber-200/60">
                    <Calendar className="size-3.5 text-amber-700" />
                    <span>Stok Awal & Kedaluwarsa (Stok di Rak Saat Ini)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs text-stone-800">
                        Jumlah Stok di Toko
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={initialStockText}
                          onChange={(e) => setInitialStockText(e.target.value)}
                          placeholder="0"
                          min="0"
                          className="h-9 px-3 w-full bg-white border border-amber-300 rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-xs"
                        />
                        <span className="text-stone-500 whitespace-nowrap text-xs">
                          {baseUnitName.split('/')[0]?.trim() || 'Pcs'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs text-stone-800">
                        Tanggal Kedaluwarsa {parseInt(initialStockText, 10) > 0 ? '*' : '(Opsional)'}
                      </label>
                      <input
                        type="date"
                        value={initialExpiryDate}
                        onChange={(e) => setInitialExpiryDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        className="h-9 px-3 bg-white border border-amber-300 rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-medium text-[11px] text-stone-600">
                      Kode Batch (Opsional — otomatis dibuat jika kosong)
                    </label>
                    <input
                      type="text"
                      value={initialBatchCode}
                      onChange={(e) => setInitialBatchCode(e.target.value)}
                      placeholder={initialExpiryDate ? `Otomatis: BTH-${initialExpiryDate.replace(/-/g, '')}` : 'Contoh: BTH-2026A'}
                      className="h-8 px-2.5 bg-white border border-amber-200 rounded-card text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                    />
                  </div>

                  <p className="text-[11px] text-amber-800/80 leading-relaxed">
                    💡 <em>Biarkan stok 0 jika barang belum ada di toko (baru mau kulakan nanti). Tanggal bisa diisi saat penerimaan barang.</em>
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-muted/50 border border-border/80 rounded-card flex flex-col gap-2 mt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-semibold text-xs text-foreground">
                      Jumlah Stok di Toko Saat Ini (Opsional)
                    </label>
                    <div className="flex items-center gap-1.5 w-full sm:w-48">
                      <input
                        type="number"
                        value={initialStockText}
                        onChange={(e) => setInitialStockText(e.target.value)}
                        placeholder="0"
                        min="0"
                        className="h-9 px-3 w-full bg-background border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium text-xs"
                      />
                      <span className="text-muted-foreground whitespace-nowrap text-xs">
                        {baseUnitName.split('/')[0]?.trim() || 'Pcs'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Isi jika barang sudah ada di rak toko agar langsung bisa dijual di kasir.
                  </p>
                </div>
              )
            )}
          </div>

          {/* ========================================================================= */}
          {/* KOTAK 2: PENJUALAN ECERAN (Satuan Utama) */}
          {/* ========================================================================= */}
          <div className="p-4 bg-card rounded-card border border-border flex flex-col gap-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider pb-1 border-b border-border/50">
              <Package className="size-3.5 text-primary" />
              <span>2. Penjualan Eceran (Satuan Utama)</span>
            </div>

            {/* Pilihan Satuan Eceran */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">
                Pilih Satuan Eceran <span className="text-destructive-text">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_BASE_UNITS.map((u) => {
                  const isSelected = baseUnitCode === u.code;
                  return (
                    <button
                      key={u.code}
                      type="button"
                      onClick={() => {
                        setBaseUnitCode(u.code);
                        setBaseUnitName(u.name.split('/')[0]?.trim() || u.name);
                        setBaseUnitKind(u.kind);
                      }}
                      className={`px-2.5 py-1.5 rounded-pill text-xs font-semibold transition border ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-background text-muted-foreground border-input hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {u.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Harga Beli & Harga Jual Eceran */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Harga Modal / Beli (Rp)</label>
                <input
                  type="text"
                  value={costText}
                  onChange={(e) => setCostText(e.target.value)}
                  placeholder="Contoh: 3000"
                  className="h-10 px-3 bg-background border border-input rounded-card text-foreground tabular-nums text-right font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">
                  Harga Jual Eceran (Rp) <span className="text-destructive-text">*</span>
                </label>
                <input
                  type="text"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  placeholder="Contoh: 3500"
                  className="h-10 px-3 bg-background border border-input rounded-card text-foreground tabular-nums text-right font-bold text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
            </div>

            {/* Barcode Eceran */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground flex items-center justify-between">
                <span>Barcode Eceran (Bisa di-scan)</span>
                <span className="text-[11px] text-muted-foreground font-normal">Arahkan scanner ke bungkus</span>
              </label>
              <div className="relative">
                <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={baseBarcode}
                  onChange={(e) => setBaseBarcode(e.target.value)}
                  placeholder="Scan atau ketik barcode eceran..."
                  className="h-10 pl-9 pr-3 w-full bg-background border border-input rounded-card text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Bantuan Barcode Internal */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Barang repack / curah tanpa barcode?</span>
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={handleGenerateInternalBarcode}
                    disabled={isGeneratingInternalBc || Boolean(baseBarcode.trim() && isInternalBarcode(baseBarcode.trim()))}
                    className="text-primary hover:underline font-semibold flex items-center gap-1 disabled:opacity-50 disabled:no-underline cursor-pointer"
                    title={baseBarcode.trim() && isInternalBarcode(baseBarcode.trim()) ? 'Sudah memiliki barcode internal toko' : 'Buat barcode internal otomatis'}
                  >
                    <Sparkles className="size-3" />
                    <span>
                      {baseBarcode.trim() && isInternalBarcode(baseBarcode.trim())
                        ? 'Barcode Internal Aktif'
                        : isGeneratingInternalBc
                        ? 'Membuat Barcode...'
                        : 'Buat Barcode Internal (EAN-13)'}
                    </span>
                  </button>
                ) : (
                  <span className="text-muted-foreground italic">
                    Simpan barang dulu, lalu buat barcode internal
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* KOTAK 3: PENJUALAN GROSIR / DUS (Opsional) */}
          {/* ========================================================================= */}
          <div className="p-4 bg-card rounded-card border border-border flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                <Layers className="size-3.5 text-primary" />
                <span>3. Penjualan Grosir / Dus (Opsional)</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasWholesale}
                  onChange={(e) => setHasWholesale(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-ring"
                />
                <span className="text-xs font-semibold text-primary">
                  Jual per Dus / Slop juga?
                </span>
              </label>
            </div>

            {hasWholesale ? (
              <div className="flex flex-col gap-3 pt-1 animate-in fade-in duration-200">
                {/* Pilihan Cepat Nama Kemasan */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-foreground">Nama Kemasan Grosir</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_WHOLESALE_UNITS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWholesaleUnitName(w)}
                        className={`px-2.5 py-1 rounded-pill text-xs font-semibold transition border ${
                          wholesaleUnitName.toLowerCase() === w.toLowerCase()
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-background text-muted-foreground border-input hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Isi per kemasan */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">
                      1 {wholesaleUnitName} Berisi Berapa {baseUnitName}?
                    </label>
                    <input
                      type="number"
                      value={wholesaleFactorText}
                      onChange={(e) => setWholesaleFactorText(e.target.value)}
                      placeholder="Contoh: 40"
                      min="2"
                      className="h-10 px-3 bg-background border border-input rounded-card text-foreground tabular-nums font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                      required={hasWholesale}
                    />
                  </div>

                  {/* Harga Jual Grosir */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-foreground">
                      Harga Jual per {wholesaleUnitName} (Rp)
                    </label>
                    <input
                      type="text"
                      value={wholesalePriceText}
                      onChange={(e) => setWholesalePriceText(e.target.value)}
                      placeholder="Contoh: 130000"
                      className="h-10 px-3 bg-background border border-input rounded-card text-foreground tabular-nums text-right font-bold text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      required={hasWholesale}
                    />
                  </div>
                </div>

                {/* Barcode Dus */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground flex items-center justify-between">
                    <span>Barcode Kemasan {wholesaleUnitName} (Bisa di-scan dari kardus)</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Arahkan scanner ke kardus</span>
                  </label>
                  <div className="relative">
                    <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={wholesaleBarcode}
                      onChange={(e) => setWholesaleBarcode(e.target.value)}
                      placeholder={`Scan atau ketik barcode kemasan ${wholesaleUnitName}...`}
                      className="h-10 pl-9 pr-3 w-full bg-background border border-input rounded-card text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Petunjuk Kalkulasi Otomatis */}
                {parsedCost > 0 && parsedWholesaleFactor > 1 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-card p-3 text-[11px] text-foreground flex flex-col gap-1">
                    <div className="font-semibold text-primary flex items-center gap-1.5">
                      <Check className="size-3.5" />
                      <span>Estimasi Modal & Keuntungan Otomatis:</span>
                    </div>
                    <div>
                      Modal 1 {wholesaleUnitName} ({parsedWholesaleFactor} &times; {formatRupiah(parsedCost)}) ={' '}
                      <span className="font-bold">{formatRupiah(calculatedWholesaleCost)}</span>.
                    </div>
                    {parsedWholesalePrice > 0 && (
                      <div>
                        Jika dijual {formatRupiah(parsedWholesalePrice)}, estimasi keuntungan:{' '}
                        <span
                          className={`font-bold ${
                            calculatedWholesaleProfit >= 0 ? 'text-success-text' : 'text-destructive-text'
                          }`}
                        >
                          {formatRupiah(calculatedWholesaleProfit)} per {wholesaleUnitName}
                        </span>
                        .
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Barang hanya dijual eceran per {baseUnitName}. Centang pilihan di atas jika ingin menjual sekaligus per Dus/Karton/Slop.
              </p>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-pill border border-input font-semibold text-foreground hover:bg-muted transition text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-pill bg-primary text-primary-foreground font-semibold hover:bg-primary-hover shadow-sm disabled:opacity-50 transition text-xs flex items-center gap-1.5"
            >
              {isSubmitting ? 'Menyimpan...' : editingProduct ? 'Simpan Perubahan' : 'Tambah Barang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
