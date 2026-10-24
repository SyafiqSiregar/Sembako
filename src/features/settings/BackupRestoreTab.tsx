import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle,
  Loader2,
  Database,
  FileCheck,
} from 'lucide-react';
import { BackupService, type BackupValidationResult } from '@/services/backup.service';
import { type BackupHistory } from '@/data/db';
import { useAuthStore } from '@/features/auth/authStore';

interface BackupRestoreTabProps {
  backupService: BackupService;
}

export const BackupRestoreTab: React.FC<BackupRestoreTabProps> = ({ backupService }) => {
  const { currentUser } = useAuthStore();
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Restore States
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadHistory = async () => {
    try {
      const list = await backupService.listBackupHistory();
      setHistory(list);
    } catch (e) {
      console.error('Error loading backup history:', e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleBackupNow = async () => {
    try {
      setLoading(true);
      const res = await backupService.exportBackup(currentUser?.id || 'admin');

      // Trigger download
      const blob = new Blob([res.jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: `Backup '${res.fileName}' berhasil diunduh. SHA-256: ${res.checksum.substring(0, 16)}...`,
      });
      loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat backup';
      setNotification({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setSelectedFileContent(text);
      const val = await backupService.validateBackup(text);
      setValidationResult(val);

      if (!val.valid) {
        setNotification({ type: 'error', message: val.error || 'Berkas backup tidak valid' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Gagal membaca berkas' });
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedFileContent) return;

    try {
      setIsRestoring(true);
      const res = await backupService.restoreBackup(selectedFileContent, currentUser?.id || 'admin');

      setNotification({
        type: 'success',
        message: `Database berhasil dipulihkan! ${Object.keys(res.restoredCounts).length} tabel terisi kembali.`,
      });
      setShowConfirmRestore(false);
      setSelectedFileContent(null);
      setValidationResult(null);
      loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memulihkan database';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fade-in ${
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

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="p-6 bg-white border border-stone-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl text-[#14463C]">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Backup Database Manual</h2>
              <p className="text-xs text-stone-500">
                Ekspor seluruh tabel IndexedDB disertai metadata manifest dan SHA-256 checksum (FR-BKP-01, AC-32)
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleBackupNow}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#14463C] hover:bg-[#0F352E] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat Berkas Backup...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-300" />
                  <span>Unduh Backup (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Restore Card */}
        <div className="p-6 bg-white border border-stone-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-700">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Restore Database</h2>
              <p className="text-xs text-stone-500">
                Validasi integritas checksum SHA-256 dan pemulihan data atomik (FR-BKP-03, AC-33)
              </p>
            </div>
          </div>

          <div className="pt-2">
            <label className="w-full py-2.5 px-4 border border-stone-300 hover:border-amber-600 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
              <Upload className="w-4 h-4 text-stone-500" />
              <span>Pilih Berkas Backup (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Restore Preview & Confirmation Dialog */}
      {validationResult && validationResult.valid && validationResult.manifest && (
        <div className="p-5 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
            <FileCheck className="w-4 h-4 text-amber-700" />
            <span>Validasi Berkas Backup Lolos (SHA-256 Cocok)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-stone-700">
            <div>Aplikasi: <strong>{validationResult.manifest.app}</strong></div>
            <div>Versi: <strong>{validationResult.manifest.app_version}</strong></div>
            <div>Tanggal: <strong>{new Date(validationResult.manifest.created_at).toLocaleString('id-ID')}</strong></div>
            <div>Checksum: <strong className="font-mono text-[10px]">{validationResult.manifest.checksum_sha256.substring(0, 12)}...</strong></div>
          </div>

          <div className="text-xs text-stone-600">
            Jumlah Record: {Object.entries(validationResult.manifest.table_counts).map(([tbl, cnt]) => `${tbl} (${cnt})`).join(', ')}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setSelectedFileContent(null);
                setValidationResult(null);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-xs font-semibold text-stone-700 transition"
            >
              Batal
            </button>
            <button
              onClick={() => setShowConfirmRestore(true)}
              className="px-4 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Lanjutkan Restore Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirm Destructive Restore Modal */}
      {showConfirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                Konfirmasi Restore Database
              </h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              <strong>PERINGATAN KERAS:</strong> Pemulihan database bersifat destruktif. Seluruh data transaksi, produk, dan stok saat ini akan <strong>ditimpa sepenuhnya</strong> oleh data dari berkas backup. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowConfirmRestore(false)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memulihkan Database...</span>
                  </>
                ) : (
                  <span>Ya, Timpa dan Pulihkan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup History Table */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-stone-500" />
          <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
            Riwayat Backup Berkas
          </h3>
        </div>

        <div className="border border-stone-100 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-2.5">Nama Berkas</th>
                <th className="px-3 py-2.5">Waktu</th>
                <th className="px-3 py-2.5">Ukuran</th>
                <th className="px-3 py-2.5">Checksum SHA-256</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-stone-400">
                    Belum ada riwayat backup tercatat.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-2.5 font-bold text-stone-900">{h.file_name}</td>
                    <td className="px-3 py-2.5 text-stone-600">
                      {new Date(h.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-2.5 text-stone-600">
                      {h.size_bytes ? `${Math.round(h.size_bytes / 1024)} KB` : '-'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-stone-500">
                      {h.checksum_sha256?.substring(0, 16)}...
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Sukses</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
