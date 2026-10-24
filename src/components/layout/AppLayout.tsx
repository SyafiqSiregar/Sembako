import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Bell,
  Lock,
  ChevronDown,
  Calendar,
  Store,
  DollarSign,
} from 'lucide-react';
import { SyncStatusChip } from '../shared/SyncStatusChip';
import { useAuthStore } from '@/features/auth/authStore';
import { LockScreenModal } from '@/features/auth/LockScreenModal';
import { CashierSessionModal } from '@/features/auth/CashierSessionModal';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

const mainNavItems: NavItem[] = [
  { name: 'Ringkasan', path: '/', icon: LayoutDashboard },
  { name: 'Kasir POS', path: '/pos', icon: ScanBarcode },
  { name: 'Produk', path: '/products', icon: Package },
  { name: 'Inventaris', path: '/inventory', icon: Boxes },
  { name: 'Kedaluwarsa', path: '/expiry', icon: CalendarClock },
  { name: 'Pemasok', path: '/suppliers', icon: Truck },
  { name: 'Transaksi', path: '/transactions', icon: ReceiptText },
  { name: 'Laporan', path: '/reports', icon: BarChart3 },
];

const secondaryNavItems: NavItem[] = [
  { name: 'Pengaturan', path: '/settings', icon: Settings },
  { name: 'Bantuan', path: '/help', icon: HelpCircle },
];

interface AppLayoutProps {
  children?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [dateRange, setDateRange] = useState('Hari ini');
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState<'open' | 'close'>('open');

  const {
    currentUser,
    roles,
    activeSession,
    lockScreen,
    initialize,
  } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleOpenSessionModal = () => {
    setSessionModalMode(activeSession ? 'close' : 'open');
    setSessionModalOpen(true);
  };

  const roleName = roles[0]?.name || 'Owner';

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar Navigasi Kiri (240px di Tablet / Desktop) */}
      <aside className="w-60 flex-shrink-0 bg-background border-r border-border flex flex-col justify-between p-4">
        <div className="flex flex-col gap-6">
          {/* Brand Logo & Toko */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Store className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-lg tracking-tight text-foreground">
                SembakoOS
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Toko Berkah
              </span>
            </div>
          </div>

          {/* Menu Navigasi Utama */}
          <nav className="flex flex-col gap-1" aria-label="Navigasi Utama">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-pill text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.tag && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {item.tag}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Menu Bawah & Status Card */}
        <div className="flex flex-col gap-4 pt-4 border-t border-border">
          <nav className="flex flex-col gap-1" aria-label="Navigasi Bawah">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-pill text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Status Backup Card */}
          <div className="bg-card border border-border p-3 rounded-card flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Backup lokal</span>
              <span className="size-2 rounded-full bg-success-text" title="Aman" />
            </div>
            <p className="text-xs font-semibold text-foreground">
              Hari ini, 08:30 WIB
            </p>
          </div>
        </div>
      </aside>

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-20 bg-background border-b border-border flex items-center justify-between px-8 flex-shrink-0">
          <div>
            <h1 className="font-serif font-semibold text-2xl text-foreground">
              Ringkasan Toko
            </h1>
            <p className="text-xs text-muted-foreground">
              Gambaran penjualan, perputaran stok, dan aktivitas toko Anda.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Pemilih Rentang Tanggal */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDateRange(dateRange === 'Hari ini' ? 'Bulan ini' : 'Hari ini')}
                className="flex items-center gap-2 px-3.5 py-2 bg-card border border-input rounded-pill text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>{dateRange}: 24 Okt 2026</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </div>

            {/* Status Sesi Kasir Button */}
            <button
              type="button"
              onClick={handleOpenSessionModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold border transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                activeSession
                  ? 'bg-secondary text-secondary-foreground border-secondary hover:bg-accent'
                  : 'bg-warning/20 text-warning-text border-warning/40 hover:bg-warning/30'
              }`}
            >
              <DollarSign className="size-3.5" />
              <span>{activeSession ? 'Sesi Kas: Aktif' : 'Buka Kasir'}</span>
            </button>

            {/* Status Sinkronisasi Data */}
            <SyncStatusChip status="saved_local" />

            {/* Tombol Notifikasi */}
            <button
              type="button"
              className="relative size-10 rounded-full bg-card border border-input flex items-center justify-center text-foreground hover:bg-muted transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              title="Notifikasi"
              aria-label="Notifikasi sistem"
            >
              <Bell className="size-4" />
              <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive-text" />
            </button>

            {/* Profil Kasir & Tombol Kunci Layar */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="flex items-center gap-2 bg-card border border-input px-3 py-1.5 rounded-pill shadow-sm">
                <div className="size-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {currentUser ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-foreground leading-none">
                    {currentUser ? currentUser.name : 'Memuat...'}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {roleName}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={lockScreen}
                className="size-9 rounded-full bg-card border border-input flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                title="Kunci Layar (PIN)"
                aria-label="Kunci layar kasir"
              >
                <Lock className="size-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Konten Scrollable */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
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
