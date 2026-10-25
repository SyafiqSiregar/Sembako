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
    <div className="flex flex-col gap-6 select-none">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Unified Table Card */}
      <div className="bg-card border border-border rounded-card shadow-sm overflow-hidden">
        {/* Card Header Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Tab Segmented Control */}
            <div className="inline-flex p-1 bg-muted rounded-pill border border-border/40 text-xs font-medium">
              <button
                onClick={() => {
                  setActiveTab('suppliers');
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-pill transition-all ${
                  activeTab === 'suppliers'
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="size-3.5" />
                <span>Data Pemasok ({suppliers.filter((s) => s.active === 1).length})</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('receipts');
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-pill transition-all ${
                  activeTab === 'receipts'
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Truck className="size-3.5" />
                <span>Faktur Penerimaan ({receipts.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'suppliers'
                    ? 'Cari nama pemasok / PIC...'
                    : 'Cari No. GR / Faktur...'
                }
                className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-pill text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {activeTab === 'suppliers' ? (
              <button
                onClick={() => {
                  setEditingSupplier(null);
                  setIsSupplierModalOpen(true);
                }}
                className="h-9 px-3.5 bg-primary text-primary-foreground text-xs font-semibold rounded-pill hover:bg-primary-hover flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>Tambah Pemasok</span>
              </button>
            ) : (
              <button
                onClick={() => setIsReceiptModalOpen(true)}
                disabled={suppliers.filter((s) => s.active === 1).length === 0}
                className="h-9 px-3.5 bg-primary text-primary-foreground text-xs font-semibold rounded-pill hover:bg-primary-hover flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                <span>Penerimaan Barang</span>
              </button>
            )}

            <button
              onClick={loadData}
              className="size-9 rounded-pill border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-xs"
              title="Segarkan Data"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Content Area directly inside Card */}
        <div className="overflow-x-auto">
          {activeTab === 'suppliers' ? (
            /* TAB 1: Data Pemasok */
            loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Memuat data pemasok...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="size-12 stroke-[1.5] text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Belum ada data pemasok</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Klik tombol "Tambah Pemasok" untuk mendaftarkan distributor sembako
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Nama Pemasok</th>
                    <th className="px-4 py-3.5">Kontak (PIC)</th>
                    <th className="px-4 py-3.5">Telepon</th>
                    <th className="px-4 py-3.5">Alamat</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-foreground">{sup.name}</td>
                      <td className="px-4 py-3.5 text-foreground/80">{sup.contact_name || '—'}</td>
                      <td className="px-4 py-3.5 text-muted-foreground font-mono">{sup.phone || '—'}</td>
                      <td className="px-4 py-3.5 text-muted-foreground truncate max-w-xs">{sup.address || '—'}</td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingSupplier(sup);
                            setIsSupplierModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-pill border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                          title="Edit Data Pemasok"
                        >
                          <Edit2 className="size-3 inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchiveSupplier(sup)}
                          className="px-2.5 py-1 rounded-pill border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive-text text-xs font-semibold transition-colors"
                          title="Arsipkan Pemasok"
                        >
                          <Archive className="size-3 inline mr-1" />
                          Arsipkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            /* TAB 2: Faktur Penerimaan Barang */
            loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground">Memuat riwayat penerimaan...</div>
            ) : filteredReceipts.length === 0 ? (
              <div className="p-12 text-center">
                <Truck className="size-12 stroke-[1.5] text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Belum ada riwayat penerimaan barang</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Klik "Penerimaan Barang" untuk mencatat pengiriman barang dari distributor
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
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
                <tbody className="divide-y divide-border/60">
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-foreground">{r.receipt_no}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{r.received_date}</td>
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {supplierMap.get(r.supplier_id) || 'Pemasok'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-muted-foreground">{r.supplier_ref_no || '—'}</td>
                      <td className="px-4 py-3.5 text-right font-bold font-mono text-foreground">
                        {formatRupiah(r.total_cost)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider bg-success text-success-foreground border border-success/30">
                          Diposting
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={async () => {
                            const detail = await receiptService.getReceiptDetail(r.id);
                            if (detail) setSelectedReceiptDetail(detail);
                          }}
                          className="px-2.5 py-1 rounded-pill border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                        >
                          <Eye className="size-3 inline mr-1" />
                          Rincian
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
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
