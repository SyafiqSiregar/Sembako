import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/data/db';
import { CatalogService, type ProductDetail, type Category } from '@/services/catalog.service';
import { productSearchIndex } from '@/data/search/product-search';
import { formatRupiah } from '@/domain/money';
import { useAuthStore } from '@/features/auth/authStore';
import { ProductFormModal } from './ProductFormModal';
import { CsvImportModal } from './CsvImportModal';
import { LabelPrintModal } from './LabelPrintModal';
import { DuplicateAssistantModal } from './DuplicateAssistantModal';
import { isInternalBarcode } from '@/domain/barcode/ean13';
import { SettingsService } from '@/services/settings.service';
import { hasPermission } from '@/domain/permissions';
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
  RotateCcw,
  HelpCircle,
  Printer,
  Sparkles,
} from 'lucide-react';

export const ProductCatalogView: React.FC = () => {
  const { currentUser, roleCodes } = useAuthStore();
  const canManageCatalog = useMemo(() => hasPermission(roleCodes, 'catalog.manage'), [roleCodes]);
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusTab, setStatusTab] = useState<'active' | 'archived' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDuplicateGuideOpen, setIsDuplicateGuideOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelModalProduct, setLabelModalProduct] = useState<ProductDetail | null>(null);
  const [storeName, setStoreName] = useState('TOKO SEMBAKO BERKAH');
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

      const prods = await catalogService.listProducts({ activeOnly: false });
      setProducts(prods);
      productSearchIndex.setItems(prods);

      const settingsService = new SettingsService(db);
      const settings = await settingsService.getStoreSettings();
      if (settings?.storeName) {
        setStoreName(settings.storeName);
      }
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

    if (statusTab === 'active') {
      result = result.filter((p) => p.product.active === 1);
    } else if (statusTab === 'archived') {
      result = result.filter((p) => p.product.active === 0);
    }

    if (searchQuery.trim()) {
      result = productSearchIndex.search(searchQuery.trim());
      if (statusTab === 'active') {
        result = result.filter((p) => p.product.active === 1);
      } else if (statusTab === 'archived') {
        result = result.filter((p) => p.product.active === 0);
      }
    }

    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.product.category_id === selectedCategory);
    }

    return result;
  }, [products, statusTab, searchQuery, selectedCategory]);

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

  const handleReactivate = async (id: string, name: string) => {
    if (!currentUser) return;
    if (confirm(`Aktifkan kembali produk '${name}'? Produk akan muncul kembali di kasir.`)) {
      try {
        await catalogService.updateProduct({
          id,
          active: 1,
          updatedBy: currentUser.id,
        });
        await loadData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleOpenLabelModal = (product?: ProductDetail) => {
    setLabelModalProduct(product || null);
    setIsLabelModalOpen(true);
  };

  const handleCreateInternalBarcode = async (item: ProductDetail) => {
    if (!currentUser) return;
    const baseUnit = item.units[0];
    if (!baseUnit) {
      alert('Produk tidak memiliki satuan jual');
      return;
    }

    try {
      await catalogService.assignInternalBarcode({
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          roles: roleCodes,
        },
        productId: item.product.id,
        productUnitId: baseUnit.id,
      });

      await loadData();

      // Buka modal cetak label dengan produk ini langsung terpilih
      const updatedProduct = (await catalogService.getProductById(item.product.id)) || item;
      setLabelModalProduct(updatedProduct);
      setIsLabelModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat barcode internal';
      alert(msg);
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
      {/* Unified Products Table Card */}
      <div className="bg-card border border-border rounded-card shadow-sm overflow-hidden">
        {/* Card Header Toolbar */}
        <div className="p-4 border-b border-border flex flex-col gap-3 bg-card">
          {/* Top Row: Search Input + Action Buttons */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, SKU, atau barcode..."
                className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-pill text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!canManageCatalog && (
                <span className="px-2.5 py-1 rounded-pill bg-secondary text-secondary-foreground text-[11px] font-semibold">
                  Mode Cek Harga & Label
                </span>
              )}

              {canManageCatalog && (
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(true)}
                  className="h-9 px-3 rounded-pill bg-background border border-input text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <UploadCloud className="size-3.5 text-muted-foreground" />
                  <span>Impor Excel / CSV</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleOpenLabelModal()}
                className="h-9 px-3 rounded-pill bg-background border border-input text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs flex items-center gap-1.5"
                title="Cetak Label Barcode Rak atau Kemasan Produk"
              >
                <Printer className="size-3.5 text-muted-foreground" />
                <span>Cetak Label</span>
              </button>

              {canManageCatalog && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="h-9 px-3 rounded-pill bg-background border border-input text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <FolderPlus className="size-3.5 text-muted-foreground" />
                    <span>Kategori</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDuplicateGuideOpen(true)}
                    className="h-9 px-3 rounded-pill bg-background border border-input text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs flex items-center gap-1.5"
                    title="Panduan menangani barang ganda / salah input"
                  >
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                    <span>Barang Duplikat?</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="h-9 px-3.5 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>Tambah Produk</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bottom Row: Status Filter Segment + Category Filter Pills */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-border/50">
            {/* Status Segment Control */}
            <div className="flex items-center p-0.5 bg-muted rounded-pill text-xs shrink-0 self-start">
              <button
                type="button"
                onClick={() => setStatusTab('active')}
                className={`px-3 py-1 rounded-pill text-[11px] font-semibold transition-colors ${
                  statusTab === 'active'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Aktif ({products.filter((p) => p.product.active === 1).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('archived')}
                className={`px-3 py-1 rounded-pill text-[11px] font-semibold transition-colors ${
                  statusTab === 'archived'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Diarsipkan ({products.filter((p) => p.product.active === 0).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('all')}
                className={`px-3 py-1 rounded-pill text-[11px] font-semibold transition-colors ${
                  statusTab === 'all'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua ({products.length})
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                Semua Kategori
              </button>

              {categories.map((c) => {
                const count = products.filter((p) => p.product.category_id === c.id).length;
                const isSelected = selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

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
                : 'Belum ada produk dalam kategori ini.'}
            </p>
            {canManageCatalog && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-pill hover:bg-primary-hover shadow-sm"
              >
                Tambah Produk Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Nama Produk & Barcode</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Harga Jual</th>
                  {canManageCatalog && <th className="py-3 px-4 text-right">Harga Modal</th>}
                  <th className="py-3 px-4 text-center">Stok</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedProducts.map((item) => {
                  const baseUnit = item.units[0];
                  const secondaryUnits = item.units.slice(1);
                  const isLowStock = item.totalStockBase <= item.product.min_stock_base;
                  const isOutOfStock = item.totalStockBase <= 0;

                  return (
                    <tr key={item.product.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm">
                            {item.product.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            {item.product.sku && (
                              <span className="font-mono bg-muted px-1.5 py-0.2 rounded">
                                {item.product.sku}
                              </span>
                            )}
                            {item.barcodes.length > 0 ? (
                              item.barcodes.map((bc) => {
                                const matchedUnit = item.units.find((u) => u.id === bc.product_unit_id);
                                const isInt = isInternalBarcode(bc.barcode);
                                return (
                                  <span key={bc.id} className="flex items-center gap-1 font-mono bg-muted/80 px-1.5 py-0.5 rounded text-foreground">
                                    <Barcode className="size-3 text-muted-foreground" />
                                    <span>{bc.barcode}</span>
                                    {isInt && (
                                      <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.2 rounded font-semibold uppercase font-sans">
                                        Int
                                      </span>
                                    )}
                                    {matchedUnit && item.units.length > 1 && (
                                      <span className="text-[10px] text-muted-foreground font-sans font-medium">({matchedUnit.name})</span>
                                    )}
                                  </span>
                                );
                              })
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground italic">Tanpa barcode</span>
                                {canManageCatalog && (
                                  <button
                                    type="button"
                                    onClick={() => handleCreateInternalBarcode(item)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition shadow-xs"
                                    title="Buat barcode internal otomatis untuk barang ini"
                                  >
                                    <Sparkles className="size-2.5" />
                                    <span>+ Barcode</span>
                                  </button>
                                )}
                              </div>
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
                        <div>
                          {baseUnit ? formatRupiah(baseUnit.price) : 'Rp 0'}
                          {baseUnit && (
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                              /{baseUnit.name}
                            </span>
                          )}
                        </div>
                        {secondaryUnits.length > 0 && (
                          <div className="flex flex-col items-end gap-1 mt-1">
                            {secondaryUnits.map((u) => (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold"
                                title={`1 ${u.name} isi ${u.conversion_factor} ${baseUnit?.name || 'unit'}`}
                              >
                                <span>{u.name} (x{u.conversion_factor}):</span>
                                <span>{formatRupiah(u.price)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {canManageCatalog && (
                        <td className="py-3.5 px-4 text-right text-muted-foreground tabular-nums">
                          <div>{baseUnit ? formatRupiah(Math.round(baseUnit.cost_x10k / 10000)) : 'Rp 0'}</div>
                          {secondaryUnits.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {secondaryUnits.map((u) => (
                                <div key={u.id}>
                                  {u.name}: {formatRupiah(Math.round(u.cost_x10k / 10000))}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      )}

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
                        {item.product.active === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                            <Archive className="size-3 text-stone-500" />
                            <span>Diarsipkan</span>
                          </span>
                        ) : isOutOfStock ? (
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
                          {item.product.active === 0 ? (
                            canManageCatalog && (
                              <button
                                type="button"
                                onClick={() => handleReactivate(item.product.id, item.product.name)}
                                className="h-7 px-2.5 rounded-pill flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-xs"
                                title="Aktifkan Kembali Produk"
                              >
                                <RotateCcw className="size-3 text-emerald-600" />
                                <span>Aktifkan</span>
                              </button>
                            )
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenLabelModal(item)}
                                className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                title="Cetak Label Barcode"
                              >
                                <Printer className="size-3.5" />
                              </button>
                              {canManageCatalog && (
                                <>
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
                                </>
                              )}
                            </>
                          )}
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
      {/* ======================================================== */}
      {/* MODAL: Asisten Deteksi & Penggabungan Produk Duplikat    */}
      {/* ======================================================== */}
      <DuplicateAssistantModal
        isOpen={isDuplicateGuideOpen}
        onClose={() => setIsDuplicateGuideOpen(false)}
        catalogService={catalogService}
        currentUserId={currentUser?.id || 'admin'}
        onMergeCompleted={loadData}
      />

      {/* ======================================================== */}
      {/* MODAL: Cetak Label Barcode Rak / Produk (FR-CAT-11)      */}
      {/* ======================================================== */}
      <LabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        products={products}
        initialProduct={labelModalProduct}
        storeName={storeName}
        onBarcodeCreated={loadData}
      />
    </div>
  );
};
