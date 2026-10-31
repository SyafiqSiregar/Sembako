import React, { useState, useEffect } from 'react';
import { useAuthStore } from './authStore';
import { PinPad } from '@/components/shared/PinPad';
import { type ActiveUserOption } from '@/services/auth.service';
import {
  Lock,
  Store,
  Loader2,
  ArrowRightLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export const LockScreenModal: React.FC = () => {
  const {
    currentUser,
    isLocked,
    startInUserSelect,
    listActiveUsers,
    login,
    error,
    isLoading,
    clearError,
    closeLockScreen,
  } = useAuthStore();

  const [activeUsers, setActiveUsers] = useState<ActiveUserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<ActiveUserOption | null>(null);
  const [isSelectingUser, setIsSelectingUser] = useState(false);
  const [pin, setPin] = useState('');

  const handleClose = () => {
    clearError();
    setPin('');
    setIsSelectingUser(false);
    closeLockScreen();
  };

  // Keyboard shortcut: Esc untuk menutup modal dan kembali ke layar kasir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLocked && currentUser) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, currentUser]);

  // Muat daftar pengguna aktif saat layar terkunci
  useEffect(() => {
    if (!isLocked) {
      setPin('');
      setIsSelectingUser(false);
      return;
    }

    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const users = await listActiveUsers();
        if (!isMounted) return;
        setActiveUsers(users);

        // Pilih pengguna saat ini atau default user pertama
        const currentMatch = users.find((u) => u.id === currentUser?.id);
        const fallbackUser = currentMatch || users[0] || null;
        setSelectedUser(fallbackUser);

        // Jika dipicu khusus untuk ganti pengguna, langsung buka picker
        if (startInUserSelect) {
          setIsSelectingUser(true);
        } else {
          setIsSelectingUser(false);
        }
      } catch (e) {
        console.error('Gagal memuat pengguna aktif:', e);
      }
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [isLocked, currentUser?.id, startInUserSelect, listActiveUsers]);

  if (!isLocked) {
    return null;
  }

  const handleComplete = async (enteredPin: string) => {
    if (!selectedUser) return;
    clearError();
    const success = await login(selectedUser.id, enteredPin);
    if (!success) {
      setPin('');
    }
  };

  const getRoleBadge = (roleCode: string) => {
    switch (roleCode) {
      case 'owner':
        return {
          label: 'Pemilik Toko (Owner)',
          className: 'bg-primary/10 text-primary border-primary/25',
        };
      case 'supervisor':
        return {
          label: 'Supervisor',
          className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
        };
      case 'cashier':
        return {
          label: 'Kasir POS',
          className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
        };
      case 'stock_clerk':
        return {
          label: 'Staf Gudang',
          className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
        };
      default:
        return {
          label: 'Pengguna',
          className: 'bg-muted text-muted-foreground border-border',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-screen-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && currentUser) {
          handleClose();
        }
      }}
    >
      <div className="relative bg-background border border-border w-full max-w-sm rounded-card p-6 sm:p-7 shadow-2xl flex flex-col items-center gap-5">
        {/* Tombol Tutup / Kembali di Sudut Kanan Atas */}
        {currentUser && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 size-8 rounded-full border border-input bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-ring z-10"
            aria-label="Tutup layar kunci dan kembali"
            title="Tutup (Kembali)"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Brand Header */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="size-11 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
            {isSelectingUser ? <UsersIcon className="size-5" /> : <Lock className="size-5" />}
          </div>
          <h2 id="lock-screen-title" className="font-serif font-bold text-xl text-foreground mt-1">
            {isSelectingUser ? 'Ganti Pengguna & Peran' : 'Layar Kasir Terkunci'}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Store className="size-3.5" />
            <span>Toko Sembako Berkah</span>
          </div>
        </div>

        {/* VIEW 1: PILIH PENGGUNA */}
        {isSelectingUser ? (
          <div className="flex flex-col gap-3 w-full animate-in fade-in duration-150">
            <p className="text-xs text-muted-foreground text-center">
              Pilih akun pengguna di bawah ini untuk beralih peran atau membuka sistem.
            </p>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-0.5">
              {activeUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                const isCurrent = currentUser?.id === u.id;
                const badge = getRoleBadge(u.roleCode);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setIsSelectingUser(false);
                      setPin('');
                      clearError();
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-xs'
                        : 'bg-card border-input hover:border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-foreground truncate">
                            {u.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-primary text-primary-foreground font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0">
                              Aktif
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border w-fit mt-1 leading-none ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>

            {selectedUser && (
              <button
                type="button"
                onClick={() => {
                  setIsSelectingUser(false);
                  clearError();
                }}
                className="w-full mt-1 py-2 rounded-pill border border-input text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-center"
              >
                Kembali ke Masukkan PIN
              </button>
            )}
          </div>
        ) : (
          /* VIEW 2: MASUKKAN PIN UNTUK PENGGUNA TERPILIH */
          <>
            {/* User Card dengan Tombol Ganti Pengguna */}
            {selectedUser && (
              <div className="flex items-center justify-between gap-2.5 bg-card border border-input p-3 rounded-2xl w-full shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="size-9 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-foreground leading-tight truncate">
                        {selectedUser.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border leading-none ${
                          getRoleBadge(selectedUser.roleCode).className
                        }`}
                      >
                        {getRoleBadge(selectedUser.roleCode).label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Ganti Pengguna (FR-AUTH-01) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectingUser(true);
                    clearError();
                  }}
                  className="px-2.5 py-1.5 rounded-pill border border-input bg-muted/40 hover:bg-muted text-xs font-semibold text-primary hover:text-primary-foreground hover:bg-primary flex items-center gap-1.5 shrink-0 transition-all shadow-xs"
                  title="Ganti ke kasir, supervisor, atau pemilik toko lain"
                >
                  <ArrowRightLeft className="size-3.5" />
                  <span>Ganti</span>
                </button>
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center -mt-1">
              Masukkan 6-digit PIN untuk membuka sesi
            </div>

            {/* PinPad */}
            <PinPad
              value={pin}
              onChange={setPin}
              onComplete={handleComplete}
              disabled={isLoading}
              error={error}
            />

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-primary font-medium">
                <Loader2 className="size-4 animate-spin" />
                <span>Memverifikasi PIN...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Ikon pendukung kecil
const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
