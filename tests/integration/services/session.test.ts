import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { CashierSessionService } from '@/services/session.service';

describe('Service: CashierSessionService (FR-AUTH-05..08, AC-32)', () => {
  let db: SembakoDatabase;
  let sessionService: CashierSessionService;

  beforeEach(async () => {
    db = new SembakoDatabase(`session_test_${Date.now()}_${Math.random()}`);
    await db.open();
    sessionService = new CashierSessionService(db);
  });

  it('membuka sesi kasir baru dengan modal awal (FR-AUTH-06)', async () => {
    const session = await sessionService.openSession({
      userId: 'user-1',
      openingCash: 100_000,
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('open');
    expect(session.opening_cash).toBe(100_000);

    const active = await sessionService.getActiveSession();
    expect(active?.id).toBe(session.id);
  });

  it('menolak membuka sesi kedua jika masih ada sesi yang terbuka (FR-AUTH-08)', async () => {
    await sessionService.openSession({
      userId: 'user-1',
      openingCash: 50_000,
    });

    await expect(
      sessionService.openSession({
        userId: 'user-2',
        openingCash: 50_000,
      })
    ).rejects.toThrow('Masih ada sesi kasir yang terbuka');
  });

  it('rekonsiliasi kas: selisih kas wajib mengisi catatan (AC-32)', async () => {
    // Given: Sesi kas dibuka dengan saldo awal Rp100.000
    const session = await sessionService.openSession({
      userId: 'user-1',
      openingCash: 100_000,
    });

    // Simulasi penjualan tunai bersih Rp450.000
    const saleId = 'sale-1';
    await db.sales.add({
      id: saleId,
      receipt_no: 'TRX-001',
      session_id: session.id,
      cashier_id: 'user-1',
      status: 'completed',
      subtotal: 450_000,
      discount_total: 0,
      tax_total: 0,
      rounding_adjustment: 0,
      total: 450_000,
      completed_at: Date.now(),
      created_at: Date.now(),
      created_by: 'user-1',
      updated_at: Date.now(),
      updated_by: 'user-1',
      row_version: 1,
    });

    await db.payments.add({
      id: 'pay-1',
      sale_id: saleId,
      method: 'cash',
      amount: 450_000,
      paid_at: Date.now(),
    });

    // Expected cash: 100.000 + 450.000 = 550.000
    const expected = await sessionService.calculateExpectedCash(session.id);
    expect(expected).toBe(550_000);

    // Kasir menutup dengan kas aktual Rp540.000 (Selisih -10.000) TANPA catatan -> ditolak
    await expect(
      sessionService.closeSession({
        sessionId: session.id,
        closingCash: 540_000,
        closedBy: 'user-1',
      })
    ).rejects.toThrow('Catatan/alasan selisih wajib diisi');

    // Menutup DENGAN catatan -> berhasil
    const result = await sessionService.closeSession({
      sessionId: session.id,
      closingCash: 540_000,
      notes: 'Kembalian lebih Rp10.000 karena kasir salah hitung uang kembalian beras',
      closedBy: 'user-1',
    });

    expect(result.expectedCash).toBe(550_000);
    expect(result.discrepancy).toBe(-10_000);
    expect(result.session.status).toBe('closed');
    expect(result.session.notes).toContain('Kembalian lebih');

    // Sesi aktif sekarang kosong
    const active = await sessionService.getActiveSession();
    expect(active).toBeUndefined();

    // Audit log tersimpan
    const audit = await db.audit_logs.where('action').equals('session.close').first();
    expect(audit).toBeDefined();
    expect(audit?.reason).toContain('Selisih: Rp -10.000');
  });
});
