import React, { useState } from 'react';
import { X, DollarSign, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { formatRupiah } from '@/domain/money';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirmPayment: (paymentMethod: 'cash' | 'non_cash_manual', amountPaid: number) => Promise<void>;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  total,
  onConfirmPayment,
}) => {
  const [method, setMethod] = useState<'cash' | 'non_cash_manual'>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(total);
  const [inputStr, setInputStr] = useState<string>(total.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const change = Math.max(0, amountPaid - total);
  const shortage = Math.max(0, total - amountPaid);
  const isSufficient = amountPaid >= total;

  const handleQuickAmount = (val: number) => {
    setAmountPaid(val);
    setInputStr(val.toString());
    setErrorMessage(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const num = parseInt(raw, 10) || 0;
    setInputStr(raw);
    setAmountPaid(num);
    setErrorMessage(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSufficient) {
      setErrorMessage(`Uang pembayaran kurang ${formatRupiah(shortage)}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirmPayment(method, amountPaid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pembayaran';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  // Preset pecahan uang umum Rupiah
  const presets = [
    { label: 'Uang Pas', value: total },
    { label: 'Rp 20.000', value: 20000 },
    { label: 'Rp 50.000', value: 50000 },
    { label: 'Rp 100.000', value: 100000 },
    { label: 'Rp 200.000', value: 200000 },
    { label: 'Rp 500.000', value: 500000 },
  ].filter((p) => p.value >= total || p.label === 'Uang Pas');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header Dialog */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold">Pembayaran Kasir</h2>
              <p className="text-xs text-white/80">Selesaikan transaksi penjualan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 bg-[#FBF8F3]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Display Total Belanja */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 text-center shadow-sm">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Harus Dibayar</span>
            <div className="text-3xl font-bold text-[#14463C] mt-1 tracking-tight">
              {formatRupiah(total)}
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMethod('cash');
                  setAmountPaid(total);
                  setInputStr(total.toString());
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  method === 'cash'
                    ? 'border-[#14463C] bg-emerald-50 text-[#14463C] ring-2 ring-[#14463C]/20'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Tunai (Cash)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod('non_cash_manual');
                  setAmountPaid(total);
                  setInputStr(total.toString());
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  method === 'non_cash_manual'
                    ? 'border-[#14463C] bg-emerald-50 text-[#14463C] ring-2 ring-[#14463C]/20'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Non-Tunai Manual
              </button>
            </div>
          </div>

          {/* Input Uang Diterima (untuk tunai) */}
          {method === 'cash' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Uang Diterima (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-stone-400 text-lg">
                  Rp
                </span>
                <input
                  type="text"
                  autoFocus
                  inputMode="numeric"
                  value={inputStr ? parseInt(inputStr, 10).toLocaleString('id-ID') : ''}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-300 rounded-xl font-bold text-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C] focus:border-transparent transition"
                  placeholder="0"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {presets.slice(0, 6).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleQuickAmount(preset.value)}
                    className="py-2 px-2 text-xs font-medium rounded-lg bg-white border border-stone-200 hover:border-[#14463C] hover:bg-emerald-50/50 text-stone-700 transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Box Kembalian atau Peringatan Kurang */}
              <div
                className={`p-4 rounded-xl border text-center transition ${
                  isSufficient
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isSufficient ? 'Kembalian' : 'Kekurangan Uang'}
                </span>
                <div
                  className={`text-2xl font-bold mt-0.5 tracking-tight ${
                    isSufficient ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {isSufficient ? formatRupiah(change) : `- ${formatRupiah(shortage)}`}
                </div>
              </div>
            </div>
          )}

          {/* Tombol Konfirmasi Selesai */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isSufficient || isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition shadow-lg ${
                isSufficient && !isSubmitting
                  ? 'bg-[#14463C] text-white hover:bg-[#0F352E] cursor-pointer'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses Transaksi...
                </>
              ) : (
                `Selesaikan Pembayaran (${formatRupiah(total)})`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
