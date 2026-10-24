import { describe, it, expect } from 'vitest';
import {
  toBaseQuantity,
  fromBaseQuantity,
  formatQuantity,
  assertQuantity,
} from '@/domain/quantity';

describe('Domain: Quantity (Integer Base Unit)', () => {
  it('mengonversi satuan kemasan ke satuan dasar dengan tepat', () => {
    // 2 kg dengan faktor 1000 = 2000 g
    expect(toBaseQuantity(2, 1000)).toBe(2000);
    // 0.75 kg (timbangan) dengan faktor 1000 = 750 g
    expect(toBaseQuantity(0.75, 1000)).toBe(750);
    // 1 karton (40 pcs) = 40 pcs
    expect(toBaseQuantity(1, 40)).toBe(40);
  });

  it('mengonversi dari satuan dasar ke satuan kemasan', () => {
    expect(fromBaseQuantity(750, 1000)).toBe(0.75);
    expect(fromBaseQuantity(40, 40)).toBe(1);
  });

  it('menolak kuantitas dasar bukan integer aman', () => {
    expect(() => assertQuantity(12.5)).toThrow(TypeError);
    expect(() => toBaseQuantity(1, 0)).toThrow(TypeError);
  });

  it('formatQuantity memformat teks kuantitas dengan koma desimal', () => {
    const formatted = formatQuantity(750, 'kg', 1000);
    expect(formatted).toBe('0,75 kg');
    expect(formatQuantity(5, 'pcs', 1)).toBe('5 pcs');
  });
});
