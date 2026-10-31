import React, { useEffect, useMemo, useState } from 'react';
import { Printer, CheckCircle, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { type CheckoutResult } from '@/services/checkout.service';
import { formatRupiah } from '@/domain/money';
import { printHtmlDocument } from '@/lib/print';
import { getCode128Bars } from '@/domain/barcode/code128';
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

  const barcodeLayout = useMemo(() => {
    if (!checkoutResult || store.printReceiptBarcode === false) return null;
    const moduleWidth = paperWidth === '58mm' ? 0.17 : 0.22;
    return getCode128Bars(checkoutResult.sale.receipt_no, moduleWidth);
  }, [checkoutResult, store.printReceiptBarcode, paperWidth]);

  const monogram = useMemo(() => {
    const words = store.storeName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'SB';
    if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }, [store.storeName]);

  const lines = useMemo(() => {
    return payload ? buildReceiptLines(payload) : [];
  }, [payload]);

  const handlePrint = async () => {
    if (!payload) return;
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

  if (!isOpen || !checkoutResult || !payload) return null;

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
        <div className="p-5 overflow-y-auto bg-stone-100 dark:bg-stone-900 flex-1 flex justify-center items-start">
          <div
            className={`bg-white text-black border border-stone-300 dark:border-stone-700 shadow-md p-3.5 font-mono text-xs leading-snug ${PREVIEW_WIDTH[paperWidth]} box-content relative select-text`}
            aria-label={`Pratinjau struk ${paperWidth}`}
          >
            {/* Header Visual: Logo atau Monogram Inisial */}
            {store.storeLogo ? (
              <div className="mb-2 text-center">
                <img
                  src={store.storeLogo}
                  alt="Logo Toko"
                  className="mx-auto max-h-12 max-w-[140px] object-contain filter grayscale contrast-150"
                />
              </div>
            ) : (
              <div className="mb-2 text-center">
                <span className="inline-block px-2 py-0.5 border border-black rounded text-[10px] font-bold tracking-widest font-mono">
                  [{monogram}]
                </span>
              </div>
            )}

            {/* Baris-baris struk */}
            {lines.map((line, i) => (
              <div key={i} className={`whitespace-pre ${line.bold ? 'font-bold' : ''}`}>
                {line.text || '\u00a0'}
              </div>
            ))}

            {/* Barcode Nomor Struk Code-128 */}
            {barcodeLayout && barcodeLayout.bars.length > 0 && (
              <div className="mt-3.5 pt-1 text-center flex flex-col items-center">
                <svg
                  viewBox={`0 0 ${barcodeLayout.totalWidthMm} 8`}
                  width={`${barcodeLayout.totalWidthMm}mm`}
                  height="8mm"
                  shapeRendering="crispEdges"
                  className="mx-auto block"
                >
                  {barcodeLayout.bars.map((bar, i) => (
                    <rect
                      key={i}
                      x={bar.xMm}
                      y={0}
                      width={bar.widthMm}
                      height={8}
                      fill="#000000"
                    />
                  ))}
                </svg>
                <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-wider mt-1 text-black select-all">
                  {barcodeLayout.text}
                </div>
              </div>
            )}
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
