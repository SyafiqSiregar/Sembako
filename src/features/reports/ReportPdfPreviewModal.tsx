import React, { useEffect } from 'react';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  X,
  CheckCircle2,
} from 'lucide-react';
import type { ReportExportPayload } from '@/services/report.service';

interface ReportPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: ReportExportPayload;
  onPrintOrSavePdf: () => void;
  onDownloadExcel: () => void;
}

export const ReportPdfPreviewModal: React.FC<ReportPdfPreviewModalProps> = ({
  isOpen,
  onClose,
  payload,
  onPrintOrSavePdf,
  onDownloadExcel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-modal-title"
    >
      <div className="bg-background border border-border rounded-card shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-card border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-accent text-primary flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="pdf-preview-modal-title"
                className="font-serif text-base font-bold text-foreground truncate"
              >
                Pratinjau Dokumen Laporan PDF (A4)
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {payload.reportTitle} &bull; Periode: {payload.periodLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau PDF"
            className="w-10 h-10 rounded-full border border-input/80 bg-card hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Helper Banner */}
        <div className="px-5 py-2.5 bg-accent/60 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs text-accent-foreground shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong>Siap disimpan sebagai PDF:</strong> Klik tombol{' '}
              <strong>Simpan PDF / Cetak A4</strong> di kanan bawah, lalu pilih{' '}
              <strong>&quot;Simpan sebagai PDF&quot; (Save as PDF)</strong> pada jendela cetak.
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-pill bg-card/80 border border-border text-[11px] font-semibold text-foreground tabular-nums">
            {payload.rows.length} baris data
          </span>
        </div>

        {/* Scrollable A4 Paper Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/60">
          <div className="bg-white text-[#12202B] border border-[#D9D3C5] rounded-2xl shadow-md mx-auto max-w-[780px] p-5 sm:p-8">
            {/* Kop Toko & Judul Dokumen */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 mb-4 border-b-2 border-[#14463C]">
              <div>
                <h3 className="text-lg font-extrabold text-[#14463C] tracking-tight">
                  {payload.storeName}
                </h3>
                <p className="text-xs text-[#5E646B] mt-0.5">
                  {payload.storeAddress} &bull; Telp: {payload.storePhone}
                </p>
              </div>
              <div className="sm:text-right">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#E8F0EC] text-[#14463C] text-[10px] font-extrabold uppercase tracking-wider mb-1">
                  Dokumen Laporan Resmi
                </span>
                <div className="text-sm font-extrabold text-[#12202B]">
                  {payload.reportTitle}
                </div>
                <div className="text-xs text-[#5E646B]">
                  Periode: <strong className="text-[#12202B]">{payload.periodLabel}</strong>
                </div>
              </div>
            </div>

            {/* 4 Kotak Ringkasan Eksekutif */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {payload.kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-[#FAF8F4] border border-[#D9D3C5] rounded-xl p-2.5"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5E646B]">
                    {kpi.label}
                  </div>
                  <div className="text-sm font-extrabold text-[#12202B] tabular-nums mt-0.5">
                    {kpi.value}
                  </div>
                  <div className="text-[10px] font-semibold text-[#14463C] mt-0.5">
                    {kpi.subtext}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabel Laporan */}
            <div className="overflow-x-auto border border-[#D9D3C5] rounded-xl mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#14463C] text-white">
                    {payload.columns.map((col, idx) => (
                      <th
                        key={idx}
                        className={`px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider border border-[#14463C] ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E1D6]">
                  {payload.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={payload.columns.length}
                        className="px-4 py-8 text-center text-[#5E646B] italic"
                      >
                        Tidak ada data pada periode laporan ini.
                      </td>
                    </tr>
                  ) : (
                    payload.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAF8F4]'}
                      >
                        {payload.columns.map((col, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 border-x border-[#E6E1D6] text-[#12202B] ${
                              col.align === 'right'
                                ? 'text-right tabular-nums whitespace-nowrap font-medium'
                                : col.align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            }`}
                          >
                            {row[cIdx] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {payload.footerRow && (
                  <tfoot>
                    <tr className="bg-[#E8F0EC] text-[#12202B] font-extrabold border-t-2 border-[#14463C]">
                      {payload.columns.map((col, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-3 py-2.5 border-x border-[#D9D3C5] ${
                            col.align === 'right'
                              ? 'text-right tabular-nums whitespace-nowrap'
                              : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                          }`}
                        >
                          {payload.footerRow?.[cIdx] ?? ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Kolom Pengesahan & Tanda Tangan */}
            <div className="flex items-start justify-between gap-4 pt-2 pb-4 text-xs text-[#12202B]">
              <div className="w-44 text-center">
                <div className="font-bold text-[#5E646B] mb-12">
                  Disiapkan / Dicetak Oleh
                </div>
                <div className="border-t border-[#12202B] pt-1 font-bold">
                  {payload.printedBy}
                </div>
              </div>
              <div className="w-44 text-center">
                <div className="font-bold text-[#5E646B] mb-12">
                  Diperiksa &amp; Disetujui Oleh
                </div>
                <div className="border-t border-[#12202B] pt-1 font-bold">
                  Pemilik Toko
                </div>
              </div>
            </div>

            {/* Footer Waktu Cetak */}
            <div className="pt-3 border-t border-dashed border-[#D9D3C5] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5E646B]">
              <span>Dicetak otomatis dari sistem kasir &amp; inventaris SembakoOS</span>
              <span>Waktu cetak: {payload.printedAtLabel}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-card border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onDownloadExcel}
            className="min-h-[42px] px-4 py-2 rounded-pill border border-primary/35 bg-secondary/80 hover:bg-accent active:scale-[0.98] text-primary text-xs font-bold inline-flex items-center justify-center gap-2 transition-all duration-150 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
            <span>Unduh Versi Excel (.xls)</span>
          </button>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-5 py-2 rounded-pill border border-input bg-card hover:bg-muted active:scale-[0.98] text-foreground text-xs font-semibold inline-flex items-center justify-center transition-all duration-150 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={onPrintOrSavePdf}
              className="min-h-[42px] px-5 py-2 rounded-pill bg-primary hover:bg-primary-hover active:scale-[0.98] text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Simpan PDF / Cetak A4</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
