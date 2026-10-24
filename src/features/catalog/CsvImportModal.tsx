import React, { useState } from 'react';
import { parseCsv } from '@/lib/csv';
import { CatalogService, type Category } from '@/services/catalog.service';
import { db } from '@/data/db';
import { formatRupiah, parseRupiah } from '@/domain/money';
import { UploadCloud, CheckCircle2, AlertTriangle, X, FileText, Loader2 } from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  currentUserId: string;
}

interface ParsedProductRow {
  name: string;
  sku?: string;
  categoryName: string;
  unitName: string;
  price: number;
  cost: number;
  barcode?: string;
  minStock: number;
  trackExpiry: boolean;
  isValid: boolean;
  errorReason?: string;
}

const CSV_TEMPLATE = `nama,sku,kategori,satuan,harga_jual,harga_modal,barcode,stok_minimum,lacak_kedaluwarsa
Beras Pandan Wangi 5 kg,BRS-002,Beras & Biji,Sak,78000,70000,8991112223334,5,ya
Minyak Goreng Bimoli 2 L,MYK-002,Minyak & Margarin,Pouch,36000,32000,8992223334445,10,ya
Tepung Segitiga Biru 1 kg,TPG-001,Bumbu & Tepung,Bungkus,13000,11000,8993334445556,10,tidak`;

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
  const [importSummary, setImportSummary] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setCsvContent(text);
    setImportSummary(null);

    const rows = parseCsv(text);
    if (rows.length <= 1) {
      setParsedRows([]);
      return;
    }

    const dataRows = rows.slice(1);

    const results: ParsedProductRow[] = dataRows.map((cols) => {
      const name = cols[0] || '';
      const sku = cols[1] || '';
      const categoryName = cols[2] || '';
      const unitName = cols[3] || 'Pcs';
      const price = parseRupiah(cols[4] || '0');
      const cost = parseRupiah(cols[5] || '0');
      const barcode = cols[6] || '';
      const minStock = parseInt(cols[7] || '5', 10) || 5;
      const trackExpiry = (cols[8] || '').toLowerCase() === 'ya' || (cols[8] || '') === '1';

      let isValid = true;
      let errorReason = '';

      if (!name) {
        isValid = false;
        errorReason = 'Nama produk kosong';
      } else if (price <= 0) {
        isValid = false;
        errorReason = 'Harga jual harus > 0';
      }

      return {
        name,
        sku: sku || undefined,
        categoryName,
        unitName,
        price,
        cost,
        barcode: barcode || undefined,
        minStock,
        trackExpiry,
        isValid,
        errorReason,
      };
    });

    setParsedRows(results);
  };

  const handleLoadSample = () => {
    handleParse(CSV_TEMPLATE);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setIsProcessing(true);
    setImportSummary(null);

    const catalogService = new CatalogService(db);
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      try {
        // Cari atau buat kategori otomatis
        let targetCategory = categories.find(
          (c) => c.name.toLowerCase() === row.categoryName.toLowerCase()
        );

        if (!targetCategory && row.categoryName.trim()) {
          targetCategory = await catalogService.createCategory({
            name: row.categoryName.trim(),
            createdBy: currentUserId,
          });
        }

        const categoryId = targetCategory ? targetCategory.id : (categories[0]?.id || 'default');

        await catalogService.createProduct({
          name: row.name,
          sku: row.sku,
          categoryId,
          baseUnitKind: 'count',
          baseUnitCode: row.unitName.toLowerCase().slice(0, 5),
          minStockBase: row.minStock,
          trackExpiry: row.trackExpiry,
          createdBy: currentUserId,
          units: [
            {
              unitCode: row.unitName.toLowerCase().slice(0, 5),
              name: row.unitName,
              conversionFactor: 1,
              price: row.price,
              costX10k: row.cost * 10000,
              isBase: true,
            },
          ],
          barcodes: row.barcode
            ? [
                {
                  barcode: row.barcode,
                  unitCode: row.unitName.toLowerCase().slice(0, 5),
                },
              ]
            : undefined,
        });

        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsProcessing(false);
    setImportSummary(
      `Selesai: ${successCount} produk berhasil diimpor, ${failCount} gagal (duplikasi barcode atau data invalid).`
    );

    if (successCount > 0) {
      onSuccess();
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-background border border-border w-full max-w-2xl rounded-card p-6 shadow-2xl flex flex-col gap-4 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <UploadCloud className="size-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-foreground">
                Impor Produk dari CSV
              </h2>
              <span className="text-xs text-muted-foreground">
                Unggah berkas atau tempel format data CSV produk
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

        {importSummary && (
          <div className="p-3 bg-secondary text-secondary-foreground text-xs rounded-card border border-secondary font-medium flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary flex-shrink-0" />
            <span>{importSummary}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Data CSV (Header: nama, sku, kategori, satuan, harga_jual, harga_modal, barcode, stok_minimum, lacak_kedaluwarsa)
            </label>
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <FileText className="size-3" />
              <span>Gunakan Contoh CSV</span>
            </button>
          </div>

          <textarea
            value={csvContent}
            onChange={(e) => handleParse(e.target.value)}
            placeholder="Tempel teks CSV di sini..."
            rows={4}
            className="w-full p-3 bg-card border border-input rounded-card text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Pratinjau Baris */}
        {parsedRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Pratinjau ({parsedRows.length} baris terdeteksi)
              </span>
              <div className="flex items-center gap-3">
                <span className="text-success-text font-semibold flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="text-destructive-text font-semibold flex items-center gap-1">
                    <AlertTriangle className="size-3" /> {invalidCount} invalid
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto border border-border rounded-card bg-card">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                    <th className="p-2">Status</th>
                    <th className="p-2">Nama</th>
                    <th className="p-2">Kategori</th>
                    <th className="p-2 text-right">Harga Jual</th>
                    <th className="p-2">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.map((r, idx) => (
                    <tr key={idx} className={r.isValid ? '' : 'bg-destructive/10'}>
                      <td className="p-2">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success-text">
                            <CheckCircle2 className="size-3" /> Siap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive-text" title={r.errorReason}>
                            <AlertTriangle className="size-3" /> {r.errorReason}
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-medium text-foreground">{r.name || '—'}</td>
                      <td className="p-2 text-muted-foreground">{r.categoryName || '—'}</td>
                      <td className="p-2 text-right font-semibold text-foreground tabular-nums">
                        {formatRupiah(r.price)}
                      </td>
                      <td className="p-2 font-mono text-muted-foreground">{r.barcode || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-pill border border-input text-xs font-semibold text-foreground hover:bg-muted"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={isProcessing || validCount === 0}
            onClick={handleExecuteImport}
            className="px-6 py-2 rounded-pill bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {isProcessing && <Loader2 className="size-3.5 animate-spin" />}
            <span>Impor {validCount} Produk Valid</span>
          </button>
        </div>
      </div>
    </div>
  );
};
