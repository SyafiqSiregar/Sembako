import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { SettingsService, type UserItem } from '@/services/settings.service';
import { useAuthStore } from '@/features/auth/authStore';

interface UserManagementTabProps {
  settingsService: SettingsService;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ settingsService }) => {
  const { currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<'owner' | 'supervisor' | 'cashier' | 'stock_clerk'>('cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset PIN modal
  const [resetPinUserId, setResetPinUserId] = useState<string | null>(null);
  const [newResetPin, setNewResetPin] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await settingsService.listUsers();
      setUsers(data);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPin.trim()) return;

    try {
      setIsSubmitting(true);
      await settingsService.createUser({
        name: newUserName.trim(),
        pin: newUserPin.trim(),
        roleCode: newUserRole,
        actorId: currentUser?.id || 'admin',
      });

      setNotification({ type: 'success', message: `Pengguna '${newUserName}' berhasil ditambahkan` });
      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserPin('');
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat pengguna';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinUserId || !newResetPin.trim()) return;

    try {
      setIsSubmitting(true);
      await settingsService.resetUserPin(resetPinUserId, newResetPin.trim(), currentUser?.id || 'admin');
      setNotification({ type: 'success', message: 'PIN pengguna berhasil diperbarui' });
      setResetPinUserId(null);
      setNewResetPin('');
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mereset PIN';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    try {
      const newStatus = await settingsService.toggleUserStatus(user.id, currentUser?.id || 'admin');
      setNotification({
        type: 'success',
        message: `Status pengguna '${user.name}' diubah menjadi ${newStatus === 'active' ? 'Aktif' : 'Nonaktif'}`,
      });
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status';
      setNotification({ type: 'error', message: msg });
    }
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`p-3.5 rounded-card border flex items-center justify-between text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-success/20 border-success/40 text-success-foreground'
              : 'bg-destructive/20 border-destructive/40 text-destructive-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="size-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-4 text-destructive-text" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* Unified Users Table Card */}
      <div className="bg-card border border-border rounded-card shadow-xs overflow-hidden">
        {/* Card Header Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-pill bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-serif font-bold text-foreground">Daftar Pengguna & Akses</h2>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-pill bg-muted text-muted-foreground border border-border/50">
                  {users.length} akun
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Kelola staf kasir, supervisor, dan staf gudang dengan autentikasi PIN 6 digit.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="h-8 px-3.5 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold rounded-pill flex items-center gap-1.5 transition-colors shadow-xs shrink-0 self-start sm:self-auto"
          >
            <UserPlus className="size-3.5 text-emerald-300" />
            <span>Tambah Pengguna</span>
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Nama Pengguna</th>
                <th className="px-3 py-3">Peran</th>
                <th className="px-3 py-3">Percobaan Gagal</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Memuat daftar pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Tidak ada pengguna terdaftar.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{u.name}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-muted text-foreground border border-border/60">
                        {u.roleName}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {u.failedAttempts > 0 ? (
                        <span className="text-destructive-text font-bold">{u.failedAttempts} kali</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold border ${
                          u.status === 'active'
                            ? 'bg-success/20 border-success/40 text-success-foreground'
                            : 'bg-destructive/20 border-destructive/40 text-destructive-foreground'
                        }`}
                      >
                        {u.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResetPinUserId(u.id);
                            setNewResetPin('');
                          }}
                          className="h-7 px-2.5 rounded-pill border border-border hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <KeyRound className="size-3 text-muted-foreground" />
                          <span>Reset PIN</span>
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`h-7 px-2.5 rounded-pill border text-xs font-medium transition-colors ${
                            u.status === 'active'
                              ? 'border-destructive/30 hover:bg-destructive/10 text-destructive-foreground'
                              : 'border-success/30 hover:bg-success/10 text-success-foreground'
                          }`}
                        >
                          {u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-card shadow-2xl border border-border w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-foreground font-serif font-bold text-base">
                <UserPlus className="size-5 text-primary" />
                <span>Tambah Pengguna Baru</span>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="p-1 rounded-pill text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
                  Peran & Hak Akses *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="cashier">Kasir (Transaksi POS, Buka/Tutup Kas)</option>
                  <option value="supervisor">Supervisor (Void, Retur, Approval Diskon & Stok)</option>
                  <option value="stock_clerk">Staf Gudang (Penerimaan Barang, Opname)</option>
                  <option value="owner">Owner (Akses Penuh, Backup/Restore, Audit)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
                  PIN Masuk (6 Digit Angka) *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="6 Digit PIN"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground font-mono tracking-widest text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-pill border border-input hover:bg-muted text-foreground font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-pill bg-primary hover:bg-primary-hover text-primary-foreground font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {resetPinUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-card shadow-2xl border border-border w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-foreground font-serif font-bold text-base">
                <KeyRound className="size-5 text-primary" />
                <span>Reset PIN Pengguna</span>
              </div>
              <button
                onClick={() => setResetPinUserId(null)}
                className="p-1 rounded-pill text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleResetPin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
                  Masukkan PIN Baru (6 Digit) *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Contoh: 654321"
                  value={newResetPin}
                  onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground font-mono tracking-widest text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setResetPinUserId(null)}
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-pill border border-input hover:bg-muted text-foreground font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newResetPin.length !== 6}
                  className="h-8 px-4 rounded-pill bg-primary hover:bg-primary-hover text-primary-foreground font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Memperbarui...' : 'Simpan PIN Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
