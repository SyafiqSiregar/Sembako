import React, { useState } from 'react';
import { Printer, CheckCircle, RefreshCw } from 'lucide-react';
import { type CheckoutResult } from '@/services/checkout.service';
import { formatRupiah } from '@/domain/money';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutResult: CheckoutResult | null;
  cashierName?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  checkoutResult,
  cashierName = 'Kasir',
  storeName = 'Toko Sembako Berkah',
  storeAddress = 'Jl. Pasar Tradisional No. 12',
  storePhone = '0812-3456-7890',
}) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');

  if (!isOpen || !checkoutResult) return null;

  const { sale, items, payment, change } = checkoutResult;
  const dateFormatted = new Date(sale.completed_at).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Sukses */}
        <div className="bg-[#14463C] text-white p-5 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center mb-2">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-serif font-bold">Pembayaran Berhasil!</h2>
          <p className="text-xs text-white/80 mt-1">Struk #{sale.receipt_no}</p>

          {/* Toggle Lebar Kertas */}
          <div className="flex gap-2 mt-3 bg-[#0F352E] p-1 rounded-lg text-xs">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1 rounded font-medium transition ${
                paperWidth === '58mm' ? 'bg-white text-[#14463C] shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              Kertas 58mm
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1 rounded font-medium transition ${
                paperWidth === '80mm' ? 'bg-white text-[#14463C] shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              Kertas 80mm
            </button>
          </div>
        </div>

        {/* Receipt Scroll Area */}
        <div className="p-6 overflow-y-auto bg-[#FBF8F3] flex-1 flex justify-center">
          <div
            id="receipt-print-area"
            className={`bg-white p-4 shadow-sm border border-stone-200 text-stone-900 font-mono text-xs leading-relaxed ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
          >
            {/* Header Toko */}
            <div className="text-center pb-3 border-b border-dashed border-stone-300">
              <div className="font-bold text-sm tracking-wide">{storeName}</div>
              <div className="text-[10px] text-stone-600">{storeAddress}</div>
              <div className="text-[10px] text-stone-600">Telp: {storePhone}</div>
            </div>

            {/* Info Transaksi */}
            <div className="py-2 border-b border-dashed border-stone-300 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>No:</span>
                <span className="font-bold">{sale.receipt_no}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{dateFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{cashierName}</span>
              </div>
            </div>

            {/* Daftar Item */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-2">
              {items.map((it) => {
                const qtyFormatted = it.factor_snapshot > 1 ? `${it.qty_base / it.factor_snapshot} ${it.unit_code_snapshot}` : `${it.qty_base} ${it.unit_code_snapshot}`;
                return (
                  <div key={it.id}>
                    <div className="font-semibold text-stone-800">{it.name_snapshot}</div>
                    <div className="flex justify-between text-stone-600 text-[11px]">
                      <span>
                        {qtyFormatted} x {formatRupiah(it.unit_price_snapshot)}
                      </span>
                      <span className="font-medium text-stone-900">{formatRupiah(it.line_total)}</span>
                    </div>
                    {it.discount > 0 && (
                      <div className="text-[10px] text-emerald-700 italic flex justify-between">
                        <span>Diskon</span>
                        <span>-{formatRupiah(it.discount)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ringkasan Biaya */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRupiah(sale.subtotal)}</span>
              </div>
              {sale.discount_total > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Diskon Transaksi</span>
                  <span>-{formatRupiah(sale.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-stone-200">
                <span>TOTAL</span>
                <span className="text-stone-900">{formatRupiah(sale.total)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Bayar ({payment.method === 'cash' ? 'Tunai' : 'Non-Tunai'})</span>
                <span>{formatRupiah(payment.amount)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Kembalian</span>
                <span className="text-emerald-800">{formatRupiah(change)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 text-center text-[10px] text-stone-500 space-y-1">
              <div>Barang yang dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian.</div>
              <div className="font-medium tracking-wider pt-1">TERIMA KASIH</div>
            </div>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="p-4 bg-white border-t border-stone-200 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 font-semibold text-stone-700 flex items-center justify-center gap-2 transition"
          >
            <Printer className="w-5 h-5 text-stone-500" />
            Cetak Struk
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-[#14463C] hover:bg-[#0F352E] font-bold text-white flex items-center justify-center gap-2 transition shadow-md"
          >
            <RefreshCw className="w-5 h-5 text-white/80" />
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
};
