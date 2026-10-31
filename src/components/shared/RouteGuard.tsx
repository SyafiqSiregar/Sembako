import React from 'react';
import { useAuthStore } from '@/features/auth/authStore';
import { hasPermission, type Permission, type RoleCode } from '@/domain/permissions';
import { ShieldAlert, ArrowLeft, ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface RouteGuardProps {
  permission?: Permission;
  allowedRoles?: RoleCode[];
  title?: string;
  children: React.ReactNode;
}

const PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  'dashboard.view': 'Ringkasan Operasional Toko',
  'session.open_close': 'Buka & Tutup Sesi Kasir',
  'sale.create': 'Kasir & Penjualan POS',
  'catalog.view': 'Lihat Katalog Produk & Label',
  'catalog.manage': 'Kelola Katalog Produk',
  'receiving.create': 'Penerimaan Barang Pemasok',
  'inventory.view': 'Lihat Saldo Inventaris & Kartu Stok',
  'inventory.adjust': 'Kelola Inventaris & Penyesuaian Stok',
  'expiry.view': 'Pantau Batch Kedaluwarsa',
  'stocktake.count': 'Hitung Fisik Stok Opname',
  'stocktake.post': 'Posting Stok Opname',
  'reports.sales_profit': 'Laporan Penjualan & Laba',
  'reports.stock_expiry': 'Laporan Stok & Kedaluwarsa',
  'audit.view': 'Jejak Audit Sistem',
  'backup.create': 'Cadangkan Database',
  'backup.restore': 'Pulihkan Database',
  'users.manage': 'Kelola Pengguna & Peran',
  'settings.manage': 'Pengaturan Identitas & Kebijakan Toko',
};

const READ_ONLY_TITLE_PERMISSIONS: Record<string, Permission> = {
  'Ringkasan Toko': 'dashboard.view',
  'Katalog Produk': 'catalog.view',
  'Inventaris & Stok': 'inventory.view',
  'Monitoring Kedaluwarsa': 'expiry.view',
};

export const RouteGuard: React.FC<RouteGuardProps> = ({
  permission,
  allowedRoles,
  title,
  children,
}) => {
  const { currentUser, roleCodes, isLoading, lockScreen } = useAuthStore();
  const navigate = useNavigate();

  const effectivePermission = React.useMemo(() => {
    if (title && READ_ONLY_TITLE_PERMISSIONS[title]) {
      return READ_ONLY_TITLE_PERMISSIONS[title];
    }
    return permission;
  }, [permission, title]);

  const isAllowed = React.useMemo(() => {
    if (!currentUser) return false;
    if (allowedRoles && allowedRoles.some((r) => roleCodes.includes(r))) return true;
    if (effectivePermission && hasPermission(roleCodes, effectivePermission)) return true;
    if (!allowedRoles && !effectivePermission) return true;
    return false;
  }, [currentUser, roleCodes, effectivePermission, allowedRoles]);

  if (isLoading || (currentUser && roleCodes.length === 0)) {
    return null;
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  const roleName = roleCodes.includes('owner')
    ? 'Pemilik Toko (Owner)'
    : roleCodes.includes('supervisor')
    ? 'Supervisor'
    : roleCodes.includes('stock_clerk')
    ? 'Staf Gudang'
    : 'Kasir';

  const homePath = roleCodes.includes('stock_clerk') && !roleCodes.includes('owner') && !roleCodes.includes('supervisor')
    ? '/products'
    : '/';

  const homeLabel = roleCodes.includes('stock_clerk') && !roleCodes.includes('owner') && !roleCodes.includes('supervisor')
    ? 'Ke Katalog Produk'
    : 'Ke Ringkasan';

  return (
    <div
      className="min-h-[65vh] flex items-center justify-center p-4"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-card border border-border rounded-card shadow-sm max-w-md w-full p-6 text-center space-y-5 animate-in fade-in duration-150">
        <div className="size-14 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <ShieldAlert className="size-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold font-serif text-foreground">Akses Dibatasi</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Halaman {title ? <span className="font-semibold text-foreground">&ldquo;{title}&rdquo;</span> : 'ini'}{' '}
            memerlukan hak akses yang tidak dimiliki oleh peran akun Anda saat ini.
          </p>
        </div>

        <div className="p-3.5 bg-muted/40 border border-border/60 rounded-xl text-left space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-[11px]">Akun Aktif:</span>
            <span className="font-semibold text-foreground">{currentUser?.name || 'Belum Login'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-[11px]">Peran Saat Ini:</span>
            <span className="font-semibold text-primary">{roleName}</span>
          </div>
          {permission && (
            <div className="flex justify-between items-center pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground">
              <span>Izin Diperlukan:</span>
              <span className="font-medium text-foreground">
                {PERMISSION_LABELS[permission] || permission}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => navigate(homePath)}
            className="flex-1 min-h-[44px] px-4 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <ArrowLeft className="size-4" />
            <span>{homeLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => lockScreen({ selectUser: true })}
            className="flex-1 min-h-[44px] px-4 rounded-pill border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeftRight className="size-4" />
            <span>Ganti Akun / Peran</span>
          </button>
        </div>
      </div>
    </div>
  );
};

