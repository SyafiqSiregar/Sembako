import React, { useState, useEffect } from 'react';
import { X, Truck, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { GoodsReceiptService, type CreateGoodsReceiptItemInput } from '@/services/goods-receipt.service';
import { type Supplier } from '@/data/db';
import { type ProductDetail } from '@/services/catalog.service';
import { formatRupiah } from '@/domain/money';
import { useAuthStore } from '@/features/auth/authStore';

interface ReceiptLineDraft {
  productId: string;
  productUnitId: string;
  qtyInput: number;
  conversionFactor: number;
  costPerUnit: number;
  batchCode?: string;
  expiryDate?: string;
}

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: ProductDetail[];
  receiptService: GoodsReceiptService;
  onSuccess: () => void;
}

export const GoodsReceiptModal: React.FC<GoodsReceiptModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  products,
  receiptService,
  onSuccess,
}) => {
  const { currentUser } = useAuthStore();
  const [supplierId, setSupplierId] = useState('');
  const [supplierRefNo, setSupplierRefNo] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<ReceiptLineDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSupplierId(suppliers[0]?.id || '');
      setSupplierRefNo('');
      setReceivedDate(new Date().toISOString().split('T')[0]!);
      setNote('');
      setErrorMessage(null);

      // Baris awal jika ada produk
      if (products.length > 0 && products[0]) {
        const p = products[0];
        const u = p.units[0];
        setLines([
          {
            productId: p.product.id,
            productUnitId: u?.id || '',
            qtyInput: 10,
            conversionFactor: u?.conversion_factor || 1,
            costPerUnit: u ? Math.floor(u.cost_x10k / 10000) : 10000,
          },
        ]);
      } else {
        setLines([]);
      }
    }
  }, [isOpen, suppliers, products]);

  if (!isOpen) return null;

  const handleAddLine = () => {
    if (products.length === 0) return;
    const p = products[0]!;
    const u = p.units[0];
    setLines([
      ...lines,
      {
        productId: p.product.id,
        productUnitId: u?.id || '',
        qtyInput: 10,
        conversionFactor: u?.conversion_factor || 1,
        costPerUnit: u ? Math.floor(u.cost_x10k / 10000) : 10000,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleProductChange = (idx: number, newProdId: string) => {
    const prod = products.find((p) => p.product.id === newProdId);
    if (!prod) return;
    const u = prod.units[0];

    const updated = [...lines];
    updated[idx] = {
      ...updated[idx]!,
      productId: prod.product.id,
      productUnitId: u?.id || '',
      conversionFactor: u?.conversion_factor || 1,
      costPerUnit: u ? Math.floor(u.cost_x10k / 10000) : 10000,
    };
    setLines(updated);
  };

  const handleUnitChange = (idx: number, newUnitId: string) => {
    const line = lines[idx]!;
    const prod = products.find((p) => p.product.id === line.productId);
    const unit = prod?.units.find((u) => u.id === newUnitId);
    if (!unit) return;

    const updated = [...lines];
    updated[idx] = {
      ...line,
      productUnitId: unit.id,
      conversionFactor: unit.conversion_factor,
      costPerUnit: Math.floor(unit.cost_x10k / 10000),
    };
    setLines(updated);
  };

  const totalCost = lines.reduce((sum, l) => sum + (l.qtyInput || 0) * (l.costPerUnit || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setErrorMessage('Pilih pemasok terlebih dahulu');
      return;
    }
    if (lines.length === 0) {
      setErrorMessage('Minimal tambahkan satu item barang');
      return;
    }
    for (const l of lines) {
      if (!l.qtyInput || l.qtyInput <= 0) {
        setErrorMessage('Kuantitas setiap barang harus lebih dari 0');
        return;
      }
      if (l.costPerUnit < 0) {
        setErrorMessage('Biaya beli per unit tidak boleh negatif');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const itemsInput: CreateGoodsReceiptItemInput[] = lines.map((l) => ({
        productId: l.productId,
        productUnitId: l.productUnitId,
        qtyBase: l.qtyInput * l.conversionFactor,
        unitCostX10k: Math.floor((l.costPerUnit / l.conversionFactor) * 10000),
        batchCode: l.batchCode,
        expiryDate: l.expiryDate,
      }));

      await receiptService.createAndPostReceipt({
        supplierId,
        supplierRefNo: supplierRefNo.trim() || undefined,
        receivedDate,
        note: note.trim() || undefined,
        receivedBy: currentUser?.id || 'system',
        items: itemsInput,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memposting penerimaan barang';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Truck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold">Penerimaan Barang Baru (Goods Receipt)</h2>
              <p className="text-xs text-white/80">
                Mencatat faktur masuk dari distributor dan menambah saldo stok toko secara atomik
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 bg-[#FBF8F3]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Top Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Pemasok / Distributor *
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-800 focus:ring-2 focus:ring-[#14463C]"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                No. Faktur / Surat Jalan
              </label>
              <input
                type="text"
                value={supplierRefNo}
                onChange={(e) => setSupplierRefNo(e.target.value)}
                placeholder="Contoh: INV-BOG-2026-001"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-[#14463C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Tanggal Terima *
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-[#14463C]"
              />
            </div>
          </div>

          {/* Item Lines Section */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Daftar Barang Masuk
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="py-1 px-2.5 rounded-lg border border-stone-300 hover:border-[#14463C] hover:text-[#14463C] bg-white text-xs font-semibold text-stone-700 flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Barang
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Produk</th>
                    <th className="px-3 py-2.5">Satuan</th>
                    <th className="px-3 py-2.5 w-24 text-right">Kuantitas</th>
                    <th className="px-3 py-2.5 w-32 text-right">Biaya Satuan</th>
                    <th className="px-3 py-2.5 w-32 text-right">Subtotal</th>
                    <th className="px-2 py-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lines.map((line, idx) => {
                    const prod = products.find((p) => p.product.id === line.productId);
                    const subtotalLine = (line.qtyInput || 0) * (line.costPerUnit || 0);

                    return (
                      <tr key={idx} className="hover:bg-stone-50/50">
                        <td className="px-4 py-2">
                          <select
                            value={line.productId}
                            onChange={(e) => handleProductChange(idx, e.target.value)}
                            className="w-full py-1.5 px-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-900"
                          >
                            {products.map((p) => (
                              <option key={p.product.id} value={p.product.id}>
                                {p.product.name} {p.product.track_expiry === 1 ? '(Lacak Kedaluwarsa)' : ''}
                              </option>
                            ))}
                          </select>
                          {prod?.product.track_expiry === 1 && (
                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Wajib Batch
                              </span>
                              <input
                                type="text"
                                placeholder="Kode Batch *"
                                value={line.batchCode || ''}
                                onChange={(e) => {
                                  const updated = [...lines];
                                  updated[idx]!.batchCode = e.target.value;
                                  setLines(updated);
                                }}
                                className="py-1 px-2 text-[11px] bg-amber-50/50 border border-amber-300 rounded text-stone-900 w-28 focus:ring-1 focus:ring-amber-600"
                                required
                              />
                              <input
                                type="date"
                                placeholder="Tgl Expiry *"
                                value={line.expiryDate || ''}
                                onChange={(e) => {
                                  const updated = [...lines];
                                  updated[idx]!.expiryDate = e.target.value;
                                  setLines(updated);
                                }}
                                className="py-1 px-2 text-[11px] bg-amber-50/50 border border-amber-300 rounded text-stone-900 w-32 focus:ring-1 focus:ring-amber-600"
                                required
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={line.productUnitId}
                            onChange={(e) => handleUnitChange(idx, e.target.value)}
                            className="w-full py-1.5 px-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800"
                          >
                            {prod?.units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.unit_code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            value={line.qtyInput}
                            onChange={(e) => {
                              const updated = [...lines];
                              updated[idx]!.qtyInput = parseInt(e.target.value, 10) || 0;
                              setLines(updated);
                            }}
                            className="w-full py-1.5 px-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-right text-stone-900"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={line.costPerUnit}
                            onChange={(e) => {
                              const updated = [...lines];
                              updated[idx]!.costPerUnit = parseInt(e.target.value, 10) || 0;
                              setLines(updated);
                            }}
                            className="w-full py-1.5 px-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-right text-stone-900"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-stone-900 font-mono">
                          {formatRupiah(subtotalLine)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lines.length <= 1}
                            className="p-1 text-stone-400 hover:text-rose-600 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total Summary Card */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Total Biaya Faktur Penerimaan
              </span>
              <p className="text-xs text-stone-400 mt-0.5">{lines.length} baris produk diterima</p>
            </div>
            <div className="text-2xl font-bold font-mono text-[#14463C]">{formatRupiah(totalCost)}</div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || lines.length === 0}
              className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-md ${
                !isSubmitting && lines.length > 0
                  ? 'bg-[#14463C] text-white hover:bg-[#0F352E] cursor-pointer'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memposting Penerimaan Barang...
                </>
              ) : (
                `Posting Penerimaan Barang (${formatRupiah(totalCost)})`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
