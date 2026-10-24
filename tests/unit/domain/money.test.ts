import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  addMoney,
  subtractMoney,
  percentageBps,
  splitMoney,
  formatRupiah,
  parseRupiah,
} from '@/domain/money';

describe('Domain: Money (Integer Rupiah)', () => {
  it('menjumlahkan beberapa nominal uang dengan tepat', () => {
    expect(addMoney(10000, 2500, 500)).toBe(13000);
    expect(addMoney()).toBe(0);
  });

  it('mengurangkan nominal uang dengan tepat', () => {
    expect(subtractMoney(50000, 17500)).toBe(32500);
  });

  it('menolak nilai bukan integer aman', () => {
    expect(() => addMoney(12.5 as any)).toThrow(TypeError);
    expect(() => subtractMoney(100, 20.3 as any)).toThrow(TypeError);
  });

  it('menghitung persentase bps dengan pembulatan half-up', () => {
    // 10% dari 15.000 = 1.500
    expect(percentageBps(15000, 1000)).toBe(1500);
    // 5% dari 12.345 = 617.25 -> round half-up -> 617
    expect(percentageBps(12345, 500)).toBe(617);
    // 33.33% dari 100 = 33.33 -> 33
    expect(percentageBps(100, 3333)).toBe(33);
  });

  it('splitMoney membagi total secara proporsional tanpa kehilangan nominal (selisih nol)', () => {
    // 100 rupiah dibagi rata ke 3 orang -> 34, 33, 33 = 100
    const result = splitMoney(100, [1, 1, 1]);
    expect(result).toEqual([34, 33, 33]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('splitMoney selalu mempertahankan invarian total = sum(parts) dengan fast-check', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
        (total, ratios) => {
          const parts = splitMoney(total, ratios);
          const sum = parts.reduce((a, b) => a + b, 0);
          return sum === total && parts.length === ratios.length;
        }
      )
    );
  });

  it('formatRupiah memformat ke id-ID tanpa sen', () => {
    expect(formatRupiah(12500)).toBe('Rp\u00A012.500'.replace('\u00A0', ' ')); // Handle non-breaking space
    expect(formatRupiah(0)).toContain('0');
  });

  it('parseRupiah mengubah teks menjadi integer uang', () => {
    expect(parseRupiah('Rp 12.500')).toBe(12500);
    expect(parseRupiah('50000')).toBe(50000);
    expect(parseRupiah('')).toBe(0);
  });
});
