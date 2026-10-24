import React, { useState, useEffect } from 'react';
import {
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
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600">
            Tutup
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-stone-900">Manajemen Pengguna & Hak Akses</h2>
          <p className="text-xs text-stone-500">
            Kelola akun staf kasir, supervisor, dan staf gudang dengan autentikasi PIN terenkripsi (FR-SET-04)
          </p>
        </div>

        <button
          onClick={() => setIsAddUserOpen(true)}
          className="px-3.5 py-2 bg-[#14463C] hover:bg-[#0F352E] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
        >
          <UserPlus className="w-4 h-4 text-emerald-300" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-4 py-3">Nama Pengguna</th>
              <th className="px-3 py-3">Peran</th>
              <th className="px-3 py-3">Percobaan Gagal</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  Memuat daftar pengguna...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  Tidak ada pengguna terdaftar.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-bold text-stone-900">{u.name}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800">
                      {u.roleName}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {u.failedAttempts > 0 ? (
                      <span className="text-rose-600 font-bold">{u.failedAttempts} kali</span>
                    ) : (
                      <span className="text-stone-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
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
                        className="px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-stone-500" />
                        <span>Reset PIN</span>
                      </button>

                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                          u.status === 'active'
                            ? 'border-rose-200 hover:bg-rose-50 text-rose-700'
                            : 'border-emerald-200 hover:bg-emerald-50 text-emerald-700'
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

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                <UserPlus className="w-5 h-5 text-[#14463C]" />
                <span>Tambah Pengguna Baru</span>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-[#14463C]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Peran & Hak Akses *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-[#14463C]"
                >
                  <option value="cashier">Kasir (Transaksi POS, Buka/Tutup Kas)</option>
                  <option value="supervisor">Supervisor (Void, Retur, Approval Diskon & Stok)</option>
                  <option value="stock_clerk">Staf Gudang (Penerimaan Barang, Opname)</option>
                  <option value="owner">Owner (Akses Penuh, Backup/Restore, Audit)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  PIN Masuk (6 Digit Angka) *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="6 Digit PIN"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-mono tracking-widest text-center text-sm focus:ring-2 focus:ring-[#14463C]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#14463C] hover:bg-[#0F352E] text-white font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                <KeyRound className="w-5 h-5 text-[#14463C]" />
                <span>Reset PIN Pengguna</span>
              </div>
              <button
                onClick={() => setResetPinUserId(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Masukkan PIN Baru (6 Digit) *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Contoh: 654321"
                  value={newResetPin}
                  onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-mono tracking-widest text-center text-sm focus:ring-2 focus:ring-[#14463C]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setResetPinUserId(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newResetPin.length !== 6}
                  className="px-4 py-2 rounded-xl bg-[#14463C] hover:bg-[#0F352E] text-white font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
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
