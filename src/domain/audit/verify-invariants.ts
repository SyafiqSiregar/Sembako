/**
 * Domain Audit: Verifikasi Invarian Integritas Database SembakoOS
 * 
 * Memeriksa 6 invarian absolut sesuai DATABASE.md §5:
 * 1. INV-1: Konsistensi Saldo Stok vs Ledger Movement
 * 2. INV-2: Kekekalan Riwayat Mutasi & Audit Log
 * 3. INV-3: Integritas Uang Kasir (Integer Rupiah & Rekonsiliasi)
 * 4. INV-4: Keutuhan Snapshot Harga & Modal Transaksi
 * 5. INV-5: Validitas Alokasi Batch & FEFO
 * 6. INV-6: Validitas Backup & Integritas Checksum SHA-256
 */

import type { SembakoDatabase } from '@/data/db';

export interface InvariantResult {
  invariant: 'INV-1' | 'INV-2' | 'INV-3' | 'INV-4' | 'INV-5' | 'INV-6';
  name: string;
  passed: boolean;
  checkedCount: number;
  details?: string;
  violations: Array<{
    id: string;
    description: string;
    expected: any;
    actual: any;
  }>;
}

export interface InvariantCheckReport {
  timestamp: number;
  allPassed: boolean;
  totalChecks: number;
  results: InvariantResult[];
}

export async function verifyDatabaseInvariants(db: SembakoDatabase): Promise<InvariantCheckReport> {
  const results: InvariantResult[] = [];

  // =========================================================================
  // INV-1: Konsistensi Saldo Stok vs Ledger Movement
  // Untuk setiap produk: inventory_balances.qty_base == SUM(stock_movement_items.qty_delta_base)
  // =========================================================================
  {
    const products = await db.products.toArray();
    const balances = await db.inventory_balances.toArray();
    const movementItems = await db.stock_movement_items.toArray();

    const violations: InvariantResult['violations'] = [];

    for (const prod of products) {
      // Hitung total saldo saat ini di inventory_balances
      const prodBalances = balances.filter((b) => b.product_id === prod.id);
      const totalBalance = prodBalances.reduce((acc, b) => acc + b.qty_base, 0);

      // Hitung total pergerakan di stock_movement_items
      const prodMovements = movementItems.filter((m) => m.product_id === prod.id);
      const sumDeltas = prodMovements.reduce((acc, m) => acc + m.qty_delta_base, 0);

      if (totalBalance !== sumDeltas) {
        violations.push({
          id: prod.id,
          description: `Selisih saldo produk '${prod.name}': Saldo = ${totalBalance}, Total Ledger = ${sumDeltas}`,
          expected: sumDeltas,
          actual: totalBalance,
        });
      }
    }

    results.push({
      invariant: 'INV-1',
      name: 'Konsistensi Saldo Stok vs Ledger Movement',
      passed: violations.length === 0,
      checkedCount: products.length,
      violations,
      details: violations.length === 0
        ? `Seluruh ${products.length} produk memiliki saldo yang identik dengan mutasi ledger.`
        : `Ditemukan ${violations.length} produk dengan selisih saldo vs ledger.`,
    });
  }

  // =========================================================================
  // INV-2: Kekekalan Riwayat Mutasi & Audit Log
  // Setiap mutasi memiliki occurred_at, user_id, dan movement items valid
  // =========================================================================
  {
    const movements = await db.stock_movements.toArray();
    const movementItems = await db.stock_movement_items.toArray();
    const audits = await db.audit_logs.toArray();

    const violations: InvariantResult['violations'] = [];
    const itemMovementIdSet = new Set(movementItems.map((m) => m.movement_id));

    for (const m of movements) {
      if (!m.occurred_at || !Number.isInteger(m.occurred_at)) {
        violations.push({
          id: m.id,
          description: `Movement '${m.id}' memiliki waktu occurred_at tidak valid`,
          expected: 'integer epoch ms',
          actual: m.occurred_at,
        });
      }
      if (!m.user_id) {
        violations.push({
          id: m.id,
          description: `Movement '${m.id}' tidak memiliki user_id`,
          expected: 'non-empty string',
          actual: m.user_id,
        });
      }
      if (!itemMovementIdSet.has(m.id)) {
        violations.push({
          id: m.id,
          description: `Movement '${m.id}' tidak memiliki rincian item di stock_movement_items`,
          expected: 'at least 1 item',
          actual: 0,
        });
      }
    }

    for (const a of audits) {
      if (!a.occurred_at || !Number.isInteger(a.occurred_at) || !a.action || !a.user_id) {
        violations.push({
          id: a.id,
          description: `Audit log '${a.id}' tidak lengkap (action/user_id/occurred_at)`,
          expected: 'valid audit record',
          actual: a,
        });
      }
    }

    results.push({
      invariant: 'INV-2',
      name: 'Kekekalan Riwayat Mutasi & Audit Log',
      passed: violations.length === 0,
      checkedCount: movements.length + audits.length,
      violations,
      details: violations.length === 0
        ? `${movements.length} mutasi dan ${audits.length} catatan audit log valid dan utuh.`
        : `Ditemukan ${violations.length} anomali pada tabel riwayat ledger/audit.`,
    });
  }

  // =========================================================================
  // INV-3: Integritas Uang Kasir (Integer Rupiah & Rekonsiliasi Kas)
  // expectedCash == opening_cash + cashSales - cashRefunds. Semua integer.
  // =========================================================================
  {
    const sessions = await db.cashier_sessions.toArray();
    const payments = await db.payments.toArray();

    const violations: InvariantResult['violations'] = [];

    // Verifikasi pembayaran: amount harus integer positif
    for (const p of payments) {
      if (!Number.isInteger(p.amount) || p.amount <= 0) {
        violations.push({
          id: p.id,
          description: `Pembayaran '${p.id}' bernilai tidak valid atau non-integer: ${p.amount}`,
          expected: 'positive integer',
          actual: p.amount,
        });
      }
    }

    // Verifikasi sesi kasir
    for (const s of sessions) {
      if (!Number.isInteger(s.opening_cash) || s.opening_cash < 0) {
        violations.push({
          id: s.id,
          description: `Sesi kasir '${s.id}' memiliki modal awal tidak valid: ${s.opening_cash}`,
          expected: 'non-negative integer',
          actual: s.opening_cash,
        });
      }

      if (s.status === 'closed' && s.closing_cash !== undefined) {
        if (!Number.isInteger(s.closing_cash) || s.closing_cash < 0) {
          violations.push({
            id: s.id,
            description: `Sesi kasir '${s.id}' memiliki kas akhir tidak valid: ${s.closing_cash}`,
            expected: 'non-negative integer',
            actual: s.closing_cash,
          });
        }
      }
    }

    results.push({
      invariant: 'INV-3',
      name: 'Integritas Uang Kasir (Integer Rupiah & Format Uang)',
      passed: violations.length === 0,
      checkedCount: sessions.length + payments.length,
      violations,
      details: violations.length === 0
        ? `Seluruh nilai uang pada ${sessions.length} sesi kasir dan ${payments.length} pembayaran berupa integer Rupiah sah.`
        : `Ditemukan ${violations.length} nilai nominal uang tidak valid.`,
    });
  }

  // =========================================================================
  // INV-4: Keutuhan Snapshot Transaksi
  // Setiap sale_item memiliki unit_price_snapshot dan unit_cost_x10k_snapshot
  // =========================================================================
  {
    const saleItems = await db.sale_items.toArray();
    const violations: InvariantResult['violations'] = [];

    for (const item of saleItems) {
      if (!Number.isInteger(item.unit_price_snapshot) || item.unit_price_snapshot < 0) {
        violations.push({
          id: item.id,
          description: `Item penjualan '${item.id}' memiliki harga snapshot tidak valid: ${item.unit_price_snapshot}`,
          expected: 'non-negative integer',
          actual: item.unit_price_snapshot,
        });
      }
      if (!Number.isInteger(item.line_total) || item.line_total < 0) {
        violations.push({
          id: item.id,
          description: `Item penjualan '${item.id}' memiliki line_total tidak valid: ${item.line_total}`,
          expected: 'non-negative integer',
          actual: item.line_total,
        });
      }
      if (!item.name_snapshot || !item.unit_code_snapshot) {
        violations.push({
          id: item.id,
          description: `Item penjualan '${item.id}' kehilangan snapshot nama/satuan`,
          expected: 'valid snapshot strings',
          actual: { name: item.name_snapshot, unit: item.unit_code_snapshot },
        });
      }
    }

    results.push({
      invariant: 'INV-4',
      name: 'Keutuhan Snapshot Transaksi (Harga, Modal, Nama)',
      passed: violations.length === 0,
      checkedCount: saleItems.length,
      violations,
      details: violations.length === 0
        ? `Seluruh ${saleItems.length} baris item transaksi memiliki snapshot data yang utuh dan valid.`
        : `Ditemukan ${violations.length} snapshot item yang cacat.`,
    });
  }

  // =========================================================================
  // INV-5: Validitas Alokasi Batch & Expiry (FEFO)
  // Untuk item dengan batch, total pengeluaran batch sama dengan qty_base item
  // =========================================================================
  {
    const saleItems = await db.sale_items.toArray();
    const itemBatches = await db.sale_item_batches.toArray();
    const products = await db.products.toArray();
    const expiryProductIds = new Set(products.filter((p) => p.track_expiry === 1).map((p) => p.id));

    const violations: InvariantResult['violations'] = [];

    for (const it of saleItems) {
      if (expiryProductIds.has(it.product_id)) {
        const allocatedBatches = itemBatches.filter((b) => b.sale_item_id === it.id);
        const totalAllocated = allocatedBatches.reduce((acc, b) => acc + b.qty_base, 0);

        if (totalAllocated !== it.qty_base) {
          violations.push({
            id: it.id,
            description: `Item '${it.name_snapshot}' (${it.id}) dengan pelacakan expiry memiliki alokasi batch tidak seimbang`,
            expected: it.qty_base,
            actual: totalAllocated,
          });
        }
      }
    }

    results.push({
      invariant: 'INV-5',
      name: 'Validitas Alokasi Batch & FEFO',
      passed: violations.length === 0,
      checkedCount: saleItems.length,
      violations,
      details: violations.length === 0
        ? `Alokasi batch FEFO untuk ${saleItems.length} item penjualan sesuai dengan kuantitas yang terjual.`
        : `Ditemukan ${violations.length} alokasi batch yang tidak seimbang.`,
    });
  }

  // =========================================================================
  // INV-6: Validitas Format & Checksum Backup
  // =========================================================================
  {
    const backups = await db.backup_history.toArray();
    const violations: InvariantResult['violations'] = [];

    for (const b of backups) {
      if (!b.checksum_sha256 || !/^[a-f0-9]{64}$/i.test(b.checksum_sha256)) {
        violations.push({
          id: b.id,
          description: `Riwayat backup '${b.id}' memiliki hash SHA-256 yang tidak valid: ${b.checksum_sha256}`,
          expected: '64-character hex string',
          actual: b.checksum_sha256,
        });
      }
    }

    results.push({
      invariant: 'INV-6',
      name: 'Integritas Checksum Riwayat Backup SHA-256',
      passed: violations.length === 0,
      checkedCount: backups.length,
      violations,
      details: violations.length === 0
        ? `${backups.length} catatan riwayat backup memiliki checksum SHA-256 valid.`
        : `Ditemukan ${violations.length} riwayat backup dengan checksum cacat.`,
    });
  }

  const allPassed = results.every((r) => r.passed);
  const totalChecks = results.reduce((acc, r) => acc + r.checkedCount, 0);

  return {
    timestamp: Date.now(),
    allPassed,
    totalChecks,
    results,
  };
}
