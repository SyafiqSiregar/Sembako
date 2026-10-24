import React, { useState } from 'react';
import { X, ClipboardCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { StocktakeService, type StocktakeReviewItem } from '@/services/stocktake.service';
import { type Category } from '@/data/db';
import { formatRupiah } from '@/domain/money';
import { useAuthStore } from '@/features/auth/authStore';

interface StocktakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  stocktakeService: StocktakeService;
  onSessionPosted: () => void;
}

export const StocktakeModal: React.FC<StocktakeModalProps> = ({
  isOpen,
  onClose,
  categories,
  stocktakeService,
  onSessionPosted,
}) => {
  const { currentUser } = useAuthStore();
  const [step, setStep] = useState<'create' | 'count' | 'review'>('create');
  const [sessionName, setSessionName] = useState(() => `Opname ${new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`);
  const [scopeType, setScopeType] = useState<'all' | 'category'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isBlind, setIsBlind] = useState(false);

  // Active session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<{
    items: StocktakeReviewItem[];
    totalVarianceQty: number;
    totalVarianceRupiah: number;
    itemsCounted: number;
    totalItems: number;
  } | null>(null);

  const [countInputs, setCountInputs] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Step 1: Start Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      setErrorMessage('Nama sesi stok opname wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const session = await stocktakeService.createSession({
        name: sessionName.trim(),
        scopeType,
        scopeRef: scopeType === 'category' ? selectedCategory : undefined,
        blind: isBlind,
        createdBy: currentUser?.id || 'system',
      });

      setActiveSessionId(session.id);
      const review = await stocktakeService.getSessionReview(session.id);
      setReviewData(review);

      // Inisialisasi input hitung
      const initialInputs: Record<string, number> = {};
      review.items.forEach((it) => {
        initialInputs[it.item.product_id] = it.systemQty;
      });
      setCountInputs(initialInputs);

      setStep('count');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka sesi opname';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Save Counts & Go to Review
  const handleSaveCountsAndReview = async () => {
    if (!activeSessionId) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      for (const [prodId, count] of Object.entries(countInputs)) {
        await stocktakeService.recordCount({
          sessionId: activeSessionId,
          productId: prodId,
          countedQty: count,
          countedBy: currentUser?.id || 'system',
        });
      }

      const review = await stocktakeService.getSessionReview(activeSessionId);
      setReviewData(review);
      setStep('review');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan hasil hitung';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Post Session
  const handlePostSession = async () => {
    if (!activeSessionId) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await stocktakeService.postSession({
        sessionId: activeSessionId,
        postedBy: currentUser?.id || 'system',
      });

      onSessionPosted();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memposting stok opname';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold">Stok Opname Fisik (Stocktake)</h2>
              <p className="text-xs text-white/80">
                {step === 'create'
                  ? 'Persiapan Sesi & Cakupan Produk'
                  : step === 'count'
                  ? 'Input Hitung Fisik Aktual'
                  : 'Review Selisih & Posting Penyesuaian'}
              </p>
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#FBF8F3]">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'create' && (
            /* STEP 1: Buat Sesi */
            <form onSubmit={handleStartSession} className="space-y-4 max-w-md mx-auto py-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Nama Sesi Opname *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Contoh: Opname Akhir Bulan Oktober"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm font-semibold text-stone-900 focus:ring-2 focus:ring-[#14463C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Cakupan Produk
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScopeType('all')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition ${
                      scopeType === 'all'
                        ? 'border-[#14463C] bg-emerald-50 text-[#14463C]'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    Semua Produk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScopeType('category');
                      if (!selectedCategory && categories[0]) setSelectedCategory(categories[0].id);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition ${
                      scopeType === 'category'
                        ? 'border-[#14463C] bg-emerald-50 text-[#14463C]'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    Per Kategori
                  </button>
                </div>
              </div>

              {scopeType === 'category' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Pilih Kategori
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-800"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={isBlind}
                    onChange={(e) => setIsBlind(e.target.checked)}
                    className="rounded border-stone-300 text-[#14463C] focus:ring-[#14463C]"
                  />
                  <span>Mode Hitung Buta (Sembunyikan angka stok sistem dari petugas hitung)</span>
                </label>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !sessionName.trim()}
                  className="w-full py-3.5 bg-[#14463C] text-white rounded-xl text-xs font-bold hover:bg-[#0F352E] flex items-center justify-center gap-2 shadow-md transition disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Mulai Sesi Penghitungan</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 'count' && reviewData && (
            /* STEP 2: Input Hitung Fisik */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>
                  Penghitungan fisik: <strong>{reviewData.totalItems}</strong> jenis produk
                </span>
                <span>Satuan yang dihitung: <strong>Satuan Dasar</strong></span>
              </div>

              <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Produk</th>
                      {!isBlind && <th className="px-3 py-2.5 text-right">Stok Sistem</th>}
                      <th className="px-3 py-2.5 text-right w-36">Hitung Fisik Aktual</th>
                      {!isBlind && <th className="px-3 py-2.5 text-center w-24">Selisih</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {reviewData.items.map((it) => {
                      const countVal = countInputs[it.item.product_id] ?? it.systemQty;
                      const variance = countVal - it.systemQty;

                      return (
                        <tr key={it.item.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-2">
                            <div className="font-bold text-stone-900">{it.productName}</div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              Satuan: {it.baseUnitCode}
                            </div>
                          </td>
                          {!isBlind && (
                            <td className="px-3 py-2 text-right font-mono font-semibold text-stone-700">
                              {it.systemQty} {it.baseUnitCode}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={countVal}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setCountInputs((prev) => ({
                                  ...prev,
                                  [it.item.product_id]: isNaN(val) ? 0 : val,
                                }));
                              }}
                              className="w-24 px-2 py-1 bg-stone-50 border border-stone-300 rounded font-bold text-right text-stone-900"
                            />
                          </td>
                          {!isBlind && (
                            <td className="px-3 py-2 text-center font-bold font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  variance === 0
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : variance > 0
                                    ? 'bg-blue-50 text-blue-800'
                                    : 'bg-rose-50 text-rose-800'
                                }`}
                              >
                                {variance === 0 ? 'Cocok' : variance > 0 ? `+${variance}` : variance}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveCountsAndReview}
                  disabled={isSubmitting}
                  className="py-3 px-6 bg-[#14463C] text-white rounded-xl text-xs font-bold hover:bg-[#0F352E] flex items-center gap-2 shadow-md transition"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Lanjut ke Review Selisih</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'review' && reviewData && (
            /* STEP 3: Review & Posting */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-stone-200 text-center">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Total Selisih Kuantitas
                  </span>
                  <div
                    className={`text-2xl font-bold font-mono mt-1 ${
                      reviewData.totalVarianceQty === 0
                        ? 'text-emerald-700'
                        : reviewData.totalVarianceQty > 0
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {reviewData.totalVarianceQty > 0
                      ? `+${reviewData.totalVarianceQty}`
                      : reviewData.totalVarianceQty}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-stone-200 text-center">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Estimasi Nilai Selisih Rupiah
                  </span>
                  <div
                    className={`text-2xl font-bold font-mono mt-1 ${
                      reviewData.totalVarianceRupiah === 0
                        ? 'text-emerald-700'
                        : reviewData.totalVarianceRupiah > 0
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {formatRupiah(reviewData.totalVarianceRupiah)}
                  </div>
                </div>
              </div>

              <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Produk</th>
                      <th className="px-3 py-2.5 text-right">Sistem</th>
                      <th className="px-3 py-2.5 text-right">Fisik</th>
                      <th className="px-3 py-2.5 text-right">Selisih</th>
                      <th className="px-4 py-2.5 text-right">Nilai Rupiah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono">
                    {reviewData.items.map((it) => (
                      <tr key={it.item.id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-2 font-sans font-bold text-stone-900">{it.productName}</td>
                        <td className="px-3 py-2 text-right text-stone-600">{it.systemQty}</td>
                        <td className="px-3 py-2 text-right font-bold text-stone-900">{it.countedQty}</td>
                        <td
                          className={`px-3 py-2 text-right font-bold ${
                            it.variance === 0
                              ? 'text-emerald-700'
                              : it.variance > 0
                              ? 'text-blue-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {it.variance > 0 ? `+${it.variance}` : it.variance}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-stone-900">
                          {formatRupiah(it.varianceValueRupiah)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('count')}
                  className="py-2.5 px-4 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                >
                  Kembali Edit Hitungan
                </button>
                <button
                  type="button"
                  onClick={handlePostSession}
                  disabled={isSubmitting}
                  className="py-3 px-6 bg-[#14463C] text-white rounded-xl text-xs font-bold hover:bg-[#0F352E] flex items-center gap-2 shadow-md transition"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Posting Hasil Stok Opname Atomik</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
