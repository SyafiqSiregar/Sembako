import React, { useState, useEffect } from 'react';
import {
  X,
  DollarSign,
  CreditCard,
  AlertCircle,
  Loader2,
  QrCode,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { formatRupiah } from '@/domain/money';

export type NonCashChannel = 'qris' | 'transfer' | 'debit';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirmPayment: (
    paymentMethod: 'cash' | 'non_cash_manual',
    amountPaid: number,
    referenceNo?: string
  ) => Promise<void>;
}

const COMMON_BANKS = ['BCA', 'BRI', 'Mandiri', 'BNI', 'Lainnya'];

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  total,
  onConfirmPayment,
}) => {
  const [method, setMethod] = useState<'cash' | 'non_cash_manual'>('cash');
  const [nonCashChannel, setNonCashChannel] = useState<NonCashChannel>('qris');
  const [selectedBank, setSelectedBank] = useState<string>('BCA');
  const [referenceInput, setReferenceInput] = useState<string>('');
  const [isVerified, setIsVerified] = useState<boolean>(true);

  const [amountPaid, setAmountPaid] = useState<number>(total);
  const [inputStr, setInputStr] = useState<string>(total.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sinkronisasi saat dialog dibuka atau total berubah
  useEffect(() => {
    if (isOpen) {
      setAmountPaid(total);
      setInputStr(total.toString());
      setErrorMessage(null);
      setIsSubmitting(false);
      setReferenceInput('');
      setIsVerified(true);
    }
  }, [isOpen, total]);

  if (!isOpen) return null;

  const change = Math.max(0, amountPaid - total);
  const shortage = Math.max(0, total - amountPaid);
  const isSufficient = method === 'cash' ? amountPaid >= total : isVerified;

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

  const buildReferenceNo = (): string | undefined => {
    const trimmed = referenceInput.trim();
    if (nonCashChannel === 'qris') {
      return trimmed ? `QRIS - Ref: ${trimmed}` : 'QRIS Manual';
    }
    if (nonCashChannel === 'transfer') {
      return trimmed ? `Transfer ${selectedBank} - ${trimmed}` : `Transfer ${selectedBank}`;
    }
    if (nonCashChannel === 'debit') {
      return trimmed ? `Debit/EDC - Ref: ${trimmed}` : 'Debit/EDC Manual';
    }
    return undefined;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (method === 'cash') {
      if (amountPaid < total) {
        setErrorMessage(`Uang pembayaran kurang ${formatRupiah(shortage)}`);
        return;
      }
    } else {
      if (!isVerified) {
        setErrorMessage('Silakan konfirmasi verifikasi bahwa dana non-tunai telah masuk');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (method === 'cash') {
        await onConfirmPayment('cash', amountPaid);
      } else {
        const refNo = buildReferenceNo();
        await onConfirmPayment('non_cash_manual', total, refNo);
      }
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Dialog */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between shrink-0">
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
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 bg-[#FBF8F3] overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Display Total Belanja */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 text-center shadow-sm">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Total Harus Dibayar
            </span>
            <div className="text-3xl font-bold text-[#14463C] mt-1 tracking-tight font-mono">
              {formatRupiah(total)}
            </div>
          </div>

          {/* Pilihan Metode Pembayaran Utama */}
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
                  setErrorMessage(null);
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  method === 'cash'
                    ? 'border-[#14463C] bg-emerald-50 text-[#14463C] ring-2 ring-[#14463C]/20 shadow-xs'
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
                  setErrorMessage(null);
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  method === 'non_cash_manual'
                    ? 'border-[#14463C] bg-emerald-50 text-[#14463C] ring-2 ring-[#14463C]/20 shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Non-Tunai Manual
              </button>
            </div>
          </div>

          {/* ======================================================= */}
          {/* BAGIAN A: PEMBAYARAN TUNAI (CASH)                       */}
          {/* ======================================================= */}
          {method === 'cash' && (
            <div className="space-y-3 pt-1">
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
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-300 rounded-xl font-bold text-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C] focus:border-transparent transition font-mono"
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
                    className="py-2.5 px-2 text-xs font-medium rounded-lg bg-white border border-stone-200 hover:border-[#14463C] hover:bg-emerald-50/50 text-stone-700 transition"
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
                  className={`text-2xl font-bold mt-0.5 tracking-tight font-mono ${
                    isSufficient ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {isSufficient ? formatRupiah(change) : `- ${formatRupiah(shortage)}`}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* BAGIAN B: PEMBAYARAN NON-TUNAI MANUAL (QRIS / TRANSFER) */}
          {/* ======================================================= */}
          {method === 'non_cash_manual' && (
            <div className="space-y-4 pt-1">
              {/* Sub-Pilihan Saluran Non-Tunai */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  Saluran Pembayaran Non-Tunai
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNonCashChannel('qris')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition ${
                      nonCashChannel === 'qris'
                        ? 'border-[#14463C] bg-emerald-50 text-[#14463C] ring-2 ring-[#14463C]/20 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-emerald-700" />
                    <span>QRIS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNonCashChannel('transfer')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition ${
                      nonCashChannel === 'transfer'
                        ? 'border-[#14463C] bg-emerald-50 text-[#14463C] ring-2 ring-[#14463C]/20 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-emerald-700" />
                    <span>Transfer Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNonCashChannel('debit')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition ${
                      nonCashChannel === 'debit'
                        ? 'border-[#14463C] bg-emerald-50 text-[#14463C] ring-2 ring-[#14463C]/20 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-emerald-700" />
                    <span>Debit / Lainnya</span>
                  </button>
                </div>
              </div>

              {/* Detail Saluran: QRIS */}
              {nonCashChannel === 'qris' && (
                <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                    <QrCode className="w-4 h-4 text-[#14463C]" />
                    <span>Instruksi QRIS Toko</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Arahkan pembeli untuk memindai QRIS statis / stiker toko sebesar{' '}
                    <strong className="text-stone-900 font-mono">{formatRupiah(total)}</strong>.
                  </p>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Nomor Referensi RRN / Nama Pembayar (Opsional)
                    </label>
                    <input
                      type="text"
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      placeholder="Contoh: RRN 982143 atau An. Budi"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14463C]"
                    />
                  </div>
                </div>
              )}

              {/* Detail Saluran: Transfer Bank */}
              {nonCashChannel === 'transfer' && (
                <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                    <Building2 className="w-4 h-4 text-[#14463C]" />
                    <span>Pilih Bank Tujuan</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {COMMON_BANKS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBank(b)}
                        className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold text-center transition ${
                          selectedBank === b
                            ? 'border-[#14463C] bg-emerald-50 text-[#14463C]'
                            : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Nama Rekening Pengirim / Catatan Bukti (Opsional)
                    </label>
                    <input
                      type="text"
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      placeholder="Contoh: An. Siti Rahma / Ref 12345"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14463C]"
                    />
                  </div>
                </div>
              )}

              {/* Detail Saluran: Debit / EDC */}
              {nonCashChannel === 'debit' && (
                <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                    <CreditCard className="w-4 h-4 text-[#14463C]" />
                    <span>Mesin EDC / Kartu Debit</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      No. Kartu (4 Digit Terakhir) / Nomor Trace EDC (Opsional)
                    </label>
                    <input
                      type="text"
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      placeholder="Contoh: Kartu ...4128 / Trace 00045"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14463C]"
                    />
                  </div>
                </div>
              )}

              {/* Checkbox Konfirmasi Verifikasi Kasir */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="mt-0.5 size-4 rounded text-[#14463C] focus:ring-[#14463C] border-stone-300"
                />
                <div className="text-xs">
                  <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    Konfirmasi Dana Masuk
                  </span>
                  <p className="text-emerald-800/90 text-[11px] mt-0.5">
                    Saya telah memastikan dana sebesar <strong>{formatRupiah(total)}</strong> berhasil masuk ke rekening / layar mutasi toko.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Tombol Konfirmasi Selesai */}
          <div className="pt-2 shrink-0">
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
