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
import { hasPermission } from '@/domain/permissions';

interface BackupRestoreTabProps {
  backupService: BackupService;
}

export const BackupRestoreTab: React.FC<BackupRestoreTabProps> = ({ backupService }) => {
  const { currentUser, roleCodes } = useAuthStore();
  const canRestore = hasPermission(roleCodes, 'backup.restore');
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
          className={`p-3.5 rounded-card border flex items-center justify-between text-xs font-semibold animate-fade-in ${
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

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backup Card */}
        <div className="p-5 bg-card border border-border rounded-card shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-pill bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Database className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-serif font-bold text-foreground">Backup Database Manual</h2>
                <p className="text-xs text-muted-foreground">
                  Ekspor seluruh data IndexedDB lengkap dengan checksum SHA-256.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Berkas JSON hasil ekspor dapat disimpan di flashdisk atau media penyimpanan luar sebagai arsip cadangan toko.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleBackupNow}
              disabled={loading}
              className="w-full h-9 px-4 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold rounded-pill flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Membuat Berkas Backup...</span>
                </>
              ) : (
                <>
                  <Download className="size-3.5 text-emerald-300" />
                  <span>Unduh Backup (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Restore Card */}
        <div className="p-5 bg-card border border-border rounded-card shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-pill bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                <Upload className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-serif font-bold text-foreground">Restore Database</h2>
                <p className="text-xs text-muted-foreground">
                  Validasi integritas checksum SHA-256 dan pemulihan data atomik.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pilih file cadangan JSON untuk memeriksa kelayakan data sebelum ditimpa ke penyimpanan lokal tablet.
            </p>
          </div>

          <div className="pt-2">
            {canRestore ? (
              <label className="w-full h-9 px-4 border border-input hover:bg-muted text-foreground text-xs font-semibold rounded-pill flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs">
                <Upload className="size-3.5 text-muted-foreground" />
                <span>Pilih Berkas Backup (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="w-full h-9 px-4 border border-border bg-muted/50 text-muted-foreground text-xs font-medium rounded-pill flex items-center justify-center gap-2 cursor-not-allowed">
                <span>Restore hanya diizinkan untuk Pemilik Toko (Owner)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restore Preview & Confirmation Box */}
      {validationResult && validationResult.valid && validationResult.manifest && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-card space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
            <FileCheck className="size-4 text-amber-700" />
            <span>Validasi Berkas Backup Lolos (SHA-256 Cocok)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-foreground">
            <div>Aplikasi: <strong>{validationResult.manifest.app}</strong></div>
            <div>Versi: <strong>{validationResult.manifest.app_version}</strong></div>
            <div>Tanggal: <strong>{new Date(validationResult.manifest.created_at).toLocaleString('id-ID')}</strong></div>
            <div>Checksum: <strong className="font-mono text-[10px]">{validationResult.manifest.checksum_sha256.substring(0, 12)}...</strong></div>
          </div>

          <div className="text-xs text-muted-foreground">
            Jumlah Record: {Object.entries(validationResult.manifest.table_counts).map(([tbl, cnt]) => `${tbl} (${cnt})`).join(', ')}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-amber-500/20">
            <button
              onClick={() => {
                setSelectedFileContent(null);
                setValidationResult(null);
              }}
              className="h-8 px-4 rounded-pill border border-input hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => setShowConfirmRestore(true)}
              className="h-8 px-4 rounded-pill bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <AlertTriangle className="size-3.5" />
              <span>Lanjutkan Restore Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirm Destructive Restore Modal */}
      {showConfirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-card shadow-2xl border border-border w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive-foreground">
              <div className="size-9 rounded-pill bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 text-destructive-text" />
              </div>
              <h3 className="text-base font-serif font-bold text-foreground">
                Konfirmasi Restore Database
              </h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Peringatan:</strong> Pemulihan database bersifat destruktif. Seluruh data transaksi, produk, dan saldo stok saat ini akan <strong>ditimpa sepenuhnya</strong> oleh data dari berkas backup. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowConfirmRestore(false)}
                disabled={isRestoring}
                className="h-8 px-4 rounded-pill border border-input hover:bg-muted text-xs font-medium text-foreground transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="h-8 px-4 rounded-pill bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
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

      {/* Unified Backup History Table Card */}
      <div className="bg-card border border-border rounded-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h3 className="text-xs font-serif font-bold text-foreground">
              Riwayat Berkas Backup
            </h3>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-pill bg-muted text-muted-foreground border border-border/50">
              {history.length} arsip
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Nama Berkas</th>
                <th className="px-3 py-3">Waktu</th>
                <th className="px-3 py-3">Ukuran</th>
                <th className="px-3 py-3">Checksum SHA-256</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada riwayat backup tercatat.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{h.file_name}</td>
                    <td className="px-3 py-3 text-muted-foreground font-mono text-[11px]">
                      {new Date(h.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground font-mono">
                      {h.size_bytes ? `${Math.round(h.size_bytes / 1024)} KB` : '-'}
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground">
                      {h.checksum_sha256?.substring(0, 16)}...
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold bg-success/20 border border-success/40 text-success-foreground">
                        <ShieldCheck className="size-3 text-emerald-600" />
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
