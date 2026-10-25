import React, { useState, useEffect } from 'react';
import { Store, ShieldCheck, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { SettingsService, type StoreSettings } from '@/services/settings.service';
import { useAuthStore } from '@/features/auth/authStore';

interface StoreSettingsTabProps {
  settingsService: SettingsService;
}

export const StoreSettingsTab: React.FC<StoreSettingsTabProps> = ({ settingsService }) => {
  const { currentUser } = useAuthStore();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await settingsService.getStoreSettings();
        setSettings(data);
      } catch (err) {
        console.error('Error loading store settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [settingsService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setIsSaving(true);
      await settingsService.updateStoreSettings(settings, currentUser?.id || 'admin');
      setNotification({ type: 'success', message: 'Pengaturan toko berhasil disimpan' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 text-center text-xs text-stone-400">
        Memuat pengaturan toko...
      </div>
    );
  }

  return (
    <div className="max-w-2xl bg-card border border-border rounded-card p-6 shadow-sm space-y-6">
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

      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="size-9 rounded-pill bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Store className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-serif font-bold text-foreground">Identitas Toko & Struk Kasir</h2>
          <p className="text-xs text-muted-foreground">
            Informasi identitas toko yang dicetak pada struk thermal dan batas kebijakan operasional kasir.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
            Nama Toko *
          </label>
          <input
            type="text"
            value={settings.storeName}
            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
            className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
            Alamat Toko (Header Struk) *
          </label>
          <textarea
            rows={2}
            value={settings.storeAddress}
            onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
            className="w-full p-3 bg-background border border-input rounded-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
              Nomor Telepon Toko
            </label>
            <input
              type="text"
              value={settings.storePhone}
              onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
              className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground uppercase tracking-wider mb-1.5 text-[11px]">
              Catatan Kaki Struk
            </label>
            <input
              type="text"
              value={settings.receiptFooter}
              onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
              className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Kebijakan Toko */}
        <div className="pt-4 border-t border-border space-y-4">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
            Kebijakan & Batas Keamanan Operasional
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-foreground mb-1 text-[11px]">
                Batas Diskon Kasir (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.maxDiscountPercent}
                onChange={(e) => setSettings({ ...settings, maxDiscountPercent: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Di atas ini butuh Approval</span>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1 text-[11px]">
                Kunci Otomatis (Menit)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={settings.autoLockMinutes}
                onChange={(e) => setSettings({ ...settings, autoLockMinutes: parseInt(e.target.value, 10) || 15 })}
                className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Waktu idle sebelum terkunci</span>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1 text-[11px]">
                Peringatan Expiry (Hari)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.expiryWarningDays}
                onChange={(e) => setSettings({ ...settings, expiryWarningDays: parseInt(e.target.value, 10) || 30 })}
                className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Ambang masuk daftar H-30</span>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="h-9 px-5 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold rounded-pill flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="size-3.5 text-emerald-300" />
                <span>Simpan Pengaturan</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
