import React, { useEffect, useState, useMemo } from 'react';
import { X, Layers, ShieldCheck, AlertTriangle } from 'lucide-react';
import { InventoryService, type StockCardEntry } from '@/services/inventory.service';
import { type ProductDetail } from '@/services/catalog.service';

interface StockCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDetail | null;
  inventoryService: InventoryService;
}

export const StockCardModal: React.FC<StockCardModalProps> = ({
  isOpen,
  onClose,
  product,
  inventoryService,
}) => {
  const [entries, setEntries] = useState<StockCardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [isConsistent, setIsConsistent] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setLoading(true);
      Promise.all([
        inventoryService.getStockCard(product.product.id),
        inventoryService.reconcileStockLedger(product.product.id),
      ])
        .then(([cardEntries, rec]) => {
          setEntries(cardEntries);
          setIsConsistent(rec.isConsistent);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, product, inventoryService]);

  const filteredEntries = useMemo(() => {
    if (filterType === 'all') return entries;
    return entries.filter((e) => e.type === filterType);
  }, [entries, filterType]);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-serif font-bold">Kartu Stok (Stock Card)</h2>
                {isConsistent !== null && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1 ${
                      isConsistent
                        ? 'bg-emerald-400/20 text-emerald-300'
                        : 'bg-rose-400/20 text-rose-300'
                    }`}
                  >
                    {isConsistent ? (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        Ledger Konsisten
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        Selisih Ledger
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80">
                {product.product.name} ({product.product.sku || 'Tanpa SKU'}) • Satuan Dasar: {product.product.base_unit_code}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-600">Filter Tipe:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="py-1 px-2.5 bg-white border border-stone-300 rounded-lg text-stone-800 font-medium focus:ring-2 focus:ring-[#14463C] focus:outline-none"
            >
              <option value="all">Semua Mutasi ({entries.length})</option>
              <option value="RECEIPT">Penerimaan Barang (Masuk)</option>
              <option value="SALE">Penjualan Kasir (Keluar)</option>
              <option value="CUSTOMER_RETURN">Retur Pelanggan</option>
              <option value="DAMAGE_SPOILAGE">Barang Rusak</option>
              <option value="COUNT_ADJUSTMENT">Penyesuaian Stok</option>
              <option value="INITIAL_BALANCE">Saldo Awal</option>
            </select>
          </div>

          <div className="text-stone-500 font-medium">
            Saldo Terakhir: <strong className="text-stone-900">{product.totalStockBase} {product.product.base_unit_code}</strong>
          </div>
        </div>

        {/* Stock Card Table */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#FBF8F3]">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-stone-500">Memuat kartu stok...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500">
                Belum ada riwayat mutasi stok untuk produk ini.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Tipe Mutasi</th>
                    <th className="px-4 py-3">Referensi</th>
                    <th className="px-4 py-3 text-right text-emerald-800">Masuk (+)</th>
                    <th className="px-4 py-3 text-right text-rose-800">Keluar (-)</th>
                    <th className="px-4 py-3 text-right text-stone-900">Saldo</th>
                    <th className="px-4 py-3">Petugas</th>
                    <th className="px-4 py-3">Alasan / Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {filteredEntries.map((e, idx) => {
                    const timeStr = new Date(e.occurredAt).toLocaleString('id-ID', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    });

                    return (
                      <tr key={`${e.movementId}-${idx}`} className="hover:bg-stone-50/70 transition">
                        <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap font-sans">{timeStr}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              e.qtyIn > 0
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-stone-700 truncate max-w-[120px] font-sans">
                          {e.refId || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                          {e.qtyIn > 0 ? `+${e.qtyIn}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-rose-600">
                          {e.qtyOut > 0 ? `-${e.qtyOut}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-stone-900 bg-stone-50/50">
                          {e.runningBalance}
                        </td>
                        <td className="px-4 py-2.5 text-stone-700 font-sans">{e.userName}</td>
                        <td className="px-4 py-2.5 text-stone-600 italic font-sans truncate max-w-[180px]">
                          {e.reason || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
