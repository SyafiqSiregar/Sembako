import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ean13CheckDigit,
  isValidEan13,
  buildInternalEan13,
  isInternalBarcode,
  encodeEan13Modules,
  renderEan13Svg,
} from '@/domain/barcode/ean13';

describe('Domain: EAN-13 Barcode Generator (FR-CAT-11, rencana_lanjutan.md §1.6)', () => {
  // BC-U01
  it('BC-U01: menghitung check digit dengan tepat untuk 200000000001 -> 5', () => {
    expect(ean13CheckDigit('200000000001')).toBe(5);
  });

  // BC-U02
  it('BC-U02: memvalidasi contoh EAN-13 publik resmi (4006381333931) -> true', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
  });

  // BC-U03
  it('BC-U03: menolak barcode dengan checksum salah (4006381333932) -> false', () => {
    expect(isValidEan13('4006381333932')).toBe(false);
  });

  // BC-U04
  it('BC-U04: menolak barcode dengan panjang != 13 atau memuat huruf', () => {
    expect(isValidEan13('123456789012')).toBe(false); // 12 digit
    expect(isValidEan13('12345678901234')).toBe(false); // 14 digit
    expect(isValidEan13('400638133393A')).toBe(false); // alphanumeric
    expect(isValidEan13('')).toBe(false);
  });

  // BC-U05
  it('BC-U05: membentuk barcode internal dari nomor urut 1 -> 2000000000015', () => {
    const code = buildInternalEan13(1);
    expect(code).toBe('2000000000015');
    expect(isValidEan13(code)).toBe(true);
  });

  // BC-U06
  it('BC-U06: membentuk barcode internal batas atas 9.999.999.999 -> 13 digit valid', () => {
    const code = buildInternalEan13(9_999_999_999);
    expect(code.length).toBe(13);
    expect(code.startsWith('209999999999')).toBe(true);
    expect(isValidEan13(code)).toBe(true);
  });

  // BC-U07
  it('BC-U07: melempar galat bila nomor urut melebihi batas 10 digit (> 9.999.999.999) atau negatif', () => {
    expect(() => buildInternalEan13(10_000_000_000)).toThrow(RangeError);
    expect(() => buildInternalEan13(-1)).toThrow(RangeError);
  });

  // BC-U08
  it('BC-U08: mendeteksi barcode internal awalan 20-29 vs barcode pabrikan luar', () => {
    expect(isInternalBarcode('2000000000015')).toBe(true);
    expect(isInternalBarcode('2912345678901')).toBe(true);
    expect(isInternalBarcode('089686010015')).toBe(false); // Pabrikan (12/13 digit lain)
    expect(isInternalBarcode('8991234567890')).toBe(false); // GS1 Indonesia resmi
  });

  // BC-U09
  it('BC-U09: menghasilkan tepat 95 modul biner dengan penjaga kiri 101, tengah 01010, kanan 101', () => {
    const modules = encodeEan13Modules('4006381333931');
    expect(modules.length).toBe(95);
    expect(modules.startsWith('101')).toBe(true);
    expect(modules.endsWith('101')).toBe(true);
    // Modul ke 45 s.d 49 (0-indexed) adalah penjaga tengah 01010
    expect(modules.slice(45, 50)).toBe('01010');
  });

  // BC-U10: Fast-check property test
  it('BC-U10 (Property): setiap nomor urut acak 0..9.999.999 menghasilkan EAN-13 valid', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9_999_999 }), (seq) => {
        const code = buildInternalEan13(seq);
        return isValidEan13(code);
      }),
      { numRuns: 100 }
    );
  });

  // BC-U11: Fast-check property test
  it('BC-U11 (Property): dua nomor urut berbeda selalu menghasilkan barcode yang berbeda', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 5_000_001, max: 9_999_999 }),
        (seq1, seq2) => {
          const code1 = buildInternalEan13(seq1);
          const code2 = buildInternalEan13(seq2);
          return code1 !== code2;
        }
      ),
      { numRuns: 100 }
    );
  });

  // BC-U12
  it('BC-U12: renderEan13Svg menghasilkan dokumen SVG murni siap cetak tanpa skrip', () => {
    const svg = renderEan13Svg('2000000000015', { moduleMm: 0.33, barHeightMm: 12, showText: true });
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Barcode 2000000000015"');
    expect(svg).toContain('<text');
    expect(svg).toContain('2  000000  000015');
    expect(svg).not.toContain('<script');
  });
});
