import { describe, it, expect } from 'vitest';
import {
  normalizeProductName,
  calculateDiceSimilarity,
  detectDuplicateCandidates,
  type ProductCatalogItem,
} from '@/domain/catalog/duplicate-detector';

describe('Domain: duplicate-detector', () => {
  it('normalisasi nama produk dan singkatan satuan sembako', () => {
    expect(normalizeProductName('Indomie Goreng 85gr')).toBe('indomie goreng 85 g');
    expect(normalizeProductName('Beras Ramos 5kg')).toBe('beras ramos 5 kg');
    expect(normalizeProductName('Minyak Bimoli 2 Liter')).toBe('minyak bimoli 2 l');
    expect(normalizeProductName('Kecap Bango 550ml')).toBe('kecap bango 550 ml');
  });

  it('menghitung skor kemiripan Token Dice', () => {
    // Persis sama
    expect(calculateDiceSimilarity('Indomie Goreng', 'indomie goreng')).toBe(1.0);

    // Mirip dengan variasi urutan/singkatan
    const sim1 = calculateDiceSimilarity('Indomie Goreng 85gr', 'Indomie Goreng 85 gram');
    expect(sim1).toBe(1.0); // Karena normalisasi menyamakan 'gr' dan 'gram' ke 'g'

    // Beda produk
    const sim2 = calculateDiceSimilarity('Beras Ramos 5kg', 'Gula Pasir Gulaku 1kg');
    expect(sim2).toBeLessThan(0.3);
  });

  it('mendeteksi duplikat karena barcode fisik sama persis (skor 100%)', () => {
    const products: ProductCatalogItem[] = [
      {
        id: 'p1',
        name: 'Indomie Goreng Spesial',
        barcodes: ['089686010014'],
        stock: 50,
        price: 3500,
        cost: 2900,
        tx_count: 10,
      },
      {
        id: 'p2',
        name: 'Mie Instan Goreng',
        barcodes: ['089686010014'],
        stock: 5,
        price: 3500,
        cost: 2900,
        tx_count: 1,
      },
    ];

    const dupes = detectDuplicateCandidates(products);
    expect(dupes.length).toBe(1);
    expect(dupes[0]?.reason).toBe('identical_barcode');
    expect(dupes[0]?.similarity_score).toBe(100);
    expect(dupes[0]?.suggested_primary_id).toBe('p1'); // p1 punya transaksi lebih banyak
  });

  it('mendeteksi duplikat karena kemiripan nama >= 80%', () => {
    const products: ProductCatalogItem[] = [
      {
        id: 'p1',
        name: 'Minyak Goreng Sania 2L',
        barcodes: ['899123456789'],
        stock: 20,
        price: 34000,
        cost: 29000,
      },
      {
        id: 'p2',
        name: 'Minyak Sania 2 Liter',
        barcodes: [],
        stock: 4,
        price: 34000,
        cost: 29000,
      },
      {
        id: 'p3',
        name: 'Tepung Terigu Segitiga Biru 1kg',
        barcodes: ['899999999999'],
        stock: 15,
        price: 13000,
        cost: 11000,
      },
    ];

    const dupes = detectDuplicateCandidates(products);
    expect(dupes.length).toBe(1);
    expect(dupes[0]?.reason).toBe('high_name_similarity');
    expect(dupes[0]?.similarity_score).toBeGreaterThanOrEqual(80);
  });

  it('mendeteksi potensi multi-satuan eceran vs dus', () => {
    const products: ProductCatalogItem[] = [
      {
        id: 'p1',
        name: 'Indomie Kuah Ayam Bawang',
        barcodes: ['111111'],
        stock: 40,
        price: 3500,
        cost: 2900,
      },
      {
        id: 'p2',
        name: 'Indomie Kuah Ayam Bawang Dus',
        barcodes: ['222222'],
        stock: 2,
        price: 135000,
        cost: 116000,
      },
    ];

    const dupes = detectDuplicateCandidates(products);
    expect(dupes.length).toBe(1);
    expect(dupes[0]?.reason).toBe('multi_unit_variant');
    expect(dupes[0]?.suggested_primary_id).toBe('p1'); // eceran diutamakan
  });

  it('mengabaikan pasangan yang dimasukkan ke ignoredPairIds', () => {
    const products: ProductCatalogItem[] = [
      {
        id: 'p1',
        name: 'Indomie Goreng Rendang',
        barcodes: [],
        stock: 10,
        price: 3500,
        cost: 2900,
      },
      {
        id: 'p2',
        name: 'Indomie Goreng Aceh',
        barcodes: [],
        stock: 10,
        price: 3500,
        cost: 2900,
      },
    ];

    const ignored = new Set(['p1:p2']);
    const dupes = detectDuplicateCandidates(products, ignored);
    expect(dupes.length).toBe(0);
  });
});
