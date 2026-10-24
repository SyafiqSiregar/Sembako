import { type ProductDetail } from '@/services/catalog.service';

export interface SearchableProduct {
  id: string;
  name: string;
  normalizedName: string;
  sku?: string;
  categoryName?: string;
  barcodes: string[];
  productDetail: ProductDetail;
}

export interface SearchResult {
  productDetail: ProductDetail;
  score: number;
}

export class ProductSearchIndex {
  private items: SearchableProduct[] = [];
  private barcodeMap = new Map<string, SearchableProduct>();

  /**
   * Mengisi / memperbarui seluruh indeks dari daftar produk.
   */
  setItems(products: ProductDetail[]): void {
    this.items = [];
    this.barcodeMap.clear();

    for (const p of products) {
      if (p.product.active === 0) continue; // Hanya produk aktif

      const barcodes = p.barcodes.map((b) => b.barcode.trim());
      const item: SearchableProduct = {
        id: p.product.id,
        name: p.product.name,
        normalizedName: this.normalize(p.product.name),
        sku: p.product.sku?.toLowerCase(),
        categoryName: p.category?.name?.toLowerCase(),
        barcodes,
        productDetail: p,
      };

      this.items.push(item);
      for (const bc of barcodes) {
        this.barcodeMap.set(bc, item);
      }
    }
  }

  /**
   * Alias untuk setItems agar kompatibel dengan pemanggilan buildIndex
   */
  async buildIndex(products: ProductDetail[]): Promise<void> {
    this.setItems(products);
  }

  /**
   * Mencari produk dan satuan yang cocok persis dengan barcode.
   */
  searchBarcode(barcode: string): { product: ProductDetail; matchedUnit: import('@/data/db').ProductUnit } | undefined {
    const item = this.barcodeMap.get(barcode.trim());
    if (!item) return undefined;
    const barcodeRecord = item.productDetail.barcodes.find((b) => b.barcode === barcode.trim());
    const matchedUnit = item.productDetail.units.find((u) => u.id === barcodeRecord?.product_unit_id) || item.productDetail.units[0];
    if (!matchedUnit) return undefined;
    return { product: item.productDetail, matchedUnit };
  }
  upsertItem(product: ProductDetail): void {
    this.removeItem(product.product.id);
    if (product.product.active === 1) {
      const barcodes = product.barcodes.map((b) => b.barcode.trim());
      const item: SearchableProduct = {
        id: product.product.id,
        name: product.product.name,
        normalizedName: this.normalize(product.product.name),
        sku: product.product.sku?.toLowerCase(),
        categoryName: product.category?.name?.toLowerCase(),
        barcodes,
        productDetail: product,
      };
      this.items.push(item);
      for (const bc of barcodes) {
        this.barcodeMap.set(bc, item);
      }
    }
  }

  /**
   * Menghapus item dari indeks.
   */
  removeItem(productId: string): void {
    const existingIndex = this.items.findIndex((item) => item.id === productId);
    if (existingIndex !== -1) {
      const item = this.items[existingIndex]!;
      for (const bc of item.barcodes) {
        this.barcodeMap.delete(bc);
      }
      this.items.splice(existingIndex, 1);
    }
  }

  /**
   * Pencarian cepat dengan ranking relevansi dan toleransi salah ketik ringan.
   */
  search(query: string, limit: number = 20): ProductDetail[] {
    const rawQuery = query.trim();
    if (!rawQuery) {
      return this.items.slice(0, limit).map((i) => i.productDetail);
    }

    // 1. Cek kecocokan persis barcode (instan O(1))
    const exactBarcodeMatch = this.barcodeMap.get(rawQuery);
    if (exactBarcodeMatch) {
      return [exactBarcodeMatch.productDetail];
    }

    const normQuery = this.normalize(rawQuery);
    const queryTokens = normQuery.split(/\s+/).filter(Boolean);

    const scored: SearchResult[] = [];

    for (const item of this.items) {
      let score = 0;

      // Cek SKU
      if (item.sku && item.sku.includes(normQuery)) {
        score += 80;
      }

      // Cek Barcode substring
      if (item.barcodes.some((bc) => bc.includes(rawQuery))) {
        score += 90;
      }

      // Cek Nama Produk
      if (item.normalizedName === normQuery) {
        score += 100;
      } else if (item.normalizedName.startsWith(normQuery)) {
        score += 70;
      } else {
        // Cek per kata (token matching)
        let tokenMatches = 0;
        for (const qt of queryTokens) {
          if (item.normalizedName.includes(qt)) {
            tokenMatches++;
          } else if (this.isSubsequenceOrFuzzy(qt, item.normalizedName)) {
            tokenMatches += 0.5;
          }
        }

        if (tokenMatches > 0) {
          score += (tokenMatches / queryTokens.length) * 50;
        }
      }

      if (score > 10) {
        scored.push({ productDetail: item.productDetail, score });
      }
    }

    // Urutkan skor tertinggi ke terendah
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.productDetail);
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .trim();
  }

  /**
   * Memeriksa toleransi typo sederhana (apakah karakter query muncul berurutan dalam teks).
   */
  private isSubsequenceOrFuzzy(sub: string, target: string): boolean {
    if (sub.length < 3) return false;
    let sIdx = 0;
    for (let tIdx = 0; tIdx < target.length && sIdx < sub.length; tIdx++) {
      if (sub[sIdx] === target[tIdx]) {
        sIdx++;
      }
    }
    return sIdx >= sub.length - 1; // Toleransi 1 karakter meleset untuk kata > 3 huruf
  }
}

export const productSearchIndex = new ProductSearchIndex();
