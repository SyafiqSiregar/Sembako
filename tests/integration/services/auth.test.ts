import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';
import { AuthService, MAX_FAILED_ATTEMPTS } from '@/services/auth.service';
import { type Clock } from '@/domain/time';

class MockClock implements Clock {
  currentTime = 1700000000000;

  now(): number {
    return this.currentTime;
  }

  todayDateString(): string {
    return '2026-10-24';
  }

  advance(ms: number) {
    this.currentTime += ms;
  }
}

describe('Service: AuthService & Lockout (FR-AUTH-01..03, AC-31)', () => {
  let db: SembakoDatabase;
  let authService: AuthService;
  let clock: MockClock;

  beforeEach(async () => {
    db = new SembakoDatabase(`auth_test_${Date.now()}_${Math.random()}`);
    await db.open();
    clock = new MockClock();
    authService = new AuthService(db, clock);
  });

  it('membuat pengguna baru dan menyimpan hash + salt (bukan PIN asli)', async () => {
    const user = await authService.createUser({
      name: 'Kasir Siti',
      pin: '123456',
      roleCode: 'cashier',
      createdBy: 'system',
    });

    expect(user.id).toBeDefined();
    expect(user.name).toBe('Kasir Siti');
    expect(user.pin_hash).toBeDefined();
    expect(user.pin_hash).not.toBe('123456'); // Tidak menyimpan PIN mentah
    expect(user.pin_salt).toBeDefined();

    const sessionData = await authService.getUserSessionData(user.id);
    expect(sessionData.roleCodes).toContain('cashier');
  });

  it('mengizinkan login dengan PIN yang benar', async () => {
    const user = await authService.createUser({
      name: 'Supervisor Joko',
      pin: '654321',
      roleCode: 'supervisor',
      createdBy: 'system',
    });

    const result = await authService.verifyLogin(user.id, '654321');
    expect(result.user.name).toBe('Supervisor Joko');
    expect(result.roleCodes).toContain('supervisor');

    // Cek failed attempts 0
    const updatedUser = await db.users.get(user.id);
    expect(updatedUser?.failed_attempts).toBe(0);
  });

  it('mengunci akun setelah salah PIN 5x berturut-turut dan mencatat audit log (AC-31)', async () => {
    const user = await authService.createUser({
      name: 'Kasir Budi',
      pin: '112233',
      roleCode: 'cashier',
      createdBy: 'system',
    });

    // 4 kali salah
    for (let i = 1; i <= 4; i++) {
      await expect(authService.verifyLogin(user.id, '999999')).rejects.toThrow(
        `Sisa kesempatan sebelum akun terkunci: ${MAX_FAILED_ATTEMPTS - i} kali`
      );
    }

    // Ke-5 kali salah -> terkunci
    await expect(authService.verifyLogin(user.id, '999999')).rejects.toThrow(
      'Akun Anda dikunci sementara selama 5 menit'
    );

    const lockedUser = await db.users.get(user.id);
    expect(lockedUser?.failed_attempts).toBe(5);
    expect(lockedUser?.locked_until).toBe(clock.currentTime + 5 * 60 * 1000);

    // Cek audit log
    const auditLogs = await db.audit_logs.where('action').equals('auth.lockout').toArray();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]?.entity_id).toBe(user.id);

    // Percobaan ke-6 (bahkan dengan PIN benar) tetap ditolak selama masih dalam durasi kunci
    await expect(authService.verifyLogin(user.id, '112233')).rejects.toThrow(
      'Akun terkunci sementara karena salah PIN 5 kali'
    );

    // Majukan waktu 5 menit 1 detik
    clock.advance(5 * 60 * 1000 + 1000);

    // Setelah masa kunci lewat, login dengan PIN benar berhasil dan me-reset kunci
    const successResult = await authService.verifyLogin(user.id, '112233');
    expect(successResult.user.id).toBe(user.id);

    const resetUser = await db.users.get(user.id);
    expect(resetUser?.failed_attempts).toBe(0);
    expect(resetUser?.locked_until).toBeUndefined();
  });

  it('mengambil daftar pengguna aktif dan mengecualikan akun dinonaktifkan (FR-AUTH-01)', async () => {
    await authService.createUser({
      name: 'Kasir Syafiq',
      pin: '123456',
      roleCode: 'cashier',
      createdBy: 'system',
    });

    await authService.createUser({
      name: 'Budi (Owner)',
      pin: '654321',
      roleCode: 'owner',
      createdBy: 'system',
    });

    const userDisabled = await authService.createUser({
      name: 'Mantan Karyawan',
      pin: '999999',
      roleCode: 'stock_clerk',
      createdBy: 'system',
    });

    // Nonaktifkan userDisabled
    await db.users.update(userDisabled.id, { status: 'disabled' });

    const activeUsers = await authService.listActiveUsers();
    expect(activeUsers.length).toBe(2);

    const names = activeUsers.map((u) => u.name);
    expect(names).toContain('Kasir Syafiq');
    expect(names).toContain('Budi (Owner)');
    expect(names).not.toContain('Mantan Karyawan');

    const syafiq = activeUsers.find((u) => u.name === 'Kasir Syafiq');
    expect(syafiq?.roleCode).toBe('cashier');
    expect(syafiq?.roleName).toBe('Kasir');

    const budi = activeUsers.find((u) => u.name === 'Budi (Owner)');
    expect(budi?.roleCode).toBe('owner');
    expect(budi?.roleName).toBe('Pemilik Toko');
  });

  it('beralih akun/peran dari kasir ke owner dan memperbarui sesi otentikasi (FR-AUTH-01)', async () => {
    const kasir = await authService.createUser({
      name: 'Kasir Syafiq',
      pin: '123456',
      roleCode: 'cashier',
      createdBy: 'system',
    });

    const owner = await authService.createUser({
      name: 'Budi (Owner)',
      pin: '654321',
      roleCode: 'owner',
      createdBy: 'system',
    });

    // 1. Syafiq login sebagai kasir
    const sessionKasir = await authService.verifyLogin(kasir.id, '123456');
    expect(sessionKasir.user.id).toBe(kasir.id);
    expect(sessionKasir.roleCodes).toEqual(['cashier']);

    // 2. Beralih login ke Owner Budi
    const sessionOwner = await authService.verifyLogin(owner.id, '654321');
    expect(sessionOwner.user.id).toBe(owner.id);
    expect(sessionOwner.roleCodes).toEqual(['owner']);
    expect(sessionOwner.user.name).toBe('Budi (Owner)');
  });
});
