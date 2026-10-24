/**
 * Domain Quantity — Operasi Kuantitas & Satuan SembakoOS
 * 
 * Aturan (AGENTS.md §4.1, DATABASE.md §1.1):
 * - Kuantitas internal SELALU berupa INTEGER satuan dasar (qty_base).
 *   - pcs untuk hitungan
 *   - gram (g) untuk berat (1 kg = 1000 g)
 *   - mililiter (ml) untuk volume (1 l = 1000 ml)
 * - Dilarang menyimpan float/desimal di database.
 */

export type QuantityBase = number; // Integer satuan dasar terkecil

export type BaseUnitKind = 'count' | 'weight' | 'volume';

export interface ProductUnitConversion {
  name: string;
  conversionFactor: number; // Berapa qty_base dalam 1 unit ini (mis. 1 kg = 1000)
}

/**
 * Memastikan kuantitas adalah integer satuan dasar yang valid.
 */
export function assertQuantity(qty: number): QuantityBase {
  if (!Number.isSafeInteger(qty)) {
    throw new TypeError(`Kuantitas harus berupa integer satuan dasar, diterima: ${qty}`);
  }
  return qty;
}

/**
 * Mengonversi kuantitas dari satuan kemasan/penjualan ke satuan dasar.
 * Contoh: 2 kg dengan faktor 1000 -> 2000 g
 * Contoh barang timbang: 0,75 kg dengan faktor 1000 -> 750 g
 */
export function toBaseQuantity(amount: number, conversionFactor: number): QuantityBase {
  if (conversionFactor <= 0 || !Number.isInteger(conversionFactor)) {
    throw new TypeError(`Faktor konversi harus integer positif, diterima: ${conversionFactor}`);
  }
  const raw = Math.round(amount * conversionFactor);
  return assertQuantity(raw);
}

/**
 * Mengonversi kuantitas satuan dasar ke satuan kemasan.
 * Contoh: 750 g dengan faktor 1000 -> 0.75 kg
 */
export function fromBaseQuantity(qtyBase: QuantityBase, conversionFactor: number): number {
  assertQuantity(qtyBase);
  if (conversionFactor <= 0) {
    throw new TypeError(`Faktor konversi harus positif, diterima: ${conversionFactor}`);
  }
  return qtyBase / conversionFactor;
}

/**
 * Format kuantitas untuk tampilan pelanggan/kasir.
 * Menampilkan koma desimal gaya Indonesia (mis. "0,75 kg" atau "3 pcs").
 */
export function formatQuantity(
  qtyBase: QuantityBase,
  unitName: string,
  conversionFactor: number = 1
): string {
  const value = fromBaseQuantity(qtyBase, conversionFactor);
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
  }).format(value);
  return `${formatted} ${unitName}`;
}
