import React, { useState, useRef, useEffect } from 'react';
import {
  TEMPLATE_COLUMNS,
  parseCatalogImportText,
  generateExcelTemplateHtml,
  generateTsvSampleText,
  type ParsedProductRow,
} from '@/lib/csv';
import { CatalogService, type Category } from '@/services/catalog.service';
import { db } from '@/data/db';
import { formatRupiah } from '@/domain/money';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  X,
  Download,
  FileSpreadsheet,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Trash2,
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  currentUserId: string;
}

const GROUP_META: Array<{
  id: 'identitas' | 'eceran' | 'grosir' | 'stok';
  title: string;
  badgeText: string;
  badgeClass: string;
}> = [
  {
    id: 'identitas',
    title: 'A. Identitas Barang (Kolom 1 - 2)',
    badgeText: 'Wajib',
    badgeClass: 'bg-primary text-primary-foreground',
  },
  {
    id: 'eceran',
    title: 'B. Satuan & Harga Eceran (Kolom 3 - 6)',
    badgeText: 'Wajib',
    badgeClass: 'bg-primary text-primary-foreground',
  },
  {
    id: 'grosir',
    title: 'C. Kemasan Grosir / Dus (Kolom 7 - 10)',
    badgeText: 'Opsional',
    badgeClass: 'bg-info text-info-text',
  },
  {
    id: 'stok',
    title: 'D. Stok Awal & Kedaluwarsa (Kolom 11 - 14)',
    badgeText: 'Opsional',
    badgeClass: 'bg-warning text-warning-text',
  },
];

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
  currentUserId,
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showColumnGuide, setShowColumnGuide] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcelTemplate = () => {
    const html = '\uFEFF' + generateExcelTemplateHtml();
    triggerDownload(
      html,
      'template_katalog_sembako_os.xls',
      'application/vnd.ms-excel;charset=utf-8;'
    );
  };

  const handleParse = (text: string) => {
    setCsvContent(text);
    setImportSummary(null);
    setParsedRows(parseCatalogImportText(text));
  };

  const handleLoadSample = () => {
    handleParse(generateTsvSampleText());
  };

  const handleClear = () => {
    setCsvContent('');
    setParsedRows([]);
    setImportSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        handleParse(text);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setIsProcessing(true);
    setImportSummary(null);

    const catalogService = new CatalogService(db);
    const localCategories = [...categories];
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      try {
        let targetCategory = localCategories.find(
          (c) => c.name.toLowerCase() === row.categoryName.toLowerCase()
        );
        if (!targetCategory && row.categoryName.trim()) {
          targetCategory = await catalogService.createCategory({
            name: row.categoryName.trim(),
            createdBy: currentUserId,
          });
          localCategories.push(targetCategory);
        }

        const categoryId = targetCategory ? targetCategory.id : localCategories[0]?.id || 'default';
        const baseUnitCode = row.unitName.toLowerCase().slice(0, 5) || 'pcs';
        const unitsPayload = [
          {
            unitCode: baseUnitCode,
            name: row.unitName,
            conversionFactor: 1,
            price: row.price,
            costX10k: row.cost * 10000,
            isBase: true,
          },
        ];

        const barcodesPayload: Array<{ barcode: string; unitCode: string }> = [];
        if (row.barcode) {
          barcodesPayload.push({ barcode: row.barcode, unitCode: baseUnitCode });
        }

        if (row.hasWholesale && row.wholesaleUnitName && row.wholesaleFactor && row.wholesalePrice) {
          const wholesaleCode = row.wholesaleUnitName.toLowerCase().slice(0, 6) || 'pack';
          unitsPayload.push({
            unitCode: wholesaleCode,
            name: row.wholesaleUnitName,
            conversionFactor: row.wholesaleFactor,
            price: row.wholesalePrice,
            costX10k: row.cost * row.wholesaleFactor * 10000,
            isBase: false,
          });
          if (row.wholesaleBarcode) {
            barcodesPayload.push({ barcode: row.wholesaleBarcode, unitCode: wholesaleCode });
          }
        }

        await catalogService.createProduct({
          name: row.name,
          categoryId,
          baseUnitKind: 'count',
          baseUnitCode,
          minStockBase: row.minStock,
          trackExpiry: row.trackExpiry,
          createdBy: currentUserId,
          units: unitsPayload,
          barcodes: barcodesPayload.length > 0 ? barcodesPayload : undefined,
          initialStockBase: row.initialStock && row.initialStock > 0 ? row.initialStock : undefined,
          initialExpiryDate:
            row.trackExpiry && row.initialStock && row.initialStock > 0
              ? row.initialExpiryDate
              : undefined,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsProcessing(false);
    setImportSummary(
      `Selesai: ${successCount} produk berhasil disimpan ke katalog${failCount > 0 ? `, ${failCount} dilewati karena barcode sudah terdaftar` : ''}.`
    );
    if (successCount > 0) {
      onSuccess();
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-title"
    >
      <div className="bg-background border border-border w-full max-w-4xl rounded-card p-5 sm:p-6 shadow-2xl flex flex-col gap-4 my-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
              <UploadCloud className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="csv-import-title" className="font-serif font-bold text-lg text-foreground">
                Impor Katalog Barang dari Excel / CSV
              </h2>
              <p className="text-xs text-muted-foreground">
                Masukkan daftar barang eceran, kemasan dus/grosir, dan stok awal sekaligus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog impor"
            className="size-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="bg-secondary/60 border border-border rounded-card p-4 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="size-4 text-primary" aria-hidden="true" />
                <span>Langkah 1: Unduh Template Excel Resmi atau Pilih Berkas</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Unduh <strong>Template Excel (.xls)</strong> yang sudah rapi dan berwarna. Setelah diisi, langsung unggah kembali atau konversi ke CSV.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadExcelTemplate}
                className="min-h-[38px] px-4 py-2 rounded-pill bg-primary text-primary-foreground font-semibold hover:bg-primary-hover shadow-xs flex items-center gap-1.5 text-xs transition"
              >
                <Download className="size-3.5" aria-hidden="true" />
                <span>Unduh Template Excel (.xls)</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[38px] px-4 py-2 rounded-pill border border-primary bg-card text-primary font-semibold hover:bg-accent transition text-xs flex items-center gap-1.5"
              >
                <UploadCloud className="size-3.5" aria-hidden="true" />
                <span>Pilih File (.xls / .csv)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border/70 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowColumnGuide((prev) => !prev)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
            >
              <HelpCircle className="size-3.5" aria-hidden="true" />
              <span>
                {showColumnGuide
                  ? 'Sembunyikan Panduan Struktur 14 Kolom'
                  : 'Lihat Panduan Struktur 14 Kolom & Contoh Pengisian'}
              </span>
              {showColumnGuide ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
               Baris judul & petunjuk di dalam template akan dilewati otomatis saat impor
            </span>
          </div>

          {showColumnGuide && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-xs">
              {GROUP_META.map((grp) => {
                const cols = TEMPLATE_COLUMNS.filter((c) => c.group === grp.id);
                return (
                  <div key={grp.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{grp.title}</span>
                      <span className={`px-2 py-0.5 rounded-pill text-[10px] font-semibold ${grp.badgeClass}`}>
                        {grp.badgeText}
                      </span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {cols.map((col, idx) => (
                        <div key={col.key} className="py-1.5 flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-foreground">
                              {idx + 1}. {col.label}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{col.hint}</div>
                          </div>
                          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground font-mono shrink-0">
                            {col.example}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {importSummary && (
          <div className="p-3 bg-success text-success-text text-xs rounded-card border border-border font-semibold flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span>{importSummary}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="csv-paste-area" className="text-xs font-semibold text-foreground">
              Langkah 2: Atau Blok Sel di Excel lalu Copy-Paste (Ctrl+C lalu Ctrl+V) di Bawah:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-2.5 py-1 rounded-pill bg-muted hover:bg-accent text-foreground text-[11px] font-semibold flex items-center gap-1 transition"
              >
                <ClipboardPaste className="size-3" aria-hidden="true" />
                <span>Muat 3 Contoh Barang</span>
              </button>
              {csvContent && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1 rounded-pill bg-destructive/15 text-destructive-text text-[11px] font-semibold flex items-center gap-1 transition"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                  <span>Bersihkan</span>
                </button>
              )}
            </div>
          </div>
          <textarea
            id="csv-paste-area"
            value={csvContent}
            onChange={(e) => handleParse(e.target.value)}
            placeholder="Salin (Copy) baris barang langsung dari tabel Excel atau tempel isi CSV di sini..."
            rows={3}
            className="w-full p-3 bg-card border border-input rounded-card text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {parsedRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground">
                Langkah 3: Pratinjau & Validasi Data ({parsedRows.length} baris barang terdeteksi)
              </span>
              <div className="flex items-center gap-3">
                <span className="text-success-text font-semibold flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" /> {validCount} siap diimpor
                </span>
                {invalidCount > 0 && (
                  <span className="text-destructive-text font-semibold flex items-center gap-1">
                    <AlertTriangle className="size-3.5" aria-hidden="true" /> {invalidCount} perlu diperbaiki
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-x-auto overflow-y-auto border border-border rounded-card bg-card">
              <table className="w-full text-left text-xs min-w-[740px]" aria-label="Pratinjau impor barang">
                <thead className="sticky top-0 bg-muted text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-2.5 w-14">Baris</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Nama Barang & Barcode</th>
                    <th className="p-2.5">Kategori</th>
                    <th className="p-2.5 text-right">Modal / Jual Eceran</th>
                    <th className="p-2.5 text-right">Grosir / Dus</th>
                    <th className="p-2.5 text-right">Stok Awal & ED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.map((r, idx) => (
                    <tr key={idx} className={r.isValid ? 'hover:bg-accent/30' : 'bg-destructive/10'}>
                      <td className="p-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                        #{r.rowNumber}
                      </td>
                      <td className="p-2.5">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-text">
                            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" /> Siap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive-text">
                            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" /> {r.errorReason}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold text-foreground">{r.name || 'Nama kosong'}</div>
                        {r.barcode && (
                          <div className="text-[11px] font-mono text-muted-foreground">BC: {r.barcode}</div>
                        )}
                      </td>
                      <td className="p-2.5 text-muted-foreground">{r.categoryName || 'Umum'}</td>
                      <td className="p-2.5 text-right tabular-nums">
                        <div className="font-semibold text-foreground">
                          {formatRupiah(r.price)} / {r.unitName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Modal: {formatRupiah(r.cost)}
                        </div>
                      </td>
                      <td className="p-2.5 text-right tabular-nums">
                        {r.hasWholesale ? (
                          <div>
                            <div className="font-semibold text-primary">
                              {r.wholesaleUnitName} (x{r.wholesaleFactor}): {formatRupiah(r.wholesalePrice || 0)}
                            </div>
                            {r.wholesaleBarcode && (
                              <div className="text-[11px] font-mono text-muted-foreground">
                                BC: {r.wholesaleBarcode}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Tanpa grosir</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right tabular-nums">
                        {r.initialStock ? (
                          <div>
                            <div className="font-semibold text-foreground">
                              {r.initialStock} {r.unitName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {r.trackExpiry ? `ED: ${r.initialExpiryDate || 'Wajib diisi'}` : 'Non-ED'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Stok 0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-pill border border-input text-xs font-semibold text-foreground hover:bg-muted transition"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={isProcessing || validCount === 0}
            onClick={handleExecuteImport}
            className="min-h-[40px] px-6 py-2 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition"
          >
            {isProcessing && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            <span>Impor {validCount} Barang Valid</span>
          </button>
        </div>
      </div>
    </div>
  );
};
