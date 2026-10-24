import { SembakoDatabase, type BackupHistory } from '@/data/db';
import { Clock, defaultClock, IdGenerator, defaultIdGenerator } from '@/domain/time';

export interface BackupManifest {
  app: 'SembakoOS';
  app_version: string;
  schema_version: number;
  created_at: number;
  created_by: string;
  table_counts: Record<string, number>;
  checksum_sha256: string;
}

export interface BackupPayload {
  manifest: BackupManifest;
  data: Record<string, unknown[]>;
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  manifest?: BackupManifest;
  data?: Record<string, unknown[]>;
}

export class BackupService {
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Menghitung SHA-256 checksum dari string menggunakan Web Crypto API (FR-BKP-01, AC-32).
   */
  async computeSha256(content: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback sederhana jika crypto.subtle tidak tersedia
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Membuat file backup JSON terverifikasi dengan manifest & SHA-256 checksum (FR-BKP-01, AC-32).
   */
  async exportBackup(userId: string): Promise<{
    fileName: string;
    jsonContent: string;
    checksum: string;
    sizeBytes: number;
  }> {
    const tableNames = this.db.tables.map((t) => t.name).filter((name) => name !== 'backup_history');
    const backupData: Record<string, unknown[]> = {};
    const tableCounts: Record<string, number> = {};

    for (const name of tableNames) {
      const table = this.db.table(name);
      const records = await table.toArray();
      backupData[name] = records;
      tableCounts[name] = records.length;
    }

    const dataString = JSON.stringify(backupData);
    const checksum = await this.computeSha256(dataString);
    const now = this.clock.now();

    const manifest: BackupManifest = {
      app: 'SembakoOS',
      app_version: '1.0.0',
      schema_version: 1,
      created_at: now,
      created_by: userId,
      table_counts: tableCounts,
      checksum_sha256: checksum,
    };

    const fullPayload: BackupPayload = {
      manifest,
      data: backupData,
    };

    const jsonContent = JSON.stringify(fullPayload, null, 2);
    const dateStr = this.clock.todayDateString().replace(/-/g, '');
    const timeStr = new Date(now).toTimeString().split(' ')[0]!.replace(/:/g, '');
    const fileName = `sembako-backup-${dateStr}-${timeStr}.json`;
    const sizeBytes = new Blob([jsonContent]).size;

    // Catat ke riwayat backup (FR-BKP-01)
    await this.db.backup_history.add({
      id: this.idGen.generateId(),
      file_name: fileName,
      created_at: now,
      status: 'success',
      checksum_sha256: checksum,
      size_bytes: sizeBytes,
      schema_version: 1,
      app_version: '1.0.0',
    });

    return {
      fileName,
      jsonContent,
      checksum,
      sizeBytes,
    };
  }

  /**
   * Memvalidasi berkas backup sebelum dilakukan restore (FR-BKP-03, AC-33).
   */
  async validateBackup(fileContent: string): Promise<BackupValidationResult> {
    try {
      const parsed: BackupPayload = JSON.parse(fileContent);

      if (!parsed.manifest || !parsed.data) {
        return {
          valid: false,
          error: 'Struktur berkas backup tidak valid (manifest atau data tidak ditemukan)',
        };
      }

      if (parsed.manifest.app !== 'SembakoOS') {
        return {
          valid: false,
          error: 'Berkas backup bukan berasal dari aplikasi SembakoOS',
        };
      }

      if (parsed.manifest.schema_version !== 1) {
        return {
          valid: false,
          error: `Versi skema tidak cocok (Skema file: ${parsed.manifest.schema_version}, Didukung: 1)`,
        };
      }

      // Verifikasi checksum SHA-256 data payload (AC-33)
      const dataString = JSON.stringify(parsed.data);
      const computedChecksum = await this.computeSha256(dataString);

      if (computedChecksum !== parsed.manifest.checksum_sha256) {
        return {
          valid: false,
          error: 'Checksum SHA-256 tidak cocok! Berkas backup kemungkinan rusak atau telah diubah.',
        };
      }

      return {
        valid: true,
        manifest: parsed.manifest,
        data: parsed.data,
      };
    } catch {
      return {
        valid: false,
        error: 'Gagal membaca format JSON pada berkas backup',
      };
    }
  }

  /**
   * Menjalankan Restore Database secara atomik dan mencatat audit log (FR-BKP-03, FR-BKP-04, AC-33).
   */
  async restoreBackup(
    fileContent: string,
    userId: string
  ): Promise<{ restoredCounts: Record<string, number> }> {
    const validation = await this.validateBackup(fileContent);
    if (!validation.valid || !validation.data || !validation.manifest) {
      throw new Error(validation.error || 'Validasi backup gagal');
    }

    const data = validation.data;
    const tableNames = Object.keys(data);
    const restoredCounts: Record<string, number> = {};

    // Restore atomik seluruh tabel Dexie
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const name of tableNames) {
        if (name === 'backup_history') continue;
        const table = this.db.table(name);
        const rows = data[name];

        if (Array.isArray(rows)) {
          await table.clear();
          if (rows.length > 0) {
            await table.bulkAdd(rows);
          }
          restoredCounts[name] = rows.length;
        }
      }

      // Catat audit log pemulihan data (FR-BKP-04)
      await this.db.audit_logs.add({
        id: this.idGen.generateId(),
        occurred_at: this.clock.now(),
        user_id: userId,
        device_id: 'TABLET1',
        action: 'system.restore',
        entity_type: 'database',
        entity_id: 'indexeddb_sembako_os',
        before_json: JSON.stringify({ action: 'full_restore_initiated' }),
        after_json: JSON.stringify({
          checksum: validation.manifest?.checksum_sha256,
          restored_tables: Object.keys(restoredCounts).length,
        }),
        reason: 'Restore database dari berkas backup JSON terverifikasi',
      });
    });

    return { restoredCounts };
  }

  /**
   * Mengambil riwayat aktivitas backup database (FR-BKP-01).
   */
  async listBackupHistory(): Promise<BackupHistory[]> {
    return this.db.backup_history.orderBy('created_at').reverse().toArray();
  }
}
