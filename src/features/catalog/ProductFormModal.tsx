import React, { useState, useEffect } from 'react';
import { type Category, type ProductDetail } from '@/services/catalog.service';
import { CatalogService } from '@/services/catalog.service';
import { db } from '@/data/db';
import { parseRupiah } from '@/domain/money';
import { X, AlertTriangle, Package } from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  editingProduct?: ProductDetail | null;
  currentUserId: string;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  categories,
  editingProduct,
  currentUserId,
}) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnitKind, setBaseUnitKind] = useState<'count' | 'weight' | 'volume'>('count');
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [minStock, setMinStock] = useState('5');

  // Satuan & Harga
  const [unitCode, setUnitCode] = useState('pcs');
  const [unitName, setUnitName] = useState('Pcs');
  const [priceText, setPriceText] = useState('0');
  const [costText, setCostText] = useState('0');

  // Barcode
  const [barcode, setBarcode] = useState('');

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

      const baseUnit = editingProduct.units[0];
      if (baseUnit) {
        setUnitCode(baseUnit.unit_code);
        setUnitName(baseUnit.name);
        setPriceText(baseUnit.price.toString());
        setCostText(Math.round(baseUnit.cost_x10k / 10000).toString());
      }

      const bc = editingProduct.barcodes[0];
      setBarcode(bc ? bc.barcode : '');
    } else {
      setName('');
      setSku('');
      setCategoryId(categories[0]?.id || '');
      setBaseUnitKind('count');
      setTrackExpiry(false);
      setMinStock('5');
      setUnitCode('pcs');
      setUnitName('Pcs');
      setPriceText('0');
      setCostText('0');
      setBarcode('');
    }
    setError(null);
  }, [editingProduct, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = parseRupiah(priceText);
    const cost = parseRupiah(costText);
    const minStockNum = parseInt(minStock, 10) || 0;

    if (!name.trim()) {
      setError('Nama produk wajib diisi');
      return;
    }
    if (!categoryId) {
      setError('Pilih kategori produk');
      return;
    }
    if (price < 0) {
      setError('Harga jual tidak boleh negatif');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await catalogService.updateProduct({
          id: editingProduct.product.id,
          name: name.trim(),
          sku: sku.trim() || undefined,
          categoryId,
          minStockBase: minStockNum,
          trackExpiry,
          updatedBy: currentUserId,
          units: [
            {
              unitCode: unitCode.trim(),
              name: unitName.trim(),
              conversionFactor: 1,
              price,
              costX10k: cost * 10000,
            },
          ],
          priceChangeReason: 'Pembaruan dari form katalog',
        });
      } else {
        await catalogService.createProduct({
          name: name.trim(),
          sku: sku.trim() || undefined,
          categoryId,
          baseUnitKind,
          baseUnitCode: unitCode.trim(),
          trackExpiry,
          minStockBase: minStockNum,
          createdBy: currentUserId,
          units: [
            {
              unitCode: unitCode.trim(),
              name: unitName.trim(),
              conversionFactor: 1,
              price,
              costX10k: cost * 10000,
              isBase: true,
            },
          ],
          barcodes: barcode.trim()
            ? [
                {
                  barcode: barcode.trim(),
                  unitCode: unitCode.trim(),
                },
              ]
            : undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-background border border-border w-full max-w-lg rounded-card p-6 shadow-2xl flex flex-col gap-5 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <Package className="size-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-foreground">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <span className="text-xs text-muted-foreground">
                Informasi dasar, harga jual, dan barcode produk
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
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
          {/* Nama Produk */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-foreground">
              Nama Produk <span className="text-destructive-text">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Beras Rojo Lele 5 kg"
              className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
              autoFocus
            />
          </div>

          {/* Baris 2: SKU & Kategori */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">Kode SKU (Opsional)</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="BRS-001"
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">
                Kategori <span className="text-destructive-text">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Baris 3: Satuan Jual & Jenis */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">Satuan Jual Dasar</label>
              <input
                type="text"
                value={unitName}
                onChange={(e) => {
                  setUnitName(e.target.value);
                  setUnitCode(e.target.value.toLowerCase().slice(0, 5));
                }}
                placeholder="Pcs / Sak / Pouch / Kg"
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">Jenis Satuan</label>
              <select
                value={baseUnitKind}
                onChange={(e) => setBaseUnitKind(e.target.value as any)}
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="count">Hitungan (pcs, bungkus, sak)</option>
                <option value="weight">Berat (timbangan gram/kg)</option>
                <option value="volume">Volume (mililiter/liter)</option>
              </select>
            </div>
          </div>

          {/* Baris 4: Harga Jual & Harga Modal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">
                Harga Jual (Rp) <span className="text-destructive-text">*</span>
              </label>
              <input
                type="text"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="0"
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground font-semibold tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">Harga Modal (Rp)</label>
              <input
                type="text"
                value={costText}
                onChange={(e) => setCostText(e.target.value)}
                placeholder="0"
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Baris 5: Barcode & Min Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">Barcode Produk</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="899..."
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground">Stok Minimum Peringatan</label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="5"
                min="0"
                className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Toggle: Lacak Kedaluwarsa */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="trackExpiry"
              type="checkbox"
              checked={trackExpiry}
              onChange={(e) => setTrackExpiry(e.target.checked)}
              className="size-4 rounded border-input text-primary focus:ring-ring"
            />
            <label htmlFor="trackExpiry" className="text-xs font-medium text-foreground cursor-pointer">
              Lacak tanggal kedaluwarsa & batch untuk produk ini (FEFO)
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-pill border border-input font-semibold text-foreground hover:bg-muted"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-pill bg-primary text-primary-foreground font-semibold hover:bg-primary-hover shadow-sm disabled:opacity-50"
            >
              {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
