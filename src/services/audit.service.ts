import { SembakoDatabase, type AuditLog } from '@/data/db';

export interface AuditLogItem extends AuditLog {
  userName?: string;
}

export class AuditService {
  constructor(private db: SembakoDatabase) {}

  /**
   * Mengambil log audit append-only dengan filter aksi, pengguna, dan tanggal (FR-AUD-01..03, AC-34, AC-35).
   */
  async listAuditLogs(params?: {
    action?: string;
    userId?: string;
    limit?: number;
  }): Promise<AuditLogItem[]> {
    let query = this.db.audit_logs.orderBy('occurred_at').reverse();

    if (params?.action) {
      query = query.filter((log) => log.action === params.action);
    }
    if (params?.userId) {
      query = query.filter((log) => log.user_id === params.userId);
    }

    const logs = await query.limit(params?.limit || 100).toArray();

    // Map user names
    const users = await this.db.users.toArray();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return logs.map((log) => ({
      ...log,
      userName: userMap.get(log.user_id) || log.user_id,
    }));
  }
}
