/**
 * Domain Permissions: Matriks Hak Akses SembakoOS (PRD.md §5.2)
 * 
 * Aturan (AGENTS.md §4.3):
 * - Izin per peran didefinisikan DI KODE sebagai peta tetap, bukan di tabel yang dapat diedit bebas.
 * - Hak akses divalidasi di lapisan logika bisnis / service.
 */

export type RoleCode = 'owner' | 'supervisor' | 'cashier' | 'stock_clerk';

export type Permission =
  | 'dashboard.view'
  | 'session.open_close'
  | 'sale.create'
  | 'sale.discount_standard'
  | 'sale.discount_override'
  | 'sale.reprint'
  | 'sale.history_own'
  | 'sale.history_all'
  | 'sale.void'
  | 'sale.return'
  | 'catalog.view'
  | 'catalog.manage'
  | 'catalog.change_price'
  | 'receiving.create'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'expiry.view'
  | 'stocktake.count'
  | 'stocktake.post'
  | 'reports.sales_profit'
  | 'reports.stock_expiry'
  | 'audit.view'
  | 'backup.create'
  | 'backup.restore'
  | 'users.manage'
  | 'settings.manage';

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  owner: [
    'dashboard.view',
    'session.open_close',
    'sale.create',
    'sale.discount_standard',
    'sale.discount_override',
    'sale.reprint',
    'sale.history_own',
    'sale.history_all',
    'sale.void',
    'sale.return',
    'catalog.view',
    'catalog.manage',
    'catalog.change_price',
    'receiving.create',
    'inventory.view',
    'inventory.adjust',
    'expiry.view',
    'stocktake.count',
    'stocktake.post',
    'reports.sales_profit',
    'reports.stock_expiry',
    'audit.view',
    'backup.create',
    'backup.restore',
    'users.manage',
    'settings.manage',
  ],
  supervisor: [
    'dashboard.view',
    'session.open_close',
    'sale.create',
    'sale.discount_standard',
    'sale.discount_override',
    'sale.reprint',
    'sale.history_own',
    'sale.history_all',
    'sale.void',
    'sale.return',
    'catalog.view',
    'catalog.manage',
    'catalog.change_price',
    'receiving.create',
    'inventory.view',
    'inventory.adjust',
    'expiry.view',
    'stocktake.count',
    'stocktake.post',
    'reports.sales_profit',
    'reports.stock_expiry',
    'audit.view',
    'backup.create',
  ],
  cashier: [
    'dashboard.view',
    'session.open_close',
    'sale.create',
    'sale.discount_standard',
    'sale.reprint',
    'sale.history_own',
    'catalog.view',
    'inventory.view',
    'expiry.view',
  ],
  stock_clerk: [
    'catalog.view',
    'catalog.manage',
    'receiving.create',
    'inventory.view',
    'inventory.adjust',
    'expiry.view',
    'stocktake.count',
    'reports.stock_expiry',
  ],
};

/**
 * Memeriksa apakah sekumpulan peran memiliki izin tertentu.
 */
export function hasPermission(roles: RoleCode[], permission: Permission): boolean {
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role];
    if (perms && perms.includes(permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Validasi otorisasi di lapisan service. Lempar error jika tidak diizinkan.
 */
export function authorize(roles: RoleCode[], permission: Permission, actorName: string = 'Pengguna'): void {
  if (!hasPermission(roles, permission)) {
    throw new Error(`Akses ditolak: ${actorName} tidak memiliki hak akses untuk '${permission}'`);
  }
}
