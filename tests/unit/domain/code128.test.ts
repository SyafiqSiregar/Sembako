import { describe, it, expect } from 'vitest';
import {
  calculateCode128CheckDigit,
  encodeCode128BModules,
  renderCode128Svg,
} from '@/domain/barcode/code128';

describe('Domain: Code-128 Barcode Generator (code128.ts)', () => {
  it('menghitung check digit Modulo 103 dengan benar untuk string standar', () => {
    // Start B = 104
    // 'A': ASCII 65 - 32 = 33. sum = 104 + (33 * 1) = 137. 137 % 103 = 34.
    expect(calculateCode128CheckDigit('A')).toBe(34);

    // '1': ASCII 49 - 32 = 17. sum = 104 + (17 * 1) = 121. 121 % 103 = 18.
    expect(calculateCode128CheckDigit('1')).toBe(18);

    // Nomor struk tipikal
    const cd = calculateCode128CheckDigit('STR-20261031-0001');
    expect(cd).toBeGreaterThanOrEqual(0);
    expect(cd).toBeLessThan(103);
  });

  it('mengonversi string menjadi deretan modul biner dengan quiet zones', () => {
    const modules = encodeCode128BModules('TEST');
    expect(modules.length).toBeGreaterThan(0);
    // Quiet zone 10 '0' di awal dan akhir
    expect(modules.startsWith('0000000000')).toBe(true);
    expect(modules.endsWith('0000000000')).toBe(true);
    // Berisi '1' dan '0' saja
    expect(/^[01]+$/.test(modules)).toBe(true);
  });

  it('menghasilkan modul kosong untuk teks kosong', () => {
    expect(encodeCode128BModules('')).toBe('');
    expect(encodeCode128BModules('   ')).toBe('');
  });

  it('merender elemen SVG yang valid dengan atribut crispEdges', () => {
    const svg = renderCode128Svg('STR-20261031-0001');
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('STR-20261031-0001');
    expect(svg).toContain('</svg>');
  });

  it('mendukung opsi kustomisasi barHeight dan showText', () => {
    const svgWithoutText = renderCode128Svg('STR-123', { showText: false, barHeightMm: 12 });
    expect(svgWithoutText).not.toContain('<text');
    expect(svgWithoutText).toContain('height="12.00mm"');
  });

  it('menghasilkan dimensi SVG yang muat dalam kertas 58mm (max 48mm area cetak)', () => {
    // 58mm printer has 48mm printable area.
    // Receipt code 'STR-20261031-0001' has 17 chars:
    // (10 quiet + 11 start + 17*11 chars + 11 check + 13 stop + 10 quiet) = 242 modules.
    // 242 * 0.18mm = 43.56mm (muat sempurna di 48mm printable area!)
    const svg = renderCode128Svg('STR-20261031-0001', { moduleWidthMm: 0.18 });
    const match = svg.match(/width="([\d.]+)mm"/);
    expect(match).not.toBeNull();
    const widthMm = parseFloat(match![1]!);
    expect(widthMm).toBeLessThanOrEqual(48);
  });
});

