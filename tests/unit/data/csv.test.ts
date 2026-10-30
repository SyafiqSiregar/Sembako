import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  sanitizeBarcodeCell,
  parseCatalogImportText,
  generateCsvTemplateText,
  generateExcelTemplateHtml,
  generateTsvSampleText,
} from '@/lib/csv';

describe('CSV & Excel Template Parser (FR-CAT-10)', () => {
  it('membaca kembali Template CSV (titik koma ;) dan melewati baris judul serta petunjuk secara otomatis', () => {
    const csvText = generateCsvTemplateText();
    // Pastikan tanggal dibungkus ="2027-01-15" agar tidak menjadi ######## di Excel
    expect(csvText).toContain('="2027-01-15"');
    expect(csvText).toContain('="089686010018"');
    expect(csvText).toContain('Nama Brg*;Kategori;Satuan*;Modal (Rp)*;Jual (Rp)*');

    const parsed = parseCatalogImportText(csvText);

    expect(parsed.length).toBe(3);
    expect(parsed.every((r) => r.isValid)).toBe(true);

    // Pastikan angka 0 di depan barcode tidak hilang dan data grosir terbaca
    expect(parsed[0]?.name).toBe('Indomie Goreng Spesial 85g');
    expect(parsed[0]?.barcode).toBe('089686010018');
    expect(parsed[0]?.hasWholesale).toBe(true);
    expect(parsed[0]?.wholesaleUnitName).toBe('Dus');
    expect(parsed[0]?.wholesaleFactor).toBe(40);
    expect(parsed[0]?.wholesalePrice).toBe(130000);
    expect(parsed[0]?.wholesaleBarcode).toBe('089686010025');
    expect(parsed[0]?.initialStock).toBe(120);
    expect(parsed[0]?.initialExpiryDate).toBe('2027-01-15');

    // Pastikan barang eceran tanpa grosir terbaca valid
    expect(parsed[2]?.name).toBe('Beras Rojo Lele 5kg');
    expect(parsed[2]?.hasWholesale).toBe(false);
    expect(parsed[2]?.trackExpiry).toBe(false);
  });

  it('membaca kembali Template Excel (.xls HTML Table) secara langsung tanpa perlu konversi manual', () => {
    const xlsHtml = generateExcelTemplateHtml();
    expect(xlsHtml).toContain("mso-number-format:'\\@'");
    expect(xlsHtml).toContain('A. IDENTITAS BARANG');

    const parsed = parseCatalogImportText(xlsHtml);
    expect(parsed.length).toBe(3);
    expect(parsed.every((r) => r.isValid)).toBe(true);
    expect(parsed[0]?.barcode).toBe('089686010018');
    expect(parsed[1]?.barcode).toBe('8992223334445');
  });

  it('mendukung hasil Copy-Paste langsung dari blok sel Microsoft Excel (pemisah Tab / TSV)', () => {
    const tsvText = generateTsvSampleText();
    const rawRows = parseCsv(tsvText);
    expect(rawRows.length).toBe(4); // 1 header + 3 data

    const parsed = parseCatalogImportText(tsvText);
    expect(parsed.length).toBe(3);
    expect(parsed.every((r) => r.isValid)).toBe(true);
  });

  it('membersihkan pembungkus teks barcode Excel (="089..." dan kutip tunggal) serta mendeteksi notasi ilmiah E+', () => {
    expect(sanitizeBarcodeCell('="089686010018"')).toBe('089686010018');
    expect(sanitizeBarcodeCell("'089686010018")).toBe('089686010018');

    const badScientificCsv = [
      'Nama Barang *;Kategori;Satuan Eceran *;Harga Modal Eceran (Rp) *;Harga Jual Eceran (Rp) *;Barcode Eceran',
      'Kopi Kapal Api;Minuman;Sachet;1200;1500;8,99222E+12',
    ].join('\n');

    const parsed = parseCatalogImportText(badScientificCsv);
    expect(parsed.length).toBe(1);
    expect(parsed[0]?.isValid).toBe(false);
    expect(parsed[0]?.errorReason).toContain('notasi E+');
  });

  it('memvalidasi kelengkapan grosir, harga modal > harga jual, tanggal kedaluwarsa, dan duplikasi barcode', () => {
    const rows = [
      'Nama Barang *;Kategori;Satuan Eceran *;Harga Modal Eceran (Rp) *;Harga Jual Eceran (Rp) *;Barcode Eceran;Satuan Grosir;Isi per Grosir;Harga Jual Grosir (Rp);Barcode Grosir;Batas Stok Tipis;Lacak Kedaluwarsa?;Stok Awal (Eceran);Tanggal Kedaluwarsa',
      // 1. Harga jual < modal
      'Barang Rugi;Umum;Pcs;10000;8000;8990001;;;;;5;Tidak;0;',
      // 2. Grosir tidak lengkap (isi dus kosong)
      'Barang Grosir Setengah;Umum;Pcs;3000;3500;8990002;Dus;;120000;;5;Tidak;0;',
      // 3. Lacak kedaluwarsa = Ya & Stok Awal > 0 tapi tanggal kosong
      'Susu UHT;Susu;Kotak;5000;6500;8990003;;;;;5;Ya;10;',
      // 4. Valid
      'Teh Botol;Minuman;Botol;3000;4000;8990004;;;;;5;Tidak;10;',
      // 5. Duplikat barcode dengan baris 4
      'Teh Kotak;Minuman;Kotak;3000;4000;8990004;;;;;5;Tidak;10;',
    ].join('\n');

    const parsed = parseCatalogImportText(rows);
    expect(parsed.length).toBe(5);
    expect(parsed[0]?.isValid).toBe(false);
    expect(parsed[0]?.errorReason).toContain('lebih rendah dari modal');

    expect(parsed[1]?.isValid).toBe(false);
    expect(parsed[1]?.errorReason).toContain('grosir belum lengkap');

    expect(parsed[2]?.isValid).toBe(false);
    expect(parsed[2]?.errorReason).toContain('Tanggal kedaluwarsa wajib');

    expect(parsed[3]?.isValid).toBe(true);

    expect(parsed[4]?.isValid).toBe(false);
    expect(parsed[4]?.errorReason).toContain('ganda');
  });
});

