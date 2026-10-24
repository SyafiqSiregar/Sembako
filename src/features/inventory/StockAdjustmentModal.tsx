import React, { useState } from 'react';
import { X, Sliders, AlertCircle, Loader2 } from 'lucide-react';
import { InventoryService, type AdjustmentReasonType } from '@/services/inventory.service';
import { type ProductDetail } from '@/services/catalog.service';
import { useAuthStore } from '@/features/auth/authStore';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDetail | null;
  inventoryService: InventoryService;
  onAdjustmentComplete: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  product,
  inventoryService,
  onAdjustmentComplete,
}) => {
  const { currentUser } = useAuthStore();
  const [newQtyStr, setNewQtyStr] = useState('');
  const [reasonType, setReasonType] = useState<AdjustmentReasonType>('COUNT_CORRECTION');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const currentStock = product.totalStockBase;
  const newQty = parseInt(newQtyStr, 10);
  const isValidNumber = !isNaN(newQty) && newQty >= 0;
  const delta = isValidNumber ? newQty - currentStock : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber) {
      setErrorMessage('Kuantitas fisik baru harus berupa angka bulat ≥ 0');
      return;
    }
    if (delta === 0) {
      setErrorMessage('Kuantitas fisik baru sama dengan stok saat ini (tidak ada perubahan)');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Alasan penyesuaian stok wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await inventoryService.adjustStock({
        productId: product.product.id,
        newQtyBase: newQty,
        reasonType,
        reason: reason.trim(),
        userId: currentUser?.id || 'system',
      });

      onAdjustmentComplete();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan penyesuaian stok';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold">Penyesuaian Stok Manual</h2>
              <p className="text-xs text-white/80">{product.product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#FBF8F3]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Current vs New Quantity Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-stone-200 text-center">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Stok Sistem Saat Ini
              </span>
              <div className="text-2xl font-bold text-stone-800 mt-1">
                {currentStock} <span className="text-xs font-normal text-stone-500">{product.product.base_unit_code}</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-stone-200 text-center">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Selisih Penyesuaian
              </span>
              <div
                className={`text-2xl font-bold mt-1 ${
                  delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-600' : 'text-stone-400'
                }`}
              >
                {isValidNumber && delta !== 0 ? (delta > 0 ? `+${delta}` : delta) : '0'}{' '}
                <span className="text-xs font-normal text-stone-500">{product.product.base_unit_code}</span>
              </div>
            </div>
          </div>

          {/* Input Kuantitas Fisik Baru */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Kuantitas Fisik Baru ({product.product.base_unit_code})
            </label>
            <input
              type="number"
              min="0"
              autoFocus
              value={newQtyStr}
              onChange={(e) => {
                setNewQtyStr(e.target.value);
                setErrorMessage(null);
              }}
              placeholder={`Masukkan jumlah fisik aktual (saat ini: ${currentStock})`}
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl font-bold text-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          {/* Jenis Alasan Penyesuaian */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Jenis Penyesuaian
            </label>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value as AdjustmentReasonType)}
              className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-800 focus:ring-2 focus:ring-[#14463C] focus:outline-none"
            >
              <option value="COUNT_CORRECTION">Koreksi Selisih Hitung Fisik</option>
              <option value="DAMAGE_SPOILAGE">Barang Rusak / Pecah / Bocor</option>
              <option value="EXPIRED">Barang Kedaluwarsa Dibuang</option>
              <option value="LOST">Barang Hilang / Selisih Gudang</option>
              <option value="INTERNAL_USE">Pemakaian Operasional Toko</option>
              <option value="OTHER">Koreksi Lainnya</option>
            </select>
          </div>

          {/* Catatan / Alasan Wajib */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Alasan Penyesuaian (Wajib)
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrorMessage(null);
              }}
              rows={2}
              placeholder="Contoh: 1 karung sobek dan tumpah saat dipindahkan ke rak"
              className="w-full p-3 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-[#14463C] focus:outline-none"
            />
          </div>

          {/* Tombol Simpan */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isValidNumber || delta === 0 || !reason.trim()}
              className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-md ${
                !isSubmitting && isValidNumber && delta !== 0 && reason.trim()
                  ? 'bg-[#14463C] text-white hover:bg-[#0F352E] cursor-pointer'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan Penyesuaian...
                </>
              ) : (
                'Simpan Penyesuaian Stok'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
