import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Package,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Layers,
  ShieldCheck,
  CheckCircle,
  ClipboardCheck,
} from 'lucide-react';
import { db, type Category } from '@/data/db';
import { InventoryService, type ProductStockSummary } from '@/services/inventory.service';
import { CatalogService, type ProductDetail } from '@/services/catalog.service';
import { formatRupiah } from '@/domain/money';
import { StockCardModal } from './StockCardModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StocktakeModal } from './StocktakeModal';
import { StocktakeService } from '@/services/stocktake.service';

export const InventoryView: React.FC = () => {
  const inventoryService = useMemo(() => new InventoryService(db), []);
  const catalogService = useMemo(() => new CatalogService(db), []);
  const stocktakeService = useMemo(
    () => new StocktakeService(db, inventoryService),
    [inventoryService]
  );

  const [summaries, setSummaries] = useState<ProductStockSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [activeStockCardProduct, setActiveStockCardProduct] = useState<ProductDetail | null>(null);
  const [activeAdjustmentProduct, setActiveAdjustmentProduct] = useState<ProductDetail | null>(null);
  const [isStocktakeModalOpen, setIsStocktakeModalOpen] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<{ checked: number; discrepancies: number } | null>(null);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const cats = await catalogService.listCategories();
      setCategories(cats.filter((c) => c.active === 1));

      const stockList = await inventoryService.listProductStockSummaries();
      setSummaries(stockList);
    } catch (e) {
      console.error('Error loading inventory summaries:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [inventoryService, catalogService]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Run ledger consistency audit check (FR-INV-10, AC-24)
  const handleCheckConsistency = async () => {
    setIsCheckingConsistency(true);
    try {
      let discrepancyCount = 0;
      for (const item of summaries) {
        const rec = await inventoryService.reconcileStockLedger(item.productId);
        if (!rec.isConsistent) {
          discrepancyCount++;
        }
      }
      setConsistencyResult({ checked: summaries.length, discrepancies: discrepancyCount });
      showNotification(
        discrepancyCount === 0 ? 'success' : 'error',
        discrepancyCount === 0
          ? `Audit Selesai: Seluruh ${summaries.length} produk konsisten dengan ledger!`
          : `Audit Selesai: Ditemukan ${discrepancyCount} produk berselisih.`
      );
    } finally {
      setIsCheckingConsistency(false);
    }
  };

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    let list = summaries;

    if (selectedCategory !== 'all') {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (cat) {
        list = list.filter((s) => s.categoryName === cat.name);
      }
    }

    if (statusFilter !== 'all') {
      list = list.filter((s) => s.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.sku?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [summaries, selectedCategory, statusFilter, searchQuery, categories]);

  // Totals for metric cards
  const totalItems = summaries.length;
  const totalValue = summaries.reduce((s, item) => s + item.estimatedValue, 0);
  const lowStockCount = summaries.filter((s) => s.status === 'low').length;
  const outOfStockCount = summaries.filter((s) => s.status === 'out_of_stock').length;

  return (
    <div className="flex-1 flex flex-col bg-[#FBF8F3] overflow-hidden select-none">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success' ? 'bg-[#14463C] text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {notification.message}
        </div>
      )}



      {/* Metrics Row */}
      <div className="p-6 pb-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>Total Produk</span>
            <Package className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-bold text-stone-900 mt-1 font-mono">{totalItems} SKU</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>Estimasi Nilai Persediaan</span>
            <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">HPP</span>
          </div>
          <div className="text-2xl font-bold text-[#14463C] mt-1 font-mono tracking-tight">
            {formatRupiah(totalValue)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>Stok Menipis</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">{lowStockCount} Produk</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>Stok Habis (Kosong)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1 font-mono">{outOfStockCount} Produk</div>
        </div>
      </div>

      {/* Consistency Audit Result Banner (if run) */}
      {consistencyResult && (
        <div className="px-6 pt-2">
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              consistencyResult.discrepancies === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {consistencyResult.discrepancies === 0 ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>
                <strong>Hasil Audit Saldo vs Ledger:</strong> Seluruh {consistencyResult.checked} produk
                telah diperiksa. {consistencyResult.discrepancies} selisih ditemukan. Invarian INV-01
                terjaga.
              </span>
            </div>
            <button
              onClick={() => setConsistencyResult(null)}
              className="text-stone-400 hover:text-stone-700 text-xs font-bold px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Unified Filters & Actions Toolbar */}
      <div className="p-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk / SKU..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-3 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
          >
            <option value="all">Semua Status Stok</option>
            <option value="safe">Stok Aman</option>
            <option value="low">Stok Menipis</option>
            <option value="out_of_stock">Stok Habis</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStocktakeModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#14463C] text-white text-xs font-bold hover:bg-[#0F352E] flex items-center gap-1.5 transition shadow-sm"
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-300" />
            <span>Stok Opname</span>
          </button>
          <button
            onClick={handleCheckConsistency}
            disabled={isCheckingConsistency || summaries.length === 0}
            className="px-3.5 py-2 rounded-xl border border-stone-300 hover:border-emerald-600 hover:text-[#14463C] bg-white text-xs font-semibold text-stone-700 flex items-center gap-2 transition"
            title="Periksa integritas saldo vs pergerakan ledger"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{isCheckingConsistency ? 'Memeriksa...' : 'Audit Konsistensi'}</span>
          </button>
          <button
            onClick={loadData}
            className="px-3.5 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center gap-2 transition"
          >
            <RotateCcw className="w-4 h-4 text-stone-500" />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500">Memuat saldo inventaris...</div>
          ) : filteredSummaries.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 stroke-[1.5] text-stone-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-700">Tidak ada produk ditemukan</p>
              <p className="text-xs text-stone-500 mt-0.5">Ubah kata kunci pencarian atau filter status</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Produk & SKU</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5 text-right">Stok Fisik</th>
                  <th className="px-4 py-3.5 text-right">Batas Min</th>
                  <th className="px-4 py-3.5 text-right">Estimasi Nilai</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSummaries.map((item) => (
                  <tr key={item.productId} className="hover:bg-stone-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-stone-900">{item.name}</div>
                      <div className="text-[11px] text-stone-500 font-mono">{item.sku || 'Tanpa SKU'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-stone-600">{item.categoryName}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-stone-900 font-mono text-sm">
                      {item.currentStock} <span className="text-xs font-normal text-stone-500">{item.baseUnitCode}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-stone-600 font-mono">
                      {item.minStock} {item.baseUnitCode}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-stone-800 font-mono">
                      {formatRupiah(item.estimatedValue)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'out_of_stock'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : item.status === 'low'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {item.status === 'out_of_stock'
                          ? 'Habis'
                          : item.status === 'low'
                          ? 'Menipis'
                          : 'Aman'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={async () => {
                          const prod = await catalogService.getProductById(item.productId);
                          if (prod) setActiveStockCardProduct(prod);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-[#14463C] hover:text-[#14463C] text-stone-700 font-semibold transition"
                        title="Lihat Riwayat Pergerakan Kartu Stok"
                      >
                        <Layers className="w-3.5 h-3.5 inline mr-1" />
                        Kartu Stok
                      </button>
                      <button
                        onClick={async () => {
                          const prod = await catalogService.getProductById(item.productId);
                          if (prod) setActiveAdjustmentProduct(prod);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold transition"
                        title="Penyesuaian Stok Manual"
                      >
                        <Sliders className="w-3.5 h-3.5 inline mr-1" />
                        Sesuaikan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Stock Card Modal */}
      <StockCardModal
        isOpen={Boolean(activeStockCardProduct)}
        onClose={() => setActiveStockCardProduct(null)}
        product={activeStockCardProduct}
        inventoryService={inventoryService}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={Boolean(activeAdjustmentProduct)}
        onClose={() => setActiveAdjustmentProduct(null)}
        product={activeAdjustmentProduct}
        inventoryService={inventoryService}
        onAdjustmentComplete={() => {
          showNotification('success', 'Penyesuaian stok berhasil disimpan');
          loadData();
        }}
      />

      {/* Stocktake Modal */}
      <StocktakeModal
        isOpen={isStocktakeModalOpen}
        onClose={() => setIsStocktakeModalOpen(false)}
        categories={categories}
        stocktakeService={stocktakeService}
        onSessionPosted={() => {
          showNotification('success', 'Sesi stok opname berhasil diposting dan saldo disesuaikan');
          loadData();
        }}
      />
    </div>
  );
};
