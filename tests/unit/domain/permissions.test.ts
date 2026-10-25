import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  type RoleCode,
  type Permission,
} from '@/domain/permissions';

describe('Domain: Permissions Matrix (PRD §5.2, AC-13, AC-20, AC-30)', () => {
  it('Owner memiliki seluruh hak akses sistem', () => {
    const allPermissions: Permission[] = [
      'session.open_close',
      'sale.create',
      'sale.discount_standard',
      'sale.discount_override',
      'sale.reprint',
      'sale.history_own',
      'sale.history_all',
      'sale.void',
      'sale.return',
      'catalog.manage',
      'catalog.change_price',
      'receiving.create',
      'inventory.adjust',
      'stocktake.count',
      'stocktake.post',
      'reports.sales_profit',
      'reports.stock_expiry',
      'audit.view',
      'backup.create',
      'backup.restore',
      'users.manage',
      'settings.manage',
    ];

    allPermissions.forEach((perm) => {
      expect(hasPermission(['owner'], perm)).toBe(true);
    });
  });

  it('Kasir ditolak untuk operasi sensitif: void, penyesuaian stok, dan laporan laba (AC-13, AC-30)', () => {
    // Diizinkan untuk kasir
    expect(hasPermission(['cashier'], 'sale.create')).toBe(true);
    expect(hasPermission(['cashier'], 'session.open_close')).toBe(true);
    expect(hasPermission(['cashier'], 'sale.discount_standard')).toBe(true);
    expect(hasPermission(['cashier'], 'sale.reprint')).toBe(true);
    expect(hasPermission(['cashier'], 'sale.history_own')).toBe(true);

    // AC-13: ditolak void dan koreksi stok
    expect(hasPermission(['cashier'], 'sale.void')).toBe(false);
    expect(hasPermission(['cashier'], 'inventory.adjust')).toBe(false);

    // AC-30: ditolak laporan laba, kelola user, dan pengaturan
    expect(hasPermission(['cashier'], 'reports.sales_profit')).toBe(false);
    expect(hasPermission(['cashier'], 'users.manage')).toBe(false);
    expect(hasPermission(['cashier'], 'settings.manage')).toBe(false);
    expect(hasPermission(['cashier'], 'backup.restore')).toBe(false);
  });

  it('Supervisor dapat melakukan void, koreksi stok, dan override diskon, tetapi tidak dapat kelola user / restore (AC-13, AC-20)', () => {
    // Diizinkan untuk supervisor
    expect(hasPermission(['supervisor'], 'sale.void')).toBe(true);
    expect(hasPermission(['supervisor'], 'inventory.adjust')).toBe(true);
    expect(hasPermission(['supervisor'], 'sale.discount_override')).toBe(true);
    expect(hasPermission(['supervisor'], 'stocktake.post')).toBe(true);
    expect(hasPermission(['supervisor'], 'reports.sales_profit')).toBe(true);

    // Terbatas untuk supervisor (hanya Owner)
    expect(hasPermission(['supervisor'], 'users.manage')).toBe(false);
    expect(hasPermission(['supervisor'], 'settings.manage')).toBe(false);
    expect(hasPermission(['supervisor'], 'backup.restore')).toBe(false);
  });

  it('Petugas Gudang (Stock Clerk) hanya mengelola stok dan barang masuk', () => {
    expect(hasPermission(['stock_clerk'], 'catalog.manage')).toBe(true);
    expect(hasPermission(['stock_clerk'], 'receiving.create')).toBe(true);
    expect(hasPermission(['stock_clerk'], 'inventory.adjust')).toBe(true);
    expect(hasPermission(['stock_clerk'], 'stocktake.count')).toBe(true);
    expect(hasPermission(['stock_clerk'], 'reports.stock_expiry')).toBe(true);

    // Ditolak untuk transaksi kasir
    expect(hasPermission(['stock_clerk'], 'sale.create')).toBe(false);
    expect(hasPermission(['stock_clerk'], 'sale.void')).toBe(false);
    expect(hasPermission(['stock_clerk'], 'session.open_close')).toBe(false);
  });

  it('Pengguna multi-peran mendapatkan gabungan hak akses', () => {
    // User adalah kasir dan juga petugas gudang
    const multiRoles: RoleCode[] = ['cashier', 'stock_clerk'];

    expect(hasPermission(multiRoles, 'sale.create')).toBe(true);
    expect(hasPermission(multiRoles, 'receiving.create')).toBe(true);
    // Tetap tidak punya akses owner/supervisor
    expect(hasPermission(multiRoles, 'sale.void')).toBe(false);
    expect(hasPermission(multiRoles, 'users.manage')).toBe(false);
  });

  it('Array peran kosong ditolak untuk semua izin', () => {
    expect(hasPermission([], 'sale.create')).toBe(false);
    expect(hasPermission([], 'session.open_close')).toBe(false);
  });
});
