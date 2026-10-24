import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { BatchService, type ExpiringBatchItem } from '@/services/batch.service';
import { useAuthStore } from '@/features/auth/authStore';
import { formatRupiah } from '@/domain/money';

interface WriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExpiringBatchItem | null;
  batchService: BatchService;
  onSuccess: () => void;
}

export const WriteOffModal: React.FC<WriteOffModalProps> = ({
  isOpen,
  onClose,
  item,
  batchService,
  onSuccess,
}) => {
  const { currentUser } = useAuthStore();
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('Kedaluwarsa / Rusak dan tidak layak jual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setQty(item.currentStock);
      setReason(item.daysRemaining < 0 ? 'Pemusnahan barang kedaluwarsa' : 'Barang rusak / bocor kemasan');
      setErrorMessage(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) {
      setErrorMessage('Kuantitas pemusnahan harus lebih dari 0');
      return;
    }
    if (qty > item.currentStock) {
      setErrorMessage(`Kuantitas tidak boleh melebihi stok yang tersedia (${item.currentStock})`);
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Alasan pemusnahan wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await batchService.writeOffBatch({
        batchId: item.batchId,
        productId: item.productId,
        qtyBase: qty,
        userId: currentUser?.id || 'sys',
        reason: reason.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengeluarkan barang';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedValueLoss = Math.round((qty * (item.unitCostX10k / 10000)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2 text-rose-700">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-stone-900">
              Keluarkan Barang (Write-off)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Product Summary */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
            <div className="text-xs font-bold text-stone-900">{item.productName}</div>
            <div className="text-[11px] text-stone-500 flex items-center justify-between">
              <span>Batch: <strong className="font-mono text-stone-700">{item.batchCode}</strong></span>
              <span>Kedaluwarsa: <strong className="text-stone-700">{item.expiryDate}</strong></span>
            </div>
            <div className="text-[11px] text-stone-500">
              Stok Tersedia: <strong className="text-stone-700">{item.currentStock} {item.unitCode}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Kuantitas Dikeluarkan *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={item.currentStock}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:ring-2 focus:ring-rose-600"
                required
              />
              <span className="text-xs font-semibold text-stone-600">{item.unitCode}</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Estimasi nilai barang dikeluarkan: <strong className="text-rose-700">{formatRupiah(estimatedValueLoss)}</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Alasan Pemusnahan / Pengeluaran *
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Barang kedaluwarsa dibuang, kemasan bocor..."
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-rose-600"
              required
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Keluarkan Barang</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
