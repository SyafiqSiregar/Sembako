import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { BackupService } from '@/services/backup.service';
import { FixedClock, SequenceIdGenerator } from '@/domain/time';

describe('BackupService (FR-BKP-01..04, AC-32, AC-33)', () => {
  let backupService: BackupService;
  let clock: FixedClock;
  let idGen: SequenceIdGenerator;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    clock = new FixedClock(new Date('2026-10-25T15:00:00Z').getTime());
    idGen = new SequenceIdGenerator('test_bkp_');

    backupService = new BackupService(db, clock, idGen);

    // Seed test category & product
    await db.categories.add({
      id: 'cat_test',
      name: 'Kategori Uji',
      active: 1,
      created_at: clock.now(),
      created_by: 'admin',
      updated_at: clock.now(),
      updated_by: 'admin',
      row_version: 1,
    });

    await db.products.add({
      id: 'prod_test',
      name: 'Produk Uji Backup',
      category_id: 'cat_test',
      base_unit_kind: 'count',
      base_unit_code: 'pcs',
      min_stock_base: 5,
      track_expiry: 0,
      active: 1,
      created_at: clock.now(),
      created_by: 'admin',
      updated_at: clock.now(),
      updated_by: 'admin',
      row_version: 1,
    });
  });

  it('membuat berkas backup dengan manifest dan checksum SHA-256 yang valid (FR-BKP-01, AC-32)', async () => {
    const backupRes = await backupService.exportBackup('usr_owner');

    expect(backupRes.fileName).toMatch(/^sembako-backup-\d{8}-\d{6}\.json$/);
    expect(backupRes.checksum).toBeDefined();
    expect(backupRes.sizeBytes).toBeGreaterThan(0);

    // Parse payload
    const parsed = JSON.parse(backupRes.jsonContent);
    expect(parsed.manifest.app).toBe('SembakoOS');
    expect(parsed.manifest.schema_version).toBe(1);
    expect(parsed.manifest.checksum_sha256).toBe(backupRes.checksum);
    expect(parsed.manifest.table_counts.products).toBe(1);

    // Pastikan tercatat di riwayat backup
    const history = await backupService.listBackupHistory();
    expect(history.length).toBe(1);
    expect(history[0]?.status).toBe('success');
  });

  it('memvalidasi integritas berkas backup dan menolak berkas yang korup (FR-BKP-03, AC-33)', async () => {
    const backupRes = await backupService.exportBackup('usr_owner');

    // 1. Validasi berkas asli -> harus valid
    const validCheck = await backupService.validateBackup(backupRes.jsonContent);
    expect(validCheck.valid).toBe(true);

    // 2. Modifikasi isi data (korupsi) -> harus ditolak karena checksum tidak cocok
    const corruptPayload = JSON.parse(backupRes.jsonContent);
    corruptPayload.data.products.push({ id: 'injected_item' });

    const corruptCheck = await backupService.validateBackup(JSON.stringify(corruptPayload));
    expect(corruptCheck.valid).toBe(false);
    expect(corruptCheck.error).toMatch(/Checksum SHA-256 tidak cocok/);
  });

  it('merestore database secara atomik dan mencatat audit log (FR-BKP-03, FR-BKP-04, AC-33)', async () => {
    const backupRes = await backupService.exportBackup('usr_owner');

    // Hapus data yang ada di database saat ini
    await db.products.clear();
    const countBefore = await db.products.count();
    expect(countBefore).toBe(0);

    // Jalankan restore
    const restoreRes = await backupService.restoreBackup(backupRes.jsonContent, 'usr_owner');
    expect(restoreRes.restoredCounts.products).toBe(1);

    // Periksa bahwa data berhasil dipulihkan
    const restoredProd = await db.products.get('prod_test');
    expect(restoredProd).toBeDefined();
    expect(restoredProd?.name).toBe('Produk Uji Backup');

    // Periksa bahwa audit log system.restore dicatat
    const restoreAudit = await db.audit_logs.where('action').equals('system.restore').first();
    expect(restoreAudit).toBeDefined();
    expect(restoreAudit?.entity_type).toBe('database');
  });
});
