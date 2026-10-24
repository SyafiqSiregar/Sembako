/**
 * Domain Time & Identity — Waktu dan Generator ID SembakoOS
 * 
 * Aturan (AGENTS.md §4.1, DATABASE.md §1.1):
 * - Waktu kejadian disimpan sebagai epoch milidetik UTC (number).
 * - Tanggal kalender (expiry, receipt) disimpan sebagai string 'YYYY-MM-DD'.
 * - Domain tidak memanggil Date.now() atau crypto.randomUUID() langsung.
 * - Menggunakan dependency injection (Clock & IdGenerator).
 */

export interface Clock {
  now(): number; // Epoch ms UTC
  todayDateString(): string; // YYYY-MM-DD dalam zona waktu toko
}

export class SystemClock implements Clock {
  constructor(private timeZone: string = 'Asia/Jakarta') {}

  now(): number {
    return Date.now();
  }

  todayDateString(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }
}

export interface IdGenerator {
  generateId(): string;
}

/**
 * UUID Generator sederhana dan tahan bentrok.
 */
export class SystemIdGenerator implements IdGenerator {
  generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback timestamp + random
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export class FixedClock implements Clock {
  private dateStr: string;

  constructor(private epochMs: number = 1700000000000, dateStr?: string) {
    if (dateStr) {
      this.dateStr = dateStr;
    } else {
      const d = new Date(epochMs);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      this.dateStr = `${year}-${month}-${day}`;
    }
  }

  now(): number {
    return this.epochMs;
  }

  todayDateString(): string {
    return this.dateStr;
  }

  advance(ms: number): void {
    this.epochMs += ms;
  }
}

export class SequenceIdGenerator implements IdGenerator {
  private counter = 0;
  constructor(private prefix = 'id') {}

  generateId(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}

export const defaultClock = new SystemClock();
export const defaultIdGenerator = new SystemIdGenerator();

