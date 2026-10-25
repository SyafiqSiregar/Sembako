import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/data/db';
import { CatalogService, type ProductDetail, type Category } from '@/services/catalog.service';
import { productSearchIndex } from '@/data/search/product-search';
import { formatRupiah } from '@/domain/money';
import { useAuthStore } from '@/features/auth/authStore';
import { ProductFormModal } from './ProductFormModal';
import { CsvImportModal } from './CsvImportModal';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Archive,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Barcode,
  FolderPlus,
  Loader2,
  UploadCloud,
} from 'lucide-react';

export const ProductCatalogView: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDetail | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const catalogService = useMemo(() => new CatalogService(db), []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let cats = await catalogService.listCategories();
      if (cats.length === 0) {
        // Seed initial categories jika kosong
        const c1 = await catalogService.createCategory({ name: 'Beras & Biji', createdBy: 'system' });
        const c2 = await catalogService.createCategory({ name: 'Minyak & Margarin', createdBy: 'system' });
        const c3 = await catalogService.createCategory({ name: 'Gula & Pemanis', createdBy: 'system' });
        const c4 = await catalogService.createCategory({ name: 'Bumbu & Tepung', createdBy: 'system' });
        const c5 = await catalogService.createCategory({ name: 'Telur & Segar', createdBy: 'system' });
        cats = [c1, c2, c3, c4, c5];
      }
      setCategories(cats);

      let prods = await catalogService.listProducts();

      // Seed initial demo products jika kosong
      if (prods.length === 0 && cats[0]) {
        await catalogService.createProduct({
          name: 'Beras Rojo Lele 5 kg',
          sku: 'BRS-001',
          categoryId: cats[0].id,
          baseUnitKind: 'weight',
          baseUnitCode: 'g',
          minStockBase: 5,
          trackExpiry: true,
          createdBy: 'system',
          units: [{ unitCode: 'sak', name: 'Sak 5 kg', conversionFactor: 5000, price: 72000, costX10k: 650000000, isBase: true }],
          barcodes: [{ barcode: '8991234567890', unitCode: 'sak' }],
        });

        if (cats[1]) {
          await catalogService.createProduct({
            name: 'Minyak Goreng Sovia 2 L',
            sku: 'MYK-001',
            categoryId: cats[1].id,
            baseUnitKind: 'volume',
            baseUnitCode: 'ml',
            minStockBase: 10,
            trackExpiry: true,
            createdBy: 'system',
            units: [{ unitCode: 'pch', name: 'Pouch 2 L', conversionFactor: 2000, price: 34000, costX10k: 300000000, isBase: true }],
            barcodes: [{ barcode: '8992345678901', unitCode: 'pch' }],
          });
        }

        if (cats[2]) {
          await catalogService.createProduct({
            name: 'Gula Pasir Gulaku 1 kg',
            sku: 'GLA-001',
            categoryId: cats[2].id,
            baseUnitKind: 'weight',
            baseUnitCode: 'g',
            minStockBase: 10,
            trackExpiry: false,
            createdBy: 'system',
            units: [{ unitCode: 'bks', name: 'Bungkus 1 kg', conversionFactor: 1000, price: 17500, costX10k: 150000000, isBase: true }],
            barcodes: [{ barcode: '8993456789012', unitCode: 'bks' }],
          });
        }

        prods = await catalogService.listProducts();
      }

      setProducts(prods);
      productSearchIndex.setItems(prods);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered & Searched Products
  const displayedProducts = useMemo(() => {
    let result = products;

    if (searchQuery.trim()) {
      result = productSearchIndex.search(searchQuery.trim());
    }

    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.product.category_id === selectedCategory);
    }

    return result;
  }, [products, searchQuery, selectedCategory]);

  const handleEdit = (prod: ProductDetail) => {
    setEditingProduct(prod);
    setIsFormOpen(true);
  };

  const handleCreateNew = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleArchive = async (id: string, name: string) => {
    if (!currentUser) return;
    if (confirm(`Yakin ingin mengarsipkan produk '${name}'? Produk tidak akan muncul di kasir.`)) {
      try {
        await catalogService.archiveProduct(id, currentUser.id);
        await loadData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !currentUser) return;
    try {
      await catalogService.createCategory({
        name: newCategoryName.trim(),
        createdBy: currentUser.id,
      });
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-foreground">
          Katalog Produk
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-card border border-input text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <UploadCloud className="size-3.5" />
            <span>Impor CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-card border border-input text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <FolderPlus className="size-3.5" />
            <span>Kategori</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm"
          >
            <Plus className="size-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border rounded-card p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, SKU, atau barcode..."
            className="w-full h-10 pl-10 pr-4 bg-background border border-input rounded-pill text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Category Pills / Filter */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Semua ({products.length})
          </button>

          {categories.map((c) => {
            const count = products.filter((p) => p.product.category_id === c.id).length;
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-card border border-border rounded-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Memuat katalog produk...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-destructive-text">
            Terjadi kesalahan: {error}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Package className="size-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-foreground">
              Tidak Ada Produk Ditemukan
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery
                ? `Tidak ada produk yang cocok dengan pencarian '${searchQuery}'.`
                : 'Belum ada produk dalam kategori ini. Silakan tambah produk pertama Anda.'}
            </p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-pill hover:bg-primary-hover shadow-sm"
            >
              Tambah Produk Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Nama Produk & Barcode</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Harga Jual</th>
                  <th className="py-3 px-4 text-right">Harga Modal</th>
                  <th className="py-3 px-4 text-center">Stok</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedProducts.map((item) => {
                  const baseUnit = item.units[0];
                  const barcode = item.barcodes[0]?.barcode;
                  const isLowStock = item.totalStockBase <= item.product.min_stock_base;
                  const isOutOfStock = item.totalStockBase <= 0;

                  return (
                    <tr key={item.product.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm">
                            {item.product.name}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            {item.product.sku && (
                              <span className="font-mono bg-muted px-1.5 py-0.2 rounded">
                                {item.product.sku}
                              </span>
                            )}
                            {barcode ? (
                              <span className="flex items-center gap-1 font-mono">
                                <Barcode className="size-3" />
                                {barcode}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Tanpa barcode</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-pill bg-muted font-medium text-[11px]">
                          {item.category?.name || 'Tanpa Kategori'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-foreground tabular-nums text-sm">
                        {baseUnit ? formatRupiah(baseUnit.price) : 'Rp 0'}
                        {baseUnit && (
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            /{baseUnit.name}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right text-muted-foreground tabular-nums">
                        {baseUnit ? formatRupiah(Math.round(baseUnit.cost_x10k / 10000)) : 'Rp 0'}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold tabular-nums">
                        <span
                          className={
                            isOutOfStock
                              ? 'text-destructive-text'
                              : isLowStock
                              ? 'text-warning-text'
                              : 'text-foreground'
                          }
                        >
                          {item.totalStockBase} {item.product.base_unit_code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-destructive/15 text-destructive-text">
                            <XCircle className="size-3" />
                            <span>Habis</span>
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-warning/20 text-warning-text">
                            <AlertTriangle className="size-3" />
                            <span>Menipis</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-success text-success-text">
                            <CheckCircle2 className="size-3" />
                            <span>Aman</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Edit Produk"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(item.product.id, item.product.name)}
                            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive-text transition-colors"
                            title="Arsipkan Produk"
                          >
                            <Archive className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={loadData}
        categories={categories}
        editingProduct={editingProduct}
        currentUserId={currentUser?.id || 'owner'}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={loadData}
        categories={categories}
        currentUserId={currentUser?.id || 'owner'}
      />

      {/* Simple Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border w-full max-w-sm rounded-card p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-serif font-bold text-base text-foreground">
                Tambah Kategori Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCategorySubmit} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Nama Kategori</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Contoh: Minuman & Susu"
                  className="h-10 px-3 bg-card border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3.5 py-2 rounded-pill border border-input font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-pill bg-primary text-primary-foreground font-semibold hover:bg-primary-hover shadow-sm"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
