import { create } from 'zustand';
import { type ProductDetail } from '@/services/catalog.service';
import { type ProductUnit } from '@/data/db';
import { defaultIdGenerator } from '@/domain/time';

export interface CartLine {
  productId: string;
  productUnitId: string;
  name: string;
  unitCode: string;
  unitName: string;
  conversionFactor: number;
  price: number;
  costX10k: number;
  barcode?: string;
  qty: number; // Kuantitas dalam satuan jual
  discount: number; // Diskon per baris
  availableStockBase: number;
}

interface PosState {
  activeSaleId: string;
  items: CartLine[];
  discountTotal: number; // Diskon transaksi
  selectedItemIndex: number | null;

  // Actions
  addItem: (product: ProductDetail, unit?: ProductUnit) => void;
  updateQuantity: (productId: string, unitId: string, qty: number) => void;
  incrementQuantity: (productId: string, unitId: string) => void;
  decrementQuantity: (productId: string, unitId: string) => void;
  removeItem: (productId: string, unitId: string) => void;
  setLineDiscount: (productId: string, unitId: string, discount: number) => void;
  setTransactionDiscount: (discount: number) => void;
  clearCart: () => void;

  // Computations
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  activeSaleId: defaultIdGenerator.generateId(),
  items: [],
  discountTotal: 0,
  selectedItemIndex: null,

  addItem: (productDetail, selectedUnit) => {
    const { items } = get();
    const unit = selectedUnit || productDetail.units[0];
    if (!unit) return;

    const existingIndex = items.findIndex(
      (it) => it.productId === productDetail.product.id && it.productUnitId === unit.id
    );

    if (existingIndex !== -1) {
      // Tambah kuantitas item yang sudah ada
      const updated = [...items];
      const existing = updated[existingIndex]!;
      existing.qty += 1;
      set({ items: updated, selectedItemIndex: existingIndex });
    } else {
      const barcode = productDetail.barcodes[0]?.barcode;
      const newLine: CartLine = {
        productId: productDetail.product.id,
        productUnitId: unit.id,
        name: productDetail.product.name,
        unitCode: unit.unit_code,
        unitName: unit.name,
        conversionFactor: unit.conversion_factor,
        price: unit.price,
        costX10k: unit.cost_x10k,
        barcode,
        qty: 1,
        discount: 0,
        availableStockBase: productDetail.totalStockBase,
      };
      set({ items: [...items, newLine], selectedItemIndex: items.length });
    }
  },

  updateQuantity: (productId, unitId, qty) => {
    const { items } = get();
    if (qty <= 0) {
      set({
        items: items.filter((it) => !(it.productId === productId && it.productUnitId === unitId)),
      });
      return;
    }
    const updated = items.map((it) =>
      it.productId === productId && it.productUnitId === unitId ? { ...it, qty } : it
    );
    set({ items: updated });
  },

  incrementQuantity: (productId, unitId) => {
    const { items } = get();
    const updated = items.map((it) =>
      it.productId === productId && it.productUnitId === unitId ? { ...it, qty: it.qty + 1 } : it
    );
    set({ items: updated });
  },

  decrementQuantity: (productId, unitId) => {
    const { items } = get();
    const existing = items.find((it) => it.productId === productId && it.productUnitId === unitId);
    if (!existing) return;

    if (existing.qty <= 1) {
      set({
        items: items.filter((it) => !(it.productId === productId && it.productUnitId === unitId)),
      });
    } else {
      const updated = items.map((it) =>
        it.productId === productId && it.productUnitId === unitId ? { ...it, qty: it.qty - 1 } : it
      );
      set({ items: updated });
    }
  },

  removeItem: (productId, unitId) => {
    const { items } = get();
    set({
      items: items.filter((it) => !(it.productId === productId && it.productUnitId === unitId)),
    });
  },

  setLineDiscount: (productId, unitId, discount) => {
    const { items } = get();
    const updated = items.map((it) =>
      it.productId === productId && it.productUnitId === unitId ? { ...it, discount } : it
    );
    set({ items: updated });
  },

  setTransactionDiscount: (discountTotal) => {
    set({ discountTotal: Math.max(0, discountTotal) });
  },

  clearCart: () => {
    set({
      activeSaleId: defaultIdGenerator.generateId(),
      items: [],
      discountTotal: 0,
      selectedItemIndex: null,
    });
  },

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, it) => {
      const lineTotal = Math.max(0, it.qty * it.price - it.discount);
      return sum + lineTotal;
    }, 0);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const { discountTotal } = get();
    return Math.max(0, subtotal - discountTotal);
  },

  getItemCount: () => {
    const { items } = get();
    return items.reduce((sum, it) => sum + it.qty, 0);
  },
}));
