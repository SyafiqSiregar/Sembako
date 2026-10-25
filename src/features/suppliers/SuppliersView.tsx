import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Truck,
  Plus,
  Search,
  RotateCcw,
  Eye,
  Edit2,
  Archive,
} from 'lucide-react';
import { db, type Supplier, type GoodsReceipt } from '@/data/db';
import { SupplierService } from '@/services/supplier.service';
import { GoodsReceiptService } from '@/services/goods-receipt.service';
import { InventoryService } from '@/services/inventory.service';
import { CatalogService, type ProductDetail } from '@/services/catalog.service';
import { formatRupiah } from '@/domain/money';
import { useAuthStore } from '@/features/auth/authStore';
import { SupplierFormModal } from './SupplierFormModal';
import { GoodsReceiptModal } from './GoodsReceiptModal';

export const SuppliersView: React.FC = () => {
  const { currentUser } = useAuthStore();
  const supplierService = useMemo(() => new SupplierService(db), []);
  const inventoryService = useMemo(() => new InventoryService(db), []);
  const receiptService = useMemo(
    () => new GoodsReceiptService(db, inventoryService),
    [inventoryService]
  );
  const catalogService = useMemo(() => new CatalogService(db), []);

  const [activeTab, setActiveTab] = useState<'suppliers' | 'receipts'>('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<{
    receipt: GoodsReceipt;
    supplier: Supplier;
    items: Array<any>;
  } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const sups = await supplierService.listSuppliers(false);
      setSuppliers(sups);

      const recs = await receiptService.listReceipts();
      setReceipts(recs);

      const prods = await catalogService.listProducts();
      setProducts(prods.filter((p) => p.product.active === 1));
    } catch (e) {
      console.error('Error loading supplier data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supplierService, receiptService, catalogService]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleArchiveSupplier = async (sup: Supplier) => {
    if (confirm(`Yakin ingin mengarsipkan pemasok '${sup.name}'?`)) {
      try {
        await supplierService.archiveSupplier(sup.id, currentUser?.id || 'system');
        showNotification('success', `Pemasok '${sup.name}' berhasil diarsipkan`);
        loadData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal mengarsipkan pemasok';
        showNotification('error', msg);
      }
    }
  };

  // Filtered lists
  const filteredSuppliers = useMemo(() => {
    let list = suppliers.filter((s) => s.active === 1);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.contact_name?.toLowerCase().includes(q) ||
          s.phone?.includes(q)
      );
    }
    return list;
  }, [suppliers, searchQuery]);

  const filteredReceipts = useMemo(() => {
    let list = receipts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.receipt_no.toLowerCase().includes(q) ||
          r.supplier_ref_no?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [receipts, searchQuery]);

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);

  return (
    <div className="flex-1 flex flex-col bg-[#FBF8F3] overflow-hidden select-none">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success' ? 'bg-[#14463C] text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Unified Tabs, Search & Action Toolbar */}
      <div className="p-4 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Tab Buttons */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-medium text-stone-600">
            <button
              onClick={() => {
                setActiveTab('suppliers');
                setSearchQuery('');
              }}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
                activeTab === 'suppliers'
                  ? 'bg-white text-stone-900 shadow-sm font-bold'
                  : 'hover:text-stone-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Data Pemasok ({suppliers.filter((s) => s.active === 1).length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('receipts');
                setSearchQuery('');
              }}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
                activeTab === 'receipts'
                  ? 'bg-white text-stone-900 shadow-sm font-bold'
                  : 'hover:text-stone-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Faktur Penerimaan ({receipts.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'suppliers'
                  ? 'Cari nama pemasok / PIC...'
                  : 'Cari No. GR / Faktur...'
              }
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'suppliers' ? (
            <button
              onClick={() => {
                setEditingSupplier(null);
                setIsSupplierModalOpen(true);
              }}
              className="py-2 px-3.5 bg-[#14463C] text-white text-xs font-bold rounded-xl hover:bg-[#0F352E] flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pemasok</span>
            </button>
          ) : (
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              disabled={suppliers.filter((s) => s.active === 1).length === 0}
              className="py-2 px-3.5 bg-[#14463C] text-white text-xs font-bold rounded-xl hover:bg-[#0F352E] flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Penerimaan Barang</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 border border-stone-300 rounded-xl hover:bg-stone-50 text-stone-700 transition"
            title="Segarkan Data"
          >
            <RotateCcw className="w-4 h-4 text-stone-500" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'suppliers' ? (
          /* TAB 1: Data Pemasok */
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-stone-500">Memuat data pemasok...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-12 h-12 stroke-[1.5] text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">Belum ada data pemasok</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Klik tombol "Tambah Pemasok" untuk mendaftarkan distributor sembako
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Nama Pemasok</th>
                    <th className="px-4 py-3.5">Kontak (PIC)</th>
                    <th className="px-4 py-3.5">Telepon</th>
                    <th className="px-4 py-3.5">Alamat</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-stone-50/70 transition">
                      <td className="px-5 py-3.5 font-bold text-stone-900">{sup.name}</td>
                      <td className="px-4 py-3.5 text-stone-700">{sup.contact_name || '—'}</td>
                      <td className="px-4 py-3.5 text-stone-600 font-mono">{sup.phone || '—'}</td>
                      <td className="px-4 py-3.5 text-stone-600 truncate max-w-xs">{sup.address || '—'}</td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingSupplier(sup);
                            setIsSupplierModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-[#14463C] hover:text-[#14463C] text-stone-700 font-semibold transition"
                          title="Edit Data Pemasok"
                        >
                          <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchiveSupplier(sup)}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/40 hover:bg-rose-100 text-rose-700 font-semibold transition"
                          title="Arsipkan Pemasok"
                        >
                          <Archive className="w-3.5 h-3.5 inline mr-1" />
                          Arsipkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* TAB 2: Faktur Penerimaan Barang */
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-stone-500">Memuat riwayat penerimaan...</div>
            ) : filteredReceipts.length === 0 ? (
              <div className="p-12 text-center">
                <Truck className="w-12 h-12 stroke-[1.5] text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">Belum ada riwayat penerimaan barang</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Klik "Penerimaan Barang Baru" untuk mencatat pengiriman barang dari distributor
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">No. Penerimaan</th>
                    <th className="px-4 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">Pemasok</th>
                    <th className="px-4 py-3.5">No. Faktur Ref</th>
                    <th className="px-4 py-3.5 text-right">Total Biaya</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/70 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-stone-900">{r.receipt_no}</td>
                      <td className="px-4 py-3.5 text-stone-600">{r.received_date}</td>
                      <td className="px-4 py-3.5 font-medium text-stone-800">
                        {supplierMap.get(r.supplier_id) || 'Pemasok'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-stone-600">{r.supplier_ref_no || '—'}</td>
                      <td className="px-4 py-3.5 text-right font-bold font-mono text-stone-900">
                        {formatRupiah(r.total_cost)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Diposting
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={async () => {
                            const detail = await receiptService.getReceiptDetail(r.id);
                            if (detail) setSelectedReceiptDetail(detail);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-[#14463C] hover:text-[#14463C] text-stone-700 font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          Rincian
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      <SupplierFormModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        supplier={editingSupplier}
        supplierService={supplierService}
        onSuccess={() => {
          showNotification('success', 'Data pemasok berhasil disimpan');
          loadData();
        }}
      />

      {/* Goods Receipt Modal */}
      <GoodsReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        suppliers={suppliers.filter((s) => s.active === 1)}
        products={products}
        receiptService={receiptService}
        onSuccess={() => {
          showNotification('success', 'Penerimaan barang berhasil diposting dan stok bertambah');
          loadData();
        }}
      />

      {/* Receipt Detail Modal */}
      {selectedReceiptDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-base">
                  Faktur #{selectedReceiptDetail.receipt.receipt_no}
                </h3>
                <p className="text-xs text-white/80">
                  Pemasok: {selectedReceiptDetail.supplier?.name} • Tanggal: {selectedReceiptDetail.receipt.received_date}
                </p>
              </div>
              <button
                onClick={() => setSelectedReceiptDetail(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-[#FBF8F3] space-y-3">
              <div className="bg-white p-4 rounded-xl border border-stone-200 divide-y divide-stone-100 space-y-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Barang yang Diterima
                </span>
                <div className="pt-2 space-y-2">
                  {selectedReceiptDetail.items.map((it: any) => (
                    <div key={it.id} className="flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-stone-900">{it.productName}</div>
                        <div className="text-[11px] text-stone-500">
                          {it.qty_base} {it.unitCode} @ {formatRupiah(Math.floor(it.unit_cost_x10k / 10000))}
                        </div>
                      </div>
                      <div className="font-bold text-stone-900 font-mono">
                        {formatRupiah(Math.floor((it.qty_base * it.unit_cost_x10k) / 10000))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex justify-between items-center text-xs font-bold text-[#14463C]">
                  <span>Total Biaya</span>
                  <span className="text-sm font-mono">{formatRupiah(selectedReceiptDetail.receipt.total_cost)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setSelectedReceiptDetail(null)}
                className="py-2 px-4 rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
