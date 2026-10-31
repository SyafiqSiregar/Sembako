import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { SettingsService } from '@/services/settings.service';
import { AuditService } from '@/services/audit.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('SettingsService & AuditService (FR-SET-01..04, FR-AUD-01..03, AC-34..36)', () => {
  let settingsService: SettingsService;
  let auditService: AuditService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    clock = new FixedClock(new Date('2026-10-25T16:00:00Z').getTime());
    idGen = new SequenceIdGenerator('test_set_');

    settingsService = new SettingsService(db, clock, idGen);
    auditService = new AuditService(db);
  });

  it('dapat memperbarui identitas toko dan kebijakan operasional (FR-SET-01..03, AC-36)', async () => {
    const initial = await settingsService.getStoreSettings();
    expect(initial.storeName).toBe('Toko Sembako Berkah');

    await settingsService.updateStoreSettings(
      {
        storeName: 'Sembako Berkah Mandiri',
        receiptFooter: 'Semoga berkah belanja di toko kami!',
        maxDiscountPercent: 10,
      },
      'usr_owner'
    );

    const updated = await settingsService.getStoreSettings();
    expect(updated.storeName).toBe('Sembako Berkah Mandiri');
    expect(updated.maxDiscountPercent).toBe(10);
    expect(updated.receiptFooter).toBe('Semoga berkah belanja di toko kami!');

    // Cek audit log
    const auditLogs = await auditService.listAuditLogs({ action: 'settings.update' });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.user_id).toBe('usr_owner');
  });

  it('dapat membuat staf pengguna baru dengan PIN terenkripsi PBKDF2 (FR-SET-04, AC-36)', async () => {
    const user = await settingsService.createUser({
      name: 'Budi Santoso',
      pin: '123456',
      roleCode: 'cashier',
      actorId: 'usr_owner',
    });

    expect(user.name).toBe('Budi Santoso');
    expect(user.roleCode).toBe('cashier');

    // Cek di database
    const dbUser = await db.users.get(user.id);
    expect(dbUser).toBeDefined();
    expect(dbUser?.pin_hash).toBeDefined();
    expect(dbUser?.pin_hash).not.toBe('123456'); // Wajib ter-hash
    expect(dbUser?.pin_kdf).toBe('pbkdf2');
  });

  it('dapat mereset PIN dan menonaktifkan pengguna (FR-SET-04)', async () => {
    const user = await settingsService.createUser({
      name: 'Dewi Kasir',
      pin: '111111',
      roleCode: 'cashier',
      actorId: 'usr_owner',
    });

    // Reset PIN
    await settingsService.resetUserPin(user.id, '999999', 'usr_owner');
    const userAfterReset = await db.users.get(user.id);
    expect(userAfterReset?.pin_hash).toBeDefined();

    // Toggle status (nonaktifkan)
    const newStatus = await settingsService.toggleUserStatus(user.id, 'usr_owner');
    expect(newStatus).toBe('disabled');

    const userDisabled = await db.users.get(user.id);
    expect(userDisabled?.status).toBe('disabled');

    // Cek jejak audit
    const resetLogs = await auditService.listAuditLogs({ action: 'user.reset_pin' });
    expect(resetLogs.length).toBe(1);
  });

  it('menolak perubahan pengaturan toko dan manajemen user bila dilakukan oleh Kasir (AC-13, OQ-L09)', async () => {
    const cashier = await settingsService.createUser({
      name: 'Supri Kasir',
      pin: '123456',
      roleCode: 'cashier',
      actorId: 'usr_owner',
    });

    await expect(
      settingsService.updateStoreSettings({ storeName: 'Toko Dibajak' }, cashier.id)
    ).rejects.toThrow("Akses ditolak: Supri Kasir tidak memiliki hak akses untuk 'settings.manage'");

    await expect(
      settingsService.createUser({
        name: 'Akun Gelap',
        pin: '654321',
        roleCode: 'owner',
        actorId: cashier.id,
      })
    ).rejects.toThrow("Akses ditolak: Supri Kasir tidak memiliki hak akses untuk 'users.manage'");

    await expect(
      settingsService.resetUserPin(cashier.id, '000000', cashier.id)
    ).rejects.toThrow("Akses ditolak: Supri Kasir tidak memiliki hak akses untuk 'users.manage'");

    await expect(
      settingsService.toggleUserStatus(cashier.id, cashier.id)
    ).rejects.toThrow("Akses ditolak: Supri Kasir tidak memiliki hak akses untuk 'users.manage'");
  });
});
