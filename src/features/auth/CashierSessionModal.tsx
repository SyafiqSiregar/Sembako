import React, { useState } from 'react';
import { useAuthStore } from './authStore';
import { formatRupiah, parseRupiah } from '@/domain/money';
import { DollarSign, AlertTriangle, X } from 'lucide-react';

interface CashierSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'open' | 'close';
}

export const CashierSessionModal: React.FC<CashierSessionModalProps> = ({
  isOpen,
  onClose,
  mode,
}) => {
  const { activeSession, openSession, closeSession, error, clearError } = useAuthStore();
  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAmount = parseRupiah(amountText);

  // Quick preset buttons untuk modal awal
  const quickPresets = [0, 50000, 100000, 200000, 300000, 500000];

  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await openSession(currentAmount);
      onClose();
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await closeSession(currentAmount, notes);
      onClose();
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-modal-title"
    >
      <div className="bg-background border border-border w-full max-w-md rounded-card p-6 shadow-xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <DollarSign className="size-5" />
            </div>
            <div>
              <h2 id="session-modal-title" className="font-serif font-bold text-lg text-foreground">
                {mode === 'open' ? 'Buka Sesi Kasir Baru' : 'Tutup Sesi Kasir'}
              </h2>
              <span className="text-xs text-muted-foreground">
                {mode === 'open'
                  ? 'Masukkan saldo modal awal di laci kas'
                  : 'Hitung kas fisik aktual di laci'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Error message */}
        {(localError || error) && (
          <div className="text-xs text-destructive-text font-medium bg-destructive/15 p-3 rounded-card border border-destructive/20 flex items-start gap-2">
            <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        {mode === 'open' ? (
          <form onSubmit={handleOpenSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="openingCash" className="text-xs font-semibold text-foreground">
                Modal Awal Laci (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  Rp
                </span>
                <input
                  id="openingCash"
                  type="text"
                  inputMode="numeric"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  placeholder="0"
                  className="w-full h-12 pl-10 pr-4 bg-card border border-input rounded-card text-lg font-bold text-foreground tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
            </div>

            {/* Quick Nominal Presets */}
            <div className="grid grid-cols-3 gap-2">
              {quickPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountText(preset.toString())}
                  className="py-1.5 px-2 bg-muted hover:bg-accent text-xs font-medium text-foreground rounded-pill transition-colors text-center"
                >
                  {preset === 0 ? 'Rp 0' : formatRupiah(preset)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-pill border border-input text-xs font-semibold text-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover shadow-sm disabled:opacity-50"
              >
                Buka Sesi Kasir
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCloseSubmit} className="flex flex-col gap-4">
            {activeSession && (
              <div className="bg-muted/60 p-3 rounded-card text-xs flex justify-between items-center">
                <span className="text-muted-foreground">Modal Awal Sesi:</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatRupiah(activeSession.opening_cash)}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="closingCash" className="text-xs font-semibold text-foreground">
                Total Uang Tunai Fisik di Laci (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  Rp
                </span>
                <input
                  id="closingCash"
                  type="text"
                  inputMode="numeric"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  placeholder="0"
                  className="w-full h-12 pl-10 pr-4 bg-card border border-input rounded-card text-lg font-bold text-foreground tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="notes" className="text-xs font-semibold text-foreground">
                Catatan Penutupan Kas (Wajib jika ada selisih)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tuliskan keterangan jika ada kelebihan / kekurangan uang fisik..."
                rows={2}
                className="w-full p-2.5 bg-card border border-input rounded-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-pill border border-input text-xs font-semibold text-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-pill bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 shadow-sm disabled:opacity-50"
              >
                Tutup Sesi Kasir
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
