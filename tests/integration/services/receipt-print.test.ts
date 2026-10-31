import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { SettingsService, DEFAULT_STORE_SETTINGS } from '@/services/settings.service';
import {
  buildReceiptLines,
  buildReceiptTestHtml,
  buildReceiptTestLines,
  RECEIPT_COLUMNS,
} from '@/services/receipt.service';

describe('Pengaturan struk & printer (RC-I01..I03, T6.02)', () => {
  let settings: SettingsService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    settings = new SettingsService(db);
  });

  it('bawaan: kertas 58mm dan batas retur dicantumkan', async () => {
    const s = await settings.getStoreSettings();
    expect(s.defaultPaperWidth).toBe('58mm');
    expect(s.showReturnPolicyOnReceipt).toBe(true);
  });

  it('data pengaturan lama tanpa field baru tetap terbaca dengan nilai bawaan', async () => {
    await db.app_settings.put({
      key: 'store_settings',
      value_json: JSON.stringify({ storeName: 'Warung Lama', storeAddress: 'Jl. A', storePhone: '1' }),
      updated_at: 1,
      updated_by: 'admin',
    });
    const s = await settings.getStoreSettings();
    expect(s.storeName).toBe('Warung Lama');
    expect(s.defaultPaperWidth).toBe('58mm');
    expect(s.returnDaysLimit).toBe(DEFAULT_STORE_SETTINGS.returnDaysLimit);
  });

  it('RC-I01: perubahan nama toko, footer, dan kertas tersimpan, tercatat audit, dan tampil di struk', async () => {
    await settings.updateStoreSettings(
      {
        storeName: 'Warung Maju',
        receiptFooter: 'Sampai jumpa lagi',
        defaultPaperWidth: '80mm',
        returnDaysLimit: 14,
      },
      'admin'
    );

    const s = await settings.getStoreSettings();
    expect(s.defaultPaperWidth).toBe('80mm');
    expect(await db.audit_logs.where('action').equals('settings.update').count()).toBe(1);

    const lines = buildReceiptLines({
      sale: { receipt_no: 'TRX-1', completed_at: 1, subtotal: 1000, discount_total: 0, total: 1000 },
      items: [],
      payment: null,
      cashierName: 'Budi',
      store: s,
      paperWidth: s.defaultPaperWidth,
    })
      .map((l) => l.text)
      .join('\n');

    expect(lines).toContain('WARUNG MAJU');
    expect(lines).toContain('Sampai jumpa lagi');
    expect(lines).toContain('14 hari');
  });

  it('lebar kertas di luar 58mm/80mm ditolak dan pengaturan lama tidak berubah', async () => {
    await settings.updateStoreSettings({ storeName: 'Awal' }, 'admin');
    await expect(
      // @ts-expect-error nilai sengaja tidak valid untuk menguji validasi runtime
      settings.updateStoreSettings({ defaultPaperWidth: '100mm' }, 'admin')
    ).rejects.toThrow('58mm atau 80mm');

    const s = await settings.getStoreSettings();
    expect(s.storeName).toBe('Awal');
    expect(s.defaultPaperWidth).toBe('58mm');
    expect(await db.audit_logs.count()).toBe(1);
  });

  it('struk uji: identitas toko asli, penggaris tepat selebar kolom, tanpa barang atau nominal rekaan', () => {
    const store = { storeName: 'Warung Maju', storeAddress: 'Jl. Melati 5', storePhone: '0812' };
    for (const pw of ['58mm', '80mm'] as const) {
      const lines = buildReceiptTestLines(store, pw).map((l) => l.text);
      const w = RECEIPT_COLUMNS[pw];
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(w);
      expect(lines).toContain('1234567890'.repeat(Math.ceil(w / 10)).slice(0, w));
      const joined = lines.join('\n');
      expect(joined).toContain('WARUNG MAJU');
      expect(joined).toContain('STRUK UJI COBA');
      expect(joined).not.toContain('Rp');
    }
    expect(buildReceiptTestHtml(store, '80mm')).toContain('size: 80mm auto');
  });
});

