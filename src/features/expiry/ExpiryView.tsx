import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  Search,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  RotateCcw,
  Trash2,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { db } from '@/data/db';
import { InventoryService } from '@/services/inventory.service';
import { BatchService, type ExpiringBatchItem } from '@/services/batch.service';
import { formatRupiah } from '@/domain/money';
import { WriteOffModal } from './WriteOffModal';

export const ExpiryView: React.FC = () => {
  const inventoryService = useMemo(() => new InventoryService(db), []);
  const batchService = useMemo(
    () => new BatchService(db, inventoryService),
    [inventoryService]
  );

  const [batches, setBatches] = useState<ExpiringBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'EXPIRED' | 'CRITICAL' | 'WARNING'>('all');

  // Modal
  const [selectedBatchForWriteOff, setSelectedBatchForWriteOff] = useState<ExpiringBatchItem | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await batchService.getExpiringBatches(undefined, 30);
      setBatches(data);
    } catch (err) {
      console.error('Error loading expiring batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Metrics
  const expiredCount = batches.filter((b) => b.status === 'EXPIRED').length;
  const criticalCount = batches.filter((b) => b.status === 'CRITICAL').length;
  const warningCount = batches.filter((b) => b.status === 'WARNING').length;
  const totalRiskValuation = batches
    .filter((b) => b.status !== 'SAFE')
    .reduce((sum, b) => sum + b.valuationRupiah, 0);

  // Filtered List
  const filteredBatches = batches.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = b.productName.toLowerCase().includes(q);
      const matchBatch = b.batchCode.toLowerCase().includes(q);
      return matchName || matchBatch;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600">
            Tutup
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-[#14463C]" />
          <h1 className="text-xl font-bold text-stone-900 font-serif">
            Monitoring Kedaluwarsa
          </h1>
        </div>

        <button
          onClick={loadData}
          className="px-3.5 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center gap-2 transition"
        >
          <RotateCcw className="w-4 h-4 text-stone-500" />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Kedaluwarsa */}
        <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Kedaluwarsa
            </span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-rose-900">
            {expiredCount} <span className="text-xs font-normal text-rose-700">batch</span>
          </div>
          <div className="text-[11px] text-rose-600 mt-1 font-medium">
            Otomatis diblokir dari POS
          </div>
        </div>

        {/* Kritis H-7 */}
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Kritis (≤ 7 Hari)
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-amber-900">
            {criticalCount} <span className="text-xs font-normal text-amber-700">batch</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-1 font-medium">
            Prioritas jual / diskon khusus
          </div>
        </div>

        {/* Peringatan H-30 */}
        <div className="p-4 bg-yellow-50/70 border border-yellow-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-800">
              Peringatan (≤ 30 Hari)
            </span>
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold font-serif text-yellow-900">
            {warningCount} <span className="text-xs font-normal text-yellow-700">batch</span>
          </div>
          <div className="text-[11px] text-yellow-600 mt-1 font-medium">
            Pantau perputaran stok
          </div>
        </div>

        {/* Nilai Risiko */}
        <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Total Nilai Berisiko
            </span>
            <AlertTriangle className="w-4 h-4 text-stone-500" />
          </div>
          <div className="text-xl font-bold font-serif text-stone-900">
            {formatRupiah(totalRiskValuation)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1 font-medium">
            HPP stok batch berisiko
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama produk atau kode batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-[#14463C] text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Semua ({batches.length})
            </button>
            <button
              onClick={() => setStatusFilter('EXPIRED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === 'EXPIRED'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              Kedaluwarsa ({expiredCount})
            </button>
            <button
              onClick={() => setStatusFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === 'CRITICAL'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Kritis ≤ 7 Hari ({criticalCount})
            </button>
            <button
              onClick={() => setStatusFilter('WARNING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === 'WARNING'
                  ? 'bg-yellow-600 text-white shadow-sm'
                  : 'bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100'
              }`}
            >
              Peringatan ≤ 30 Hari ({warningCount})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="border border-stone-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Produk & Kategori</th>
                  <th className="px-3 py-3">Kode Batch</th>
                  <th className="px-3 py-3">Tgl Kedaluwarsa</th>
                  <th className="px-3 py-3">Sisa Hari</th>
                  <th className="px-3 py-3 text-right">Stok Fisik</th>
                  <th className="px-3 py-3 text-right">Nilai HPP</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                      Memuat data batch kedaluwarsa...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                      Tidak ada batch yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => (
                    <tr key={b.batchId} className="hover:bg-stone-50/50 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-stone-900">{b.productName}</div>
                        <div className="text-[11px] text-stone-500">{b.categoryName}</div>
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-stone-700">
                        {b.batchCode}
                      </td>
                      <td className="px-3 py-3 text-stone-800 font-medium">
                        {b.expiryDate}
                      </td>
                      <td className="px-3 py-3">
                        {b.daysRemaining < 0 ? (
                          <span className="font-bold text-rose-700">
                            Lewat {Math.abs(b.daysRemaining)} hari
                          </span>
                        ) : b.daysRemaining === 0 ? (
                          <span className="font-bold text-rose-700">Hari ini</span>
                        ) : (
                          <span className="font-semibold text-stone-700">
                            {b.daysRemaining} hari lagi
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-stone-900">
                        {b.currentStock} {b.unitCode}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-stone-700">
                        {formatRupiah(b.valuationRupiah)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {b.status === 'EXPIRED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Kedaluwarsa
                          </span>
                        )}
                        {b.status === 'CRITICAL' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Kritis H-7
                          </span>
                        )}
                        {b.status === 'WARNING' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">
                            H-30
                          </span>
                        )}
                        {b.status === 'SAFE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Aman
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedBatchForWriteOff(b)}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1 ml-auto transition"
                          title="Keluarkan / Musnahkan barang kedaluwarsa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Keluarkan</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Write-off Modal */}
      <WriteOffModal
        isOpen={Boolean(selectedBatchForWriteOff)}
        onClose={() => setSelectedBatchForWriteOff(null)}
        item={selectedBatchForWriteOff}
        batchService={batchService}
        onSuccess={() => {
          showNotification('success', 'Barang berhasil dikeluarkan dari inventaris');
          loadData();
        }}
      />
    </div>
  );
};
