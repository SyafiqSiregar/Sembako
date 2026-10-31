import React, { useEffect, useMemo, useState } from 'react';
import { Printer, CheckCircle, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { type CheckoutResult } from '@/services/checkout.service';
import { formatRupiah } from '@/domain/money';
import { printHtmlDocument } from '@/lib/print';
import {
  buildReceiptHtml,
  buildReceiptLines,
  type ReceiptPayload,
} from '@/services/receipt.service';
import type { PaperWidth, StoreSettings } from '@/services/settings.service';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutResult: CheckoutResult | null;
  cashierName?: string;
  store: StoreSettings;
}

// Lebar pratinjau = jumlah kolom struk (32/48), sehingga identik dengan hasil cetak.
const PREVIEW_WIDTH: Record<PaperWidth, string> = {
  '58mm': 'w-[32ch]',
  '80mm': 'w-[48ch]',
};

const PAPER_OPTIONS: { value: PaperWidth; label: string }[] = [
  { value: '58mm', label: 'Kertas 58 mm' },
  { value: '80mm', label: 'Kertas 80 mm' },
];

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  checkoutResult,
  cashierName = 'Kasir',
  store,
}) => {
  // Pilihan di sini hanya untuk cetakan ini; bawaan toko diubah di Pengaturan.
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(store.defaultPaperWidth);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPaperWidth(store.defaultPaperWidth);
      setPrintError(null);
    }
  }, [isOpen, store.defaultPaperWidth]);

  const payload = useMemo<ReceiptPayload | null>(() => {
    if (!checkoutResult) return null;
    return {
      sale: checkoutResult.sale,
      items: checkoutResult.items,
      payment: checkoutResult.payment,
      cashierName,
      store,
      paperWidth,
    };
  }, [checkoutResult, cashierName, store, paperWidth]);

  if (!isOpen || !checkoutResult || !payload) return null;

  const lines = buildReceiptLines(payload);

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintError(null);
    try {
      await printHtmlDocument(buildReceiptHtml(payload));
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Gagal membuka dialog cetak.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="bg-card rounded-card shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header sukses */}
        <div className="bg-primary text-primary-foreground p-5 text-center flex flex-col items-center">
          <div className="size-12 rounded-full bg-primary-foreground/15 flex items-center justify-center mb-2">
            <CheckCircle className="size-7" aria-hidden="true" />
          </div>
          <h2 id="receipt-modal-title" className="text-xl font-serif font-bold">
            Pembayaran Berhasil
          </h2>
          <p className="text-xs text-primary-foreground/80 mt-1 tabular-nums">
            Struk #{checkoutResult.sale.receipt_no} &bull; Total {formatRupiah(checkoutResult.sale.total)}
          </p>

          <div
            role="radiogroup"
            aria-label="Lebar kertas struk"
            className="flex gap-1 mt-3 bg-primary-hover p-1 rounded-pill text-xs"
          >
            {PAPER_OPTIONS.map((opt) => {
              const active = paperWidth === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPaperWidth(opt.value)}
                  className={`min-h-[36px] px-4 rounded-pill font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-primary-foreground/80 hover:text-primary-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pratinjau kertas thermal */}
        <div className="p-5 overflow-y-auto bg-muted flex-1 flex justify-center">
          <div
            className={`bg-card text-foreground border border-border shadow-sm p-3 font-mono text-xs leading-snug ${PREVIEW_WIDTH[paperWidth]} box-content`}
            aria-label={`Pratinjau struk ${paperWidth}`}
          >
            {lines.map((line, i) => (
              <div key={i} className={`whitespace-pre ${line.bold ? 'font-bold' : ''}`}>
                {line.text || '\u00a0'}
              </div>
            ))}
          </div>
        </div>

        {printError && (
          <div
            role="alert"
            className="mx-4 mt-3 p-3 rounded-card bg-destructive text-destructive-foreground border border-destructive-foreground/25 text-xs font-semibold flex items-start gap-2"
          >
            <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{printError}</span>
          </div>
        )}

        {/* Aksi */}
        <div className="p-4 bg-card border-t border-border flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 min-h-[44px] px-4 rounded-pill border border-input bg-card hover:bg-muted active:scale-[0.98] font-semibold text-foreground text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isPrinting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Printer className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            <span>{isPrinting ? 'Membuka cetak...' : 'Cetak Struk'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 rounded-pill bg-primary hover:bg-primary-hover active:scale-[0.98] font-bold text-primary-foreground text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            <span>Transaksi Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
};
