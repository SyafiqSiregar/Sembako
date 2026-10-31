import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  Boxes,
  CalendarClock,
  Truck,
  ReceiptText,
  BarChart3,
  Settings,
  HelpCircle,
  Lock,
  Store,
  DollarSign,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  ArrowRightLeft,
} from 'lucide-react';
import { SyncStatusChip } from '../shared/SyncStatusChip';
import { NotificationCenterPopover } from './NotificationCenterPopover';
import { useAuthStore } from '@/features/auth/authStore';
import { LockScreenModal } from '@/features/auth/LockScreenModal';
import { CashierSessionModal } from '@/features/auth/CashierSessionModal';
import { hasPermission, type Permission, type RoleCode } from '@/domain/permissions';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
  permission?: Permission;
  allowedRoles?: RoleCode[];
}

const mainNavItems: NavItem[] = [
  { name: 'Ringkasan', path: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
  { name: 'Kasir POS', path: '/pos', icon: ScanBarcode, permission: 'sale.create' },
  { name: 'Produk', path: '/products', icon: Package, permission: 'catalog.view' },
  { name: 'Inventaris', path: '/inventory', icon: Boxes, permission: 'inventory.view' },
  { name: 'Kedaluwarsa', path: '/expiry', icon: CalendarClock, permission: 'expiry.view' },
  { name: 'Pemasok', path: '/suppliers', icon: Truck, permission: 'receiving.create' },
  { name: 'Transaksi', path: '/transactions', icon: ReceiptText, permission: 'sale.history_own' },
  { name: 'Laporan', path: '/reports', icon: BarChart3, permission: 'reports.sales_profit' },
];

const secondaryNavItems: NavItem[] = [
  { name: 'Pengaturan', path: '/settings', icon: Settings, allowedRoles: ['owner', 'supervisor'] },
  { name: 'Bantuan', path: '/help', icon: HelpCircle },
];

interface AppLayoutProps {
  children?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isPos = location.pathname === '/pos';

  const routeMetadata: Record<
    string,
    { name: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    '/': { name: 'Ringkasan', icon: LayoutDashboard },
    '/pos': { name: 'Kasir POS', icon: ScanBarcode },
    '/products': { name: 'Katalog Produk', icon: Package },
    '/inventory': { name: 'Inventaris & Stok', icon: Boxes },
    '/expiry': { name: 'Monitoring Kedaluwarsa', icon: CalendarClock },
    '/suppliers': { name: 'Pemasok & Penerimaan', icon: Truck },
    '/transactions': { name: 'Riwayat Transaksi', icon: ReceiptText },
    '/reports': { name: 'Laporan & Analitik', icon: BarChart3 },
    '/settings': { name: 'Pengaturan Sistem', icon: Settings },
    '/help': { name: 'Pusat Bantuan', icon: HelpCircle },
  };

  const currentRoute = routeMetadata[location.pathname] || {
    name: 'SembakoOS',
    icon: Store,
  };
  const CurrentIcon = currentRoute.icon;

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState<'open' | 'close'>('open');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ label: string; isSafe: boolean }>({
    label: 'Memeriksa...',
    isSafe: true,
  });

  const handleBackupStatusChange = useCallback((label: string, isSafe: boolean) => {
    setBackupStatus({ label, isSafe });
  }, []);

  const {
    currentUser,
    roles,
    roleCodes,
    activeSession,
    lockScreen,
    initialize,
  } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Filter menu berdasarkan izin peran pengguna yang sedang aktif
  const filteredMainNav = useMemo(() => {
    return mainNavItems.filter((item) => {
      if (item.allowedRoles) return item.allowedRoles.some((r) => roleCodes.includes(r));
      if (item.permission) return hasPermission(roleCodes, item.permission);
      return true;
    });
  }, [roleCodes]);

  const filteredSecondaryNav = useMemo(() => {
    return secondaryNavItems.filter((item) => {
      if (item.allowedRoles) return item.allowedRoles.some((r) => roleCodes.includes(r));
      if (item.permission) return hasPermission(roleCodes, item.permission);
      return true;
    });
  }, [roleCodes]);

  const canManageBackup = useMemo(() => hasPermission(roleCodes, 'backup.create'), [roleCodes]);

  // Arahkan Staf Gudang otomatis dari halaman Ringkasan (/) ke Katalog Produk
  useEffect(() => {
    if (!currentUser || roleCodes.length === 0) return;
    if (location.pathname === '/' && roleCodes.includes('stock_clerk') && !roleCodes.includes('owner') && !roleCodes.includes('supervisor') && !roleCodes.includes('cashier')) {
      navigate('/products', { replace: true });
    }
  }, [currentUser, roleCodes, location.pathname, navigate]);

  // Tutup mobile drawer saat navigasi berubah
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  const handleOpenSessionModal = () => {
    setSessionModalMode(activeSession ? 'close' : 'open');
    setSessionModalOpen(true);
  };

  const roleName = roles[0]?.name || 'Owner';

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* ======================================================== */}
      {/* 1. SIDEBAR DESKTOP / TABLET LANDSCAPE (>= lg)            */}
      {/* ======================================================== */}
      <aside
        className={`hidden lg:flex flex-shrink-0 bg-background border-r border-border flex-col justify-between p-3.5 transition-all duration-200 select-none ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <div className="flex flex-col gap-5">
          {/* Brand Logo & Collapse Toggle */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
                <Store className="size-5" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col truncate">
                  <span className="font-serif font-bold text-lg tracking-tight text-foreground leading-none">
                    SembakoOS
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium mt-1 leading-none">
                    Toko Berkah
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title={isSidebarCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>

          {/* Menu Navigasi Utama */}
          <nav className="flex flex-col gap-1" aria-label="Navigasi Utama">
            {filteredMainNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={`flex items-center ${
                    isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-pill text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <div className={`flex items-center ${isSidebarCollapsed ? '' : 'gap-3'} truncate`}>
                    <Icon className="size-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                  </div>
                  {!isSidebarCollapsed && item.tag && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {item.tag}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Menu Bawah & Status Card */}
        <div className="flex flex-col gap-3 pt-3 border-t border-border">
          <nav className="flex flex-col gap-1" aria-label="Navigasi Bawah">
            {filteredSecondaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={`flex items-center ${
                    isSidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
                  } rounded-pill text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              );
            })}
          </nav>

          {!isSidebarCollapsed && canManageBackup && (
            <NavLink
              to="/settings"
              className="bg-card hover:bg-muted/60 border border-border p-2.5 rounded-card flex flex-col gap-1 shadow-sm transition-colors"
              title="Kelola Backup Database Lokal"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Backup lokal</span>
                <span
                  className={`size-2 rounded-full ${
                    backupStatus.isSafe ? 'bg-success-foreground' : 'bg-warning-foreground'
                  }`}
                  title={backupStatus.isSafe ? 'Aman' : 'Perlu Backup'}
                />
              </div>
              <p className="text-[11px] font-semibold text-foreground truncate">
                {backupStatus.label}
              </p>
            </NavLink>
          )}
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. DRAWER OVERLAY UNTUK TABLET PORTRAIT / MOBILE (< lg)  */}
      {/* ======================================================== */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Sidebar Content */}
          <aside className="relative w-72 max-w-[85vw] h-full bg-background border-r border-border flex flex-col justify-between p-4 shadow-2xl z-10 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="flex flex-col gap-4">
              {/* Header Drawer */}
              <div className="flex items-center justify-between px-1 pt-1">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                    <Store className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-serif font-bold text-lg tracking-tight text-foreground leading-tight">
                      SembakoOS
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Toko Berkah
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  aria-label="Tutup menu navigasi"
                  className="size-9 rounded-full border border-input bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Kartu Profil Kasir & Status Lokal (Khusus Mobile/Tablet Drawer) */}
              <div className="bg-card border border-border rounded-card p-3 flex flex-col gap-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
                      {currentUser ? currentUser.name.charAt(0) : 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        {currentUser ? currentUser.name : 'Kasir'}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {roleName}
                      </span>
                    </div>
                  </div>
                  <SyncStatusChip status="saved_local" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    lockScreen({ selectUser: true });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-pill bg-muted/60 hover:bg-muted text-xs font-semibold text-foreground border border-input transition-colors"
                >
                  <ArrowRightLeft className="size-3.5 text-primary" />
                  <span>Ganti Pengguna & Peran</span>
                </button>
              </div>

              {/* Navigasi Utama */}
              <nav className="flex flex-col gap-1" aria-label="Navigasi Tablet">
                {filteredMainNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-pill text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-5 shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      {item.tag && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {item.tag}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Menu Bawah & Status */}
            <div className="flex flex-col gap-3 pt-3 border-t border-border">
              <nav className="flex flex-col gap-1">
                {filteredSecondaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-pill text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>

              {canManageBackup && (
                <NavLink
                  to="/settings"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="bg-card hover:bg-muted/60 border border-border p-3 rounded-card flex flex-col gap-1 shadow-sm transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Backup lokal</span>
                    <span
                      className={`size-2 rounded-full ${
                        backupStatus.isSafe ? 'bg-success-foreground' : 'bg-warning-foreground'
                      }`}
                    />
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {backupStatus.label}
                  </p>
                </NavLink>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. AREA KONTEN UTAMA & HEADER RESPONSIF                   */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar Responsif */}
        <header className="h-14 sm:h-16 bg-background border-b border-border flex items-center justify-between px-3 sm:px-6 flex-shrink-0 gap-2">
          {/* Konteks Halaman & Tombol Hamburger */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
            {/* Tombol Hamburger Drawer (Tampil di < lg) */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden size-9 rounded-full border border-input bg-card flex items-center justify-center text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm shrink-0"
              title="Buka Menu Navigasi"
              aria-label="Buka navigasi menu"
            >
              <Menu className="size-5" />
            </button>

            <div className="hidden sm:flex size-8 sm:size-9 rounded-xl bg-primary/10 text-primary items-center justify-center shrink-0">
              <CurrentIcon className="size-4" />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
              <span className="font-serif font-bold text-base sm:text-lg text-foreground truncate">
                {currentRoute.name}
              </span>
              {isPos && (
                <span className="hidden lg:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-pill bg-primary text-primary-foreground whitespace-nowrap shrink-0">
                  POS Aktif
                </span>
              )}
            </div>
          </div>

          {/* Global Header Actions (Rapi, Terukur, Bebas Tumpang Tindih di Mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Status Sesi Kasir Button (Hanya tampil bila punya izin session.open_close) */}
            {hasPermission(roleCodes, 'session.open_close') && (
              <button
                type="button"
                onClick={handleOpenSessionModal}
                className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold border transition-all shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring whitespace-nowrap shrink-0 ${
                  activeSession
                    ? 'bg-secondary text-secondary-foreground border-secondary hover:bg-accent'
                    : 'bg-warning/30 text-warning-foreground border-warning-foreground/25 hover:bg-warning/50'
                }`}
              >
                <DollarSign className="size-3.5 shrink-0" />
                <span className="hidden md:inline">
                  {activeSession ? 'Sesi Kas: Aktif' : 'Buka Kasir'}
                </span>
                <span className="inline md:hidden">
                  {activeSession ? 'Kasir Aktif' : 'Buka Kas'}
                </span>
              </button>
            )}

            {/* Status Sinkronisasi Data (Tampil di >= sm; di Mobile < sm pindah ke dalam Drawer) */}
            <div className="hidden sm:block shrink-0">
              <SyncStatusChip status="saved_local" />
            </div>

            {/* Pusat Peringatan Operasional Toko (Tampil di Mobile & Desktop) */}
            <NotificationCenterPopover onBackupStatusChange={handleBackupStatusChange} />

            {/* Profil Kasir (>= sm) & Tombol Kunci Layar */}
            <div className="flex items-center gap-1.5 sm:gap-2 sm:pl-2 sm:border-l sm:border-border shrink-0">
              <button
                type="button"
                onClick={() => lockScreen({ selectUser: true })}
                className="hidden sm:flex items-center gap-2 bg-card hover:bg-muted/70 active:scale-[0.98] border border-input px-2.5 py-1.5 rounded-pill shadow-xs transition-all cursor-pointer group"
                title="Ganti Pengguna atau Beralih Peran"
              >
                <div className="size-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
                  {currentUser ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-foreground leading-none truncate max-w-[100px] group-hover:text-primary transition-colors">
                    {currentUser ? currentUser.name : 'Kasir'}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                    {roleName}
                  </span>
                </div>
                <ArrowRightLeft className="size-3 text-muted-foreground group-hover:text-primary transition-colors ml-0.5 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => lockScreen()}
                className="size-9 rounded-full bg-card border border-input flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
                title="Kunci Layar (PIN)"
                aria-label="Kunci layar kasir"
              >
                <Lock className="size-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Konten Scrollable: POS full-bleed, Halaman lain dengan padding adaptif */}
        <main className={`flex-1 min-w-0 ${isPos ? 'overflow-hidden p-0' : 'overflow-y-auto p-3.5 sm:p-6 lg:p-8'}`}>
          {isPos ? (
            children
          ) : (
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Modal Kunci Layar & Sesi Kasir */}
      <LockScreenModal />
      <CashierSessionModal
        isOpen={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        mode={sessionModalMode}
      />
    </div>
  );
};
