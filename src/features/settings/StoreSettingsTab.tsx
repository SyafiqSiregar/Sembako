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
    <div className="max-w-2xl bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-6">
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

      <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
        <div className="p-2.5 bg-emerald-50 rounded-xl text-[#14463C]">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-stone-900">Identitas Toko & Struk Kasir</h2>
          <p className="text-xs text-stone-500">
            Informasi identitas toko yang dicetak pada struk thermal dan batas kebijakan operasional (FR-SET-01..03)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
            Nama Toko *
          </label>
          <input
            type="text"
            value={settings.storeName}
            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-[#14463C]"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
            Alamat Toko (Header Struk) *
          </label>
          <textarea
            rows={2}
            value={settings.storeAddress}
            onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-[#14463C]"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Nomor Telepon Toko
            </label>
            <input
              type="text"
              value={settings.storePhone}
              onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Catatan Kaki Struk
            </label>
            <input
              type="text"
              value={settings.receiptFooter}
              onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-[#14463C]"
            />
          </div>
        </div>

        {/* Kebijakan Toko */}
        <div className="pt-4 border-t border-stone-100 space-y-4">
          <h3 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
            Kebijakan & Batas Keamanan Operasional
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Batas Diskon Kasir (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.maxDiscountPercent}
                onChange={(e) => setSettings({ ...settings, maxDiscountPercent: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-bold"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">Di atas ini butuh Approval</span>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Kunci Otomatis (Menit)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={settings.autoLockMinutes}
                onChange={(e) => setSettings({ ...settings, autoLockMinutes: parseInt(e.target.value, 10) || 15 })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-bold"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">Waktu idle sebelum terkunci</span>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Peringatan Expiry (Hari)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.expiryWarningDays}
                onChange={(e) => setSettings({ ...settings, expiryWarningDays: parseInt(e.target.value, 10) || 30 })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-bold"
              />
              <span className="text-[10px] text-stone-500 mt-0.5 block">Ambang masuk daftar H-30</span>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#14463C] hover:bg-[#0F352E] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Simpan Pengaturan</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
