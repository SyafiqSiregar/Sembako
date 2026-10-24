import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  Clock,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Package,
} from 'lucide-react';
import { db, type ProductUnit } from '@/data/db';
import { CatalogService, type ProductDetail } from '@/services/catalog.service';
import { InventoryService } from '@/services/inventory.service';
import { CheckoutService, type CheckoutResult } from '@/services/checkout.service';
import { HeldCartService } from '@/services/held-cart.service';
import { ProductSearchIndex } from '@/data/search/product-search';
import { usePosStore, type CartLine } from './posStore';
import { useAuthStore } from '@/features/auth/authStore';
import { formatRupiah } from '@/domain/money';
import { PaymentDialog } from './PaymentDialog';
import { ReceiptModal } from './ReceiptModal';
import { HeldCartsModal } from './HeldCartsModal';

export const PosView: React.FC = () => {
  const { currentUser, activeSession } = useAuthStore();
  const {
    items,
    activeSaleId,
    discountTotal,
    addItem,
    incrementQuantity,
    decrementQuantity,
    removeItem,
    setLineDiscount,
    setTransactionDiscount,
    clearCart,
    getSubtotal,
    getTotal,
    getItemCount,
  } = usePosStore();

  // Services
  const catalogService = useMemo(() => new CatalogService(db), []);
  const inventoryService = useMemo(() => new InventoryService(db), []);
  const checkoutService = useMemo(() => new CheckoutService(db, inventoryService), [inventoryService]);
  const heldCartService = useMemo(() => new HeldCartService(db), []);

  // State
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchIndex, setSearchIndex] = useState<ProductSearchIndex | null>(null);
  const [heldCartCount, setHeldCartCount] = useState(0);

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [unitSelectProduct, setUnitSelectProduct] = useState<ProductDetail | null>(null);
  const [discountModalItem, setDiscountModalItem] = useState<CartLine | null>(null);
  const [isTrxDiscountModalOpen, setIsTrxDiscountModalOpen] = useState(false);
  const [holdNotePrompt, setHoldNotePrompt] = useState(false);
  const [holdNote, setHoldNote] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load catalog & init index
  const loadCatalogData = async () => {
    try {
      const cats = await catalogService.listCategories();
      setCategories(cats.filter((c) => c.active === 1));

      let activeProds = (await catalogService.listProducts()).filter((p) => p.product.active === 1);

      // Inisialisasi saldo awal toko jika seluruh stok produk bernilai 0 (AGENTS.md §4.2: Satu Pintu InventoryService)
      const totalStockAll = activeProds.reduce((s, p) => s + p.totalStockBase, 0);
      if (totalStockAll === 0 && activeProds.length > 0) {
        for (const p of activeProds) {
          const baseUnit = p.units[0];
          const qty = (baseUnit?.conversion_factor || 1) * 50; // 50 kemasan
          await inventoryService.recordMovement({
            type: 'INITIAL_BALANCE',
            refType: 'opening',
            userId: currentUser?.id || 'system',
            reason: 'Inisialisasi saldo awal inventaris toko',
            items: [
              {
                productId: p.product.id,
                qtyDeltaBase: qty,
                unitCostX10k: baseUnit?.cost_x10k || 100000000,
              },
            ],
          });
        }
        activeProds = (await catalogService.listProducts()).filter((p) => p.product.active === 1);
      }

      setProducts(activeProds);

      const idx = new ProductSearchIndex();
      await idx.buildIndex(activeProds);
      setSearchIndex(idx);

      const held = await heldCartService.getHeldCarts();
      setHeldCartCount(held.length);
    } catch (e) {
      console.error('Error loading POS catalog:', e);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, [catalogService, heldCartService]);

  // Keep barcode input focused for scanner
  useEffect(() => {
    if (!isPaymentOpen && !isReceiptOpen && !isHeldModalOpen && !unitSelectProduct && !discountModalItem) {
      barcodeInputRef.current?.focus();
    }
  }, [isPaymentOpen, isReceiptOpen, isHeldModalOpen, unitSelectProduct, discountModalItem]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Barcode scanning handler (AC-02)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code || !searchIndex) return;

    const hit = searchIndex.searchBarcode(code);
    if (hit) {
      addItem(hit.product, hit.matchedUnit);
      showNotification('success', `Ditambahkan: ${hit.product.product.name} (${hit.matchedUnit.unit_code})`);
      setBarcodeInput('');
    } else {
      showNotification('error', `Barcode '${code}' tidak ditemukan dalam katalog`);
    }
  };

  // Handle product click in grid
  const handleProductCardClick = (product: ProductDetail) => {
    if (product.units.length > 1) {
      setUnitSelectProduct(product);
    } else {
      addItem(product);
      showNotification('success', `Ditambahkan: ${product.product.name}`);
    }
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.product.category_id === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.product.name.toLowerCase().includes(q) ||
          p.product.sku?.toLowerCase().includes(q) ||
          p.barcodes.some((b) => b.barcode.includes(q))
      );
    }
    return list;
  }, [products, selectedCategory, searchQuery]);

  // Checkout execution
  const handleConfirmPayment = async (
    paymentMethod: 'cash' | 'non_cash_manual',
    amountPaid: number
  ) => {
    if (!activeSession) {
      throw new Error('Sesi kasir belum dibuka. Buka kas terlebih dahulu.');
    }
    if (!currentUser) {
      throw new Error('Pengguna tidak terautentikasi.');
    }

    const checkoutItems = items.map((it) => ({
      productId: it.productId,
      productUnitId: it.productUnitId,
      nameSnapshot: it.name,
      unitCodeSnapshot: it.unitCode,
      factorSnapshot: it.conversionFactor,
      barcodeSnapshot: it.barcode,
      qtyBase: it.qty * it.conversionFactor,
      unitPriceSnapshot: it.price,
      unitCostX10kSnapshot: it.costX10k,
      discount: it.discount,
    }));

    const result = await checkoutService.processCheckout({
      saleId: activeSaleId,
      sessionId: activeSession.id,
      cashierId: currentUser.id,
      items: checkoutItems,
      discountTotal,
      paymentMethod,
      amountPaid,
    });

    setCheckoutResult(result);
    setIsPaymentOpen(false);
    setIsReceiptOpen(true);
    clearCart();
    await loadCatalogData(); // refresh stock on hand
  };

  // Hold active cart
  const handleHoldCart = async () => {
    if (items.length === 0) return;
    if (!currentUser || !activeSession) return;

    try {
      await heldCartService.holdCart({
        userId: currentUser.id,
        sessionId: activeSession.id,
        note: holdNote.trim() || undefined,
        items,
        discountTotal,
      });

      clearCart();
      setHoldNotePrompt(false);
      setHoldNote('');
      const held = await heldCartService.getHeldCarts();
      setHeldCartCount(held.length);
      showNotification('success', 'Keranjang berhasil ditahan');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menahan keranjang';
      showNotification('error', msg);
    }
  };

  const total = getTotal();
  const subtotal = getSubtotal();
  const itemCount = getItemCount();

  return (
    <div className="flex h-full bg-[#FBF8F3] overflow-hidden select-none">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success'
              ? 'bg-[#14463C] text-white border border-emerald-600'
              : 'bg-rose-600 text-white border border-rose-700'
          }`}
        >
          {notification.type === 'error' && <AlertTriangle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* ======================================================== */}
      {/* KOLOM KIRI: Scan Barcode, Filter & Katalog Produk (~60%)  */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col border-r border-stone-200 min-w-0">
        {/* Top Action Bar: Barcode Scan & Search */}
        <div className="p-4 bg-white border-b border-stone-200 flex flex-col sm:flex-row gap-3">
          {/* Scan Barcode Input */}
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <Barcode className="w-5 h-5 text-[#14463C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode / Tekan Enter..."
              className="w-full pl-11 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14463C] focus:border-transparent transition"
            />
          </form>

          {/* Pencarian Nama/SKU */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk / SKU..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14463C] focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Category Filter Horizontal Pills */}
        <div className="px-4 py-2.5 bg-white border-b border-stone-200 overflow-x-auto flex gap-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-[#14463C] text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Semua Produk
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === c.id
                  ? 'bg-[#14463C] text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400">
              <Package className="w-12 h-12 stroke-[1.5] mb-2 text-stone-300" />
              <p className="text-sm font-semibold text-stone-600">Tidak ada produk ditemukan</p>
              <p className="text-xs text-stone-400 mt-0.5">Ubah kata kunci atau pilih kategori lain</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const baseUnit = p.units.find((u) => u.is_base === 1) || p.units[0];
                const price = baseUnit?.price || 0;
                const isOutOfStock = p.totalStockBase <= 0;
                const isLowStock = !isOutOfStock && p.totalStockBase <= p.product.min_stock_base;

                return (
                  <button
                    key={p.product.id}
                    onClick={() => handleProductCardClick(p)}
                    className="bg-white p-3.5 rounded-xl border border-stone-200 hover:border-emerald-300 hover:shadow-md transition text-left flex flex-col justify-between group active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider truncate">
                          {p.category?.name || 'Sembako'}
                        </span>
                        {/* Stock indicator badge */}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {isOutOfStock ? 'Habis' : `${p.totalStockBase} ${p.product.base_unit_code}`}
                        </span>
                      </div>

                      <h4 className="font-semibold text-stone-800 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-[#14463C] transition">
                        {p.product.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#14463C]">{formatRupiah(price)}</div>
                        <div className="text-[10px] text-stone-500">/{baseUnit?.unit_code}</div>
                      </div>

                      {p.units.length > 1 && (
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium">
                          {p.units.length} Satuan
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* KOLOM KANAN: Keranjang Kasir & Tombol Bayar 56px (~40%)   */}
      {/* ======================================================== */}
      <div className="w-[360px] xl:w-[420px] bg-white flex flex-col shadow-lg z-10 shrink-0">
        {/* Cart Top Bar: Cashier badge & Held cart action */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#14463C]" />
            <div>
              <h3 className="font-serif font-bold text-stone-800 text-sm">Keranjang Penjualan</h3>
              <p className="text-[11px] text-stone-500">{itemCount} barang dipilih</p>
            </div>
          </div>

          {/* Held Carts Badge Button */}
          <button
            onClick={() => setIsHeldModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-300 hover:border-emerald-500 bg-white text-stone-700 text-xs font-semibold transition"
          >
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span>Tertahan</span>
            {heldCartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#14463C] text-white text-[10px] font-bold flex items-center justify-center">
                {heldCartCount}
              </span>
            )}
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
              <ShoppingCart className="w-12 h-12 stroke-[1.5] mb-2 text-stone-300" />
              <p className="text-sm font-semibold text-stone-600">Keranjang masih kosong</p>
              <p className="text-xs text-stone-400 mt-1">
                Scan barcode barang atau pilih produk dari katalog sebelah kiri
              </p>
            </div>
          ) : (
            items.map((line) => {
              const lineTotal = Math.max(0, line.qty * line.price - line.discount);

              return (
                <div
                  key={`${line.productId}-${line.productUnitId}`}
                  className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-stone-800 text-xs truncate">{line.name}</div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                        <span>{formatRupiah(line.price)}</span>
                        <span>/</span>
                        <span className="font-medium text-stone-700 bg-stone-200 px-1 rounded text-[10px]">
                          {line.unitCode}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => removeItem(line.productId, line.productUnitId)}
                      className="p-1 text-stone-400 hover:text-rose-600 rounded transition"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Stepper + Subtotal baris */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/50">
                    {/* Stepper Touch Target >= 44px */}
                    <div className="flex items-center bg-white rounded-lg border border-stone-300 overflow-hidden shadow-sm">
                      <button
                        onClick={() => decrementQuantity(line.productId, line.productUnitId)}
                        className="w-9 h-9 flex items-center justify-center hover:bg-stone-100 text-stone-700 transition active:bg-stone-200"
                        title="Kurangi"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center font-bold text-xs text-stone-900 font-mono">
                        {line.qty}
                      </span>
                      <button
                        onClick={() => incrementQuantity(line.productId, line.productUnitId)}
                        className="w-9 h-9 flex items-center justify-center hover:bg-stone-100 text-stone-700 transition active:bg-stone-200"
                        title="Tambah"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Diskon baris & Total baris */}
                    <div className="text-right">
                      {line.discount > 0 && (
                        <div className="text-[10px] text-emerald-700 italic">
                          -{formatRupiah(line.discount)}
                        </div>
                      )}
                      <div className="text-xs font-bold text-stone-900">{formatRupiah(lineTotal)}</div>
                      <button
                        onClick={() => setDiscountModalItem(line)}
                        className="text-[10px] text-stone-500 hover:text-[#14463C] underline flex items-center justify-end gap-1 mt-0.5"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        Diskon
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Calculation Footer & Big Action Buttons */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/50 space-y-3">
          {/* Subtotal & Diskon Transaksi */}
          <div className="space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-stone-800">{formatRupiah(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-emerald-800">
              <button
                onClick={() => setIsTrxDiscountModalOpen(true)}
                className="underline hover:text-[#14463C] flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                Diskon Transaksi
              </button>
              <span className="font-semibold">
                {discountTotal > 0 ? `-${formatRupiah(discountTotal)}` : 'Rp 0'}
              </span>
            </div>

            {/* Total Belanja (Display Size) */}
            <div className="flex justify-between items-baseline pt-2 border-t border-stone-200">
              <span className="text-sm font-bold text-stone-800 uppercase tracking-wider">Total</span>
              <span className="text-2xl font-serif font-bold text-[#14463C] tracking-tight">
                {formatRupiah(total)}
              </span>
            </div>
          </div>

          {/* Secondary Buttons: Tahan & Bersihkan */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setHoldNotePrompt(true)}
              disabled={items.length === 0}
              className="py-2.5 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              Tahan
            </button>
            <button
              onClick={clearCart}
              disabled={items.length === 0}
              className="py-2.5 px-3 rounded-xl border border-stone-300 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
              Bersihkan
            </button>
          </div>

          {/* Huge Bayar Button 56px High */}
          <button
            onClick={() => setIsPaymentOpen(true)}
            disabled={items.length === 0}
            className={`w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.99] ${
              items.length > 0
                ? 'bg-[#14463C] text-white hover:bg-[#0F352E] cursor-pointer'
                : 'bg-stone-300 text-stone-500 cursor-not-allowed'
            }`}
          >
            <DollarSign className="w-5 h-5 text-emerald-300" />
            <span>Bayar ({formatRupiah(total)})</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL DIALOGS                                             */}
      {/* ======================================================== */}

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        total={total}
        onConfirmPayment={handleConfirmPayment}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        checkoutResult={checkoutResult}
        cashierName={currentUser?.name}
      />

      {/* Held Carts Modal */}
      <HeldCartsModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        heldCartService={heldCartService}
        onCartRestored={async () => {
          const held = await heldCartService.getHeldCarts();
          setHeldCartCount(held.length);
        }}
      />

      {/* Unit Selection Modal (if product has multiple packaging units) */}
      {unitSelectProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-base">Pilih Satuan Kemasan</h3>
            <p className="text-xs text-stone-500">{unitSelectProduct.product.name}</p>

            <div className="space-y-2">
              {unitSelectProduct.units.map((u: ProductUnit) => (
                <button
                  key={u.id}
                  onClick={() => {
                    addItem(unitSelectProduct, u);
                    setUnitSelectProduct(null);
                    showNotification('success', `Ditambahkan: ${unitSelectProduct.product.name} (${u.unit_code})`);
                  }}
                  className="w-full p-3 rounded-xl border border-stone-200 hover:border-[#14463C] hover:bg-emerald-50/40 text-left flex items-center justify-between transition"
                >
                  <div>
                    <div className="font-bold text-stone-800 text-xs">{u.name}</div>
                    <div className="text-[10px] text-stone-500">
                      Konversi: {u.conversion_factor} {unitSelectProduct.product.base_unit_code}
                    </div>
                  </div>
                  <div className="font-bold text-[#14463C] text-sm">{formatRupiah(u.price)}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setUnitSelectProduct(null)}
              className="w-full py-2.5 rounded-xl border border-stone-300 text-stone-600 text-xs font-semibold hover:bg-stone-50 transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Line Discount Modal */}
      {discountModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-5 space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-base">Diskon Item</h3>
            <p className="text-xs text-stone-500 truncate">{discountModalItem.name}</p>

            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Potongan Harga (Rp)
              </label>
              <input
                type="number"
                defaultValue={discountModalItem.discount}
                id="line-discount-input"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#14463C] focus:outline-none"
                placeholder="0"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDiscountModalItem(null)}
                className="flex-1 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-600"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('line-discount-input') as HTMLInputElement;
                  const val = parseInt(input?.value || '0', 10) || 0;
                  setLineDiscount(discountModalItem.productId, discountModalItem.productUnitId, val);
                  setDiscountModalItem(null);
                }}
                className="flex-1 py-2 rounded-lg bg-[#14463C] text-white text-xs font-bold hover:bg-[#0F352E]"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Discount Modal */}
      {isTrxDiscountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-5 space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-base">Diskon Transaksi</h3>
            <p className="text-xs text-stone-500">Potongan total belanja untuk pelanggan</p>

            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Diskon Total (Rp)
              </label>
              <input
                type="number"
                defaultValue={discountTotal}
                id="trx-discount-input"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#14463C] focus:outline-none"
                placeholder="0"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsTrxDiscountModalOpen(false)}
                className="flex-1 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-600"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('trx-discount-input') as HTMLInputElement;
                  const val = parseInt(input?.value || '0', 10) || 0;
                  setTransactionDiscount(val);
                  setIsTrxDiscountModalOpen(false);
                }}
                className="flex-1 py-2 rounded-lg bg-[#14463C] text-white text-xs font-bold hover:bg-[#0F352E]"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Cart Note Prompt */}
      {holdNotePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-base">Tahan Keranjang Belanja</h3>
            <p className="text-xs text-stone-500">
              Masukkan nama pelanggan atau catatan pengenal agar mudah dicari saat dipulihkan.
            </p>

            <div>
              <input
                type="text"
                autoFocus
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                placeholder="Contoh: Ibu Siti (Ambil dompet)"
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-[#14463C] focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setHoldNotePrompt(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                onClick={handleHoldCart}
                className="flex-1 py-2.5 rounded-xl bg-[#14463C] text-white text-xs font-bold hover:bg-[#0F352E]"
              >
                Tahan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
