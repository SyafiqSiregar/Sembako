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
  ChevronDown,
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Total Produk</span>
            <Package className="size-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1 font-mono">{totalItems} SKU</div>
        </div>

        <div className="bg-card p-4 rounded-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Estimasi Nilai Persediaan</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">HPP</span>
          </div>
          <div className="text-2xl font-bold text-primary mt-1 font-mono tracking-tight">
            {formatRupiah(totalValue)}
          </div>
        </div>

        <div className="bg-card p-4 rounded-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Stok Menipis</span>
            <AlertTriangle className="size-4 text-warning-text" />
          </div>
          <div className="text-2xl font-bold text-warning-text mt-1 font-mono">{lowStockCount} Produk</div>
        </div>

        <div className="bg-card p-4 rounded-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Stok Habis (Kosong)</span>
            <AlertTriangle className="size-4 text-destructive-text" />
          </div>
          <div className="text-2xl font-bold text-destructive-text mt-1 font-mono">{outOfStockCount} Produk</div>
        </div>
      </div>

      {/* Consistency Audit Result Banner (if run) */}
      {consistencyResult && (
        <div
          className={`p-3 rounded-card border text-xs flex items-center justify-between ${
            consistencyResult.discrepancies === 0
              ? 'bg-success/20 border-success/40 text-success-foreground'
              : 'bg-destructive/20 border-destructive/40 text-destructive-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            {consistencyResult.discrepancies === 0 ? (
              <CheckCircle className="size-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-destructive-text shrink-0" />
            )}
            <span>
              <strong>Hasil Audit Saldo vs Ledger:</strong> Seluruh {consistencyResult.checked} produk
              telah diperiksa. {consistencyResult.discrepancies} selisih ditemukan. Invarian INV-01
              terjaga.
            </span>
          </div>
          <button
            onClick={() => setConsistencyResult(null)}
            className="text-muted-foreground hover:text-foreground text-xs font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Unified Table Card */}
      <div className="bg-card border border-border rounded-card shadow-sm overflow-hidden">
        {/* Card Header Toolbar */}
        <div className="p-4 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk / SKU..."
                className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-pill text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 pl-3 pr-8 bg-background border border-input rounded-pill text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 pl-3 pr-8 bg-background border border-input rounded-pill text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                <option value="all">Semua Status Stok</option>
                <option value="safe">Stok Aman</option>
                <option value="low">Stok Menipis</option>
                <option value="out_of_stock">Stok Habis</option>
              </select>
              <ChevronDown className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsStocktakeModalOpen(true)}
              className="h-9 px-3.5 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <ClipboardCheck className="size-3.5 text-emerald-300" />
              <span>Stok Opname</span>
            </button>
            <button
              onClick={handleCheckConsistency}
              disabled={isCheckingConsistency || summaries.length === 0}
              className="h-9 px-3 rounded-pill border border-input bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              title="Periksa integritas saldo vs pergerakan ledger"
            >
              <ShieldCheck className="size-3.5 text-emerald-600" />
              <span>{isCheckingConsistency ? 'Memeriksa...' : 'Audit Konsistensi'}</span>
            </button>
            <button
              onClick={loadData}
              className="size-9 rounded-pill border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-xs"
              title="Segarkan Data"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Content Area directly inside Card */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Memuat saldo inventaris...</div>
          ) : filteredSummaries.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="size-12 stroke-[1.5] text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Tidak ada produk ditemukan</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ubah kata kunci pencarian atau filter status</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
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
              <tbody className="divide-y divide-border/60">
                {filteredSummaries.map((item) => (
                  <tr key={item.productId} className="hover:bg-accent/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{item.sku || 'Tanpa SKU'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{item.categoryName}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-foreground font-mono text-sm">
                      {item.currentStock} <span className="text-xs font-normal text-muted-foreground">{item.baseUnitCode}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground font-mono">
                      {item.minStock} {item.baseUnitCode}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-foreground font-mono">
                      {formatRupiah(item.estimatedValue)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'out_of_stock'
                            ? 'bg-destructive text-destructive-foreground border border-destructive/30'
                            : item.status === 'low'
                            ? 'bg-warning text-warning-foreground border border-warning/30'
                            : 'bg-success text-success-foreground border border-success/30'
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
                        className="px-2.5 py-1 rounded-pill border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                        title="Lihat Riwayat Pergerakan Kartu Stok"
                      >
                        <Layers className="size-3 inline mr-1" />
                        Kartu Stok
                      </button>
                      <button
                        onClick={async () => {
                          const prod = await catalogService.getProductById(item.productId);
                          if (prod) setActiveAdjustmentProduct(prod);
                        }}
                        className="px-2.5 py-1 rounded-pill border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                        title="Penyesuaian Stok Manual"
                      >
                        <Sliders className="size-3 inline mr-1" />
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
