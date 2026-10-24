import { SembakoDatabase, type CashierSession } from '@/data/db';
import { assertMoney } from '@/domain/money';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export interface OpenSessionParams {
  userId: string;
  openingCash: number; // Integer Rupiah
}

export interface CloseSessionParams {
  sessionId: string;
  closingCash: number; // Kas fisik aktual hasil hitung
  notes?: string;
  closedBy: string;
}

export interface CloseSessionResult {
  session: CashierSession;
  expectedCash: number;
  discrepancy: number; // closingCash - expectedCash
}

export class CashierSessionService {
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Mengambil sesi kasir yang sedang aktif / terbuka pada perangkat ini.
   * Pada MVP hanya ada 1 sesi terbuka dalam satu waktu (FR-AUTH-08).
   */
  async getActiveSession(): Promise<CashierSession | undefined> {
    return this.db.cashier_sessions.where('status').equals('open').first();
  }

  /**
   * Membuka sesi kasir baru dengan modal awal laci kas.
   */
  async openSession(params: OpenSessionParams): Promise<CashierSession> {
    const openingCash = assertMoney(params.openingCash);
    if (openingCash < 0) {
      throw new Error('Saldo modal awal tidak boleh negatif');
    }

    const existingActive = await this.getActiveSession();
    if (existingActive) {
      throw new Error(
        'Masih ada sesi kasir yang terbuka. Tutup sesi sebelumnya terlebih dahulu.'
      );
    }

    const sessionId = this.idGen.generateId();
    const now = this.clock.now();

    const newSession: CashierSession = {
      id: sessionId,
      user_id: params.userId,
      opening_cash: openingCash,
      status: 'open',
      opened_at: now,
    };

    await this.db.transaction('rw', [this.db.cashier_sessions, this.db.audit_logs], async () => {
      await this.db.cashier_sessions.add(newSession);
      await this.db.audit_logs.add({
        id: this.idGen.generateId(),
        occurred_at: now,
        user_id: params.userId,
        device_id: 'local_device',
        action: 'session.open',
        entity_type: 'cashier_session',
        entity_id: sessionId,
        reason: `Membuka sesi kasir dengan modal awal Rp ${openingCash.toLocaleString('id-ID')}`,
      });
    });

    return newSession;
  }

  /**
   * Menghitung kas yang diharapkan pada sesi kasir berjalan (BR-22).
   * expectedCash = opening_cash + sum(uang tunai diterima) - sum(refund tunai)
   */
  async calculateExpectedCash(sessionId: string): Promise<number> {
    const session = await this.db.cashier_sessions.get(sessionId);
    if (!session) {
      throw new Error(`Sesi kasir '${sessionId}' tidak ditemukan`);
    }

    // Ambil semua transaksi penjualan selesai dalam sesi ini
    const sales = await this.db.sales
      .where('session_id')
      .equals(sessionId)
      .and((s) => s.status === 'completed' || s.status === 'partially_returned')
      .toArray();

    const saleIds = sales.map((s) => s.id);

    // Ambil pembayaran tunai
    const cashPayments = await this.db.payments
      .where('sale_id')
      .anyOf(saleIds)
      .and((p) => p.method === 'cash')
      .toArray();

    const totalCashIn = cashPayments.reduce((sum, p) => sum + p.amount, 0);

    // Ambil refund tunai jika ada retur
    const returns = await this.db.returns.where('original_sale_id').anyOf(saleIds).toArray();
    const totalCashRefunds = returns.reduce((sum, r) => sum + r.total_refund, 0);

    return session.opening_cash + totalCashIn - totalCashRefunds;
  }

  /**
   * Menutup sesi kasir dengan menghitung selisih kas fisik vs diharapkan.
   * Catatan wajib diisi jika ada selisih kas (FR-AUTH-07, AC-32).
   */
  async closeSession(params: CloseSessionParams): Promise<CloseSessionResult> {
    const closingCash = assertMoney(params.closingCash);
    if (closingCash < 0) {
      throw new Error('Kas fisik penutupan tidak boleh negatif');
    }

    const session = await this.db.cashier_sessions.get(params.sessionId);
    if (!session) {
      throw new Error('Sesi kasir tidak ditemukan');
    }

    if (session.status !== 'open') {
      throw new Error('Sesi kasir sudah ditutup');
    }

    const expectedCash = await this.calculateExpectedCash(params.sessionId);
    const discrepancy = closingCash - expectedCash;

    // FR-AUTH-07 & AC-32: Jika selisih tidak nol, catatan wajib diisi
    if (discrepancy !== 0 && (!params.notes || params.notes.trim().length === 0)) {
      throw new Error(
        `Terdapat selisih kas sebesar Rp ${discrepancy.toLocaleString(
          'id-ID'
        )}. Catatan/alasan selisih wajib diisi.`
      );
    }

    const now = this.clock.now();

    const updatedSession: CashierSession = {
      ...session,
      closing_cash: closingCash,
      discrepancy,
      notes: params.notes?.trim(),
      status: 'closed',
      closed_at: now,
    };

    await this.db.transaction('rw', [this.db.cashier_sessions, this.db.audit_logs], async () => {
      await this.db.cashier_sessions.put(updatedSession);
      await this.db.audit_logs.add({
        id: this.idGen.generateId(),
        occurred_at: now,
        user_id: params.closedBy,
        device_id: 'local_device',
        action: 'session.close',
        entity_type: 'cashier_session',
        entity_id: params.sessionId,
        reason: `Tutup sesi kasir. Aktual: Rp ${closingCash.toLocaleString(
          'id-ID'
        )}, Diharapkan: Rp ${expectedCash.toLocaleString(
          'id-ID'
        )}, Selisih: Rp ${discrepancy.toLocaleString('id-ID')}`,
      });
    });

    return {
      session: updatedSession,
      expectedCash,
      discrepancy,
    };
  }
}
