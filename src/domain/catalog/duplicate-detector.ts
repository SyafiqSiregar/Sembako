/**
 * Domain: Duplicate Product Detector
 * Pure logic. Zero UI/Dexie dependency.
 */

export interface ProductCatalogItem {
  id: string;
  name: string;
  category_id?: string;
  category_name?: string;
  base_unit_name?: string;
  base_unit_code?: string;
  barcodes: string[];
  stock: number;
  price: number;
  cost: number;
  tx_count?: number;
}

export type DuplicateReason = 'identical_barcode' | 'high_name_similarity' | 'multi_unit_variant';

export interface DuplicateGroup {
  id: string;
  reason: DuplicateReason;
  similarity_score: number; // 0..100
  description: string;
  products: ProductCatalogItem[];
  suggested_primary_id: string;
}

const UNIT_SYNONYMS: Record<string, string> = {
  gr: 'g',
  gram: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  ltr: 'l',
  liter: 'l',
  ml: 'ml',
  mili: 'ml',
  btl: 'botol',
  bks: 'bungkus',
  bgks: 'bungkus',
  pcs: 'pcs',
  pc: 'pcs',
  bh: 'pcs',
  buah: 'pcs',
  dus: 'dus',
  karton: 'dus',
  slop: 'slop',
  pak: 'pack',
  pack: 'pack',
  sachet: 'sachet',
  sch: 'sachet',
  renceng: 'renceng',
  rcg: 'renceng',
  pres: 'pres',
};

/**
 * Normalisasi nama produk sembako:
 * - Huruf kecil
 * - Hapus tanda baca
 * - Normalisasi spasi
 * - Petakan singkatan umum satuan sembako
 */
export function normalizeProductName(rawName: string): string {
  if (!rawName) return '';

  const clean = rawName
    .toLowerCase()
    .replace(/([0-9]+)([a-zA-Z]+)/g, '$1 $2') // Pisahkan angka & teks: 85gr -> 85 gr, 5kg -> 5 kg
    .replace(/([a-zA-Z]+)([0-9]+)/g, '$1 $2')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = clean.split(' ').map((token) => UNIT_SYNONYMS[token] || token);
  return tokens.join(' ');
}

/**
 * Ekstraksi token kata (hanya kata non-angka atau kata bermakna)
 */
export function tokenize(text: string): Set<string> {
  const norm = normalizeProductName(text);
  const words = norm.split(' ').filter((w) => w.length > 0);
  return new Set(words);
}

/**
 * Token Dice Coefficient (0..1)
 * 2 * |A ∩ B| / (|A| + |B|)
 */
export function calculateDiceSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeProductName(nameA);
  const normB = normalizeProductName(nameB);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const setA = tokenize(normA);
  const setB = tokenize(normB);

  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  return (2 * intersectionCount) / (setA.size + setB.size);
}

/**
 * Deteksi apakah dua produk adalah varian eceran vs dus (misal "Indomie Goreng" vs "Indomie Goreng Dus")
 */
function isMultiUnitVariant(prodA: ProductCatalogItem, prodB: ProductCatalogItem): boolean {
  const normA = normalizeProductName(prodA.name);
  const normB = normalizeProductName(prodB.name);

  const wholesaleKeywords = ['dus', 'karton', 'slop', 'pack', 'renceng', 'pres'];

  const aHasWholesaleWord = wholesaleKeywords.some((w) => normA.includes(w));
  const bHasWholesaleWord = wholesaleKeywords.some((w) => normB.includes(w));

  // Salah satu punya kata dus/karton, satunya tidak
  if (aHasWholesaleWord !== bHasWholesaleWord) {
    // Hilangkan kata grosir dan cek kemiripan nama dasar
    const stripWholesale = (t: string) =>
      t
        .split(' ')
        .filter((w) => !wholesaleKeywords.includes(w))
        .join(' ');

    const coreA = stripWholesale(normA);
    const coreB = stripWholesale(normB);

    if (calculateDiceSimilarity(coreA, coreB) >= 0.75) {
      return true;
    }
  }

  return false;
}

/**
 * Pindai daftar katalog produk aktif dan kelompokkan kandidat duplikat.
 */
export function detectDuplicateCandidates(
  products: ProductCatalogItem[],
  ignoredPairIds: Set<string> = new Set()
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const visitedPairs = new Set<string>();

  for (let i = 0; i < products.length; i++) {
    const prodA = products[i]!;

    for (let j = i + 1; j < products.length; j++) {
      const prodB = products[j]!;

      const pairKey = [prodA.id, prodB.id].sort().join(':');
      if (visitedPairs.has(pairKey) || ignoredPairIds.has(pairKey)) {
        continue;
      }

      // 1. Cek tabrakan barcode fisik
      const commonBarcodes = prodA.barcodes.filter(
        (b) => b && b.trim() !== '' && prodB.barcodes.includes(b)
      );

      if (commonBarcodes.length > 0) {
        visitedPairs.add(pairKey);
        // Utamakan produk dengan transaksi atau stok lebih banyak
        const suggestedPrimary = (prodA.tx_count || 0) >= (prodB.tx_count || 0) ? prodA.id : prodB.id;

        groups.push({
          id: `dup-${prodA.id}-${prodB.id}`,
          reason: 'identical_barcode',
          similarity_score: 100,
          description: `Barcode fisik sama persis: ${commonBarcodes.join(', ')}`,
          products: [prodA, prodB],
          suggested_primary_id: suggestedPrimary,
        });
        continue;
      }

      // 2. Cek varian multi-satuan (Pcs vs Dus keliru diinput terpisah)
      if (isMultiUnitVariant(prodA, prodB)) {
        visitedPairs.add(pairKey);
        // Utamakan produk eceran (non-dus) sebagai primary
        const normA = normalizeProductName(prodA.name);
        const aIsWholesale = ['dus', 'karton', 'slop', 'renceng'].some((w) => normA.includes(w));
        const suggestedPrimary = aIsWholesale ? prodB.id : prodA.id;

        groups.push({
          id: `dup-${prodA.id}-${prodB.id}`,
          reason: 'multi_unit_variant',
          similarity_score: 85,
          description: 'Potensi produk eceran dan dus/grosir diinput terpisah',
          products: [prodA, prodB],
          suggested_primary_id: suggestedPrimary,
        });
        continue;
      }

      // 3. Cek kemiripan nama hasil normalisasi
      const similarity = calculateDiceSimilarity(prodA.name, prodB.name);
      if (similarity >= 0.8) {
        visitedPairs.add(pairKey);
        const suggestedPrimary = (prodA.tx_count || 0) >= (prodB.tx_count || 0) ? prodA.id : prodB.id;

        groups.push({
          id: `dup-${prodA.id}-${prodB.id}`,
          reason: 'high_name_similarity',
          similarity_score: Math.round(similarity * 100),
          description: `Kemiripan nama produk ${Math.round(similarity * 100)}%`,
          products: [prodA, prodB],
          suggested_primary_id: suggestedPrimary,
        });
      }
    }
  }

  // Urutkan grup dari skor kemiripan tertinggi
  return groups.sort((a, b) => b.similarity_score - a.similarity_score);
}
