import React, { useState, useEffect } from 'react';
import { Store, ShieldCheck, CheckCircle, AlertTriangle, Loader2, Printer } from 'lucide-react';
import { SettingsService, type PaperWidth, type StoreSettings } from '@/services/settings.service';
import { buildReceiptTestHtml } from '@/services/receipt.service';
import { printHtmlDocument } from '@/lib/print';
import { useAuthStore } from '@/features/auth/authStore';

const PAPER_CHOICES: { value: PaperWidth; title: string; hint: string }[] = [
  { value: '58mm', title: 'Kertas 58 mm', hint: 'Printer kasir mini / Bluetooth portabel (32 kolom)' },
  { value: '80mm', title: 'Kertas 80 mm', hint: 'Printer kasir desktop standar (48 kolom)' },
];

interface StoreSettingsTabProps {
  settingsService: SettingsService;
}

export const StoreSettingsTab: React.FC<StoreSettingsTabProps> = ({ settingsService }) => {
  const { currentUser } = useAuthStore();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [testPrintError, setTestPrintError] = useState<string | null>(null);

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

  const handleTestPrint = async () => {
    if (!settings) return;
    setTestPrintError(null);
    setIsTestPrinting(true);
    try {
      await printHtmlDocument(buildReceiptTestHtml(settings, settings.defaultPaperWidth));
    } catch (err) {
      setTestPrintError(err instanceof Error ? err.message : 'Gagal membuka dialog cetak.');
    } finally {
      setIsTestPrinting(false);
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

        {/* Struk & Printer */}
        <fieldset className="pt-4 border-t border-border space-y-3">
          <legend className="font-bold text-foreground uppercase tracking-wider text-[11px] mb-1">
            Struk &amp; Printer
          </legend>

          <div role="radiogroup" aria-label="Lebar kertas struk bawaan" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAPER_CHOICES.map((choice) => {
              const active = settings.defaultPaperWidth === choice.value;
              return (
                <label
                  key={choice.value}
                  className={`min-h-[56px] p-3 rounded-card border flex items-start gap-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-ring ${
                    active ? 'bg-secondary border-primary/40' : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultPaperWidth"
                    value={choice.value}
                    checked={active}
                    onChange={() => setSettings({ ...settings, defaultPaperWidth: choice.value })}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span className="font-semibold text-foreground">{choice.title}</span>
                    <span className="text-[11px] text-muted-foreground">{choice.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showReturnPolicyOnReceipt}
              onChange={(e) => setSettings({ ...settings, showReturnPolicyOnReceipt: e.target.checked })}
              className="mt-0.5 accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-semibold text-foreground">Cantumkan batas retur di struk</span>
              <span className="text-[11px] text-muted-foreground">
                Mengikuti &ldquo;Batas Hari Retur&rdquo; di bawah. Tidak dicetak bila batas retur 0 hari.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTestPrinting}
              className="min-h-[44px] px-4 rounded-pill border border-input bg-card hover:bg-muted active:scale-[0.98] text-foreground text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isTestPrinting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span>{isTestPrinting ? 'Membuka cetak...' : 'Cetak Struk Uji'}</span>
            </button>
            <span className="text-[11px] text-muted-foreground">
              Mencetak penggaris kolom dan identitas toko. Bukan transaksi dan tidak disimpan.
            </span>
          </div>
          {testPrintError && (
            <div role="alert" className="p-3 rounded-card bg-destructive text-destructive-foreground text-xs font-semibold">
              {testPrintError}
            </div>
          )}
        </fieldset>

        {/* Kebijakan Toko */}
        <div className="pt-4 border-t border-border space-y-4">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
            Kebijakan & Batas Keamanan Operasional
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div>
              <label className="block font-semibold text-foreground mb-1 text-[11px]">
                Batas Hari Retur (Hari)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                value={settings.returnDaysLimit ?? 7}
                onChange={(e) => setSettings({ ...settings, returnDaysLimit: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-9 px-3.5 bg-background border border-input rounded-pill text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Maksimal hari setelah belanja</span>
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
