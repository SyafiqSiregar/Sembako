import React, { useState } from 'react';
import {
  BookOpen,
  ShoppingCart,
  Layers,
  Clock,
  ShieldCheck,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Database,
  RotateCcw,
  Truck,
} from 'lucide-react';

export const HelpView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'expiry' | 'backup' | 'faq'>('pos');

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Topic Switcher Card */}
      <div className="bg-card border border-border rounded-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <BookOpen className="size-4 text-primary" />
          <span>Pilih Topik Panduan:</span>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-muted rounded-pill text-xs font-medium self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'pos', label: 'Kasir POS', icon: ShoppingCart },
            { id: 'inventory', label: 'Inventaris & Opname', icon: Layers },
            { id: 'expiry', label: 'Batch & FEFO', icon: Clock },
            { id: 'backup', label: 'Cadangan & PWA', icon: Database },
            { id: 'faq', label: 'Glosarium & FAQ', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill transition-colors shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-card border border-border rounded-card p-6 shadow-sm">
        {activeTab === 'pos' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-serif font-semibold text-xl text-foreground">
                Alur Transaksi Kasir POS (Point of Sale)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Layar kasir dirancang cepat, tahan salah, dan dapat dioperasikan penuh dengan sentuhan tablet atau barcode scanner fisik.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-border rounded-card p-4 bg-muted/20 flex flex-col gap-2">
                <span className="size-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="font-serif font-semibold text-sm text-foreground">Buka Sesi Kasir</h3>
                <p className="text-xs text-muted-foreground">
                  Wajib memasukkan modal awal laci kas (misal: Rp 200.000). Transaksi kasir tidak dapat dimulai tanpa sesi kas terbuka (aturan BR-21).
                </p>
              </div>

              <div className="border border-border rounded-card p-4 bg-muted/20 flex flex-col gap-2">
                <span className="size-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="font-serif font-semibold text-sm text-foreground">Pindai / Pilih Barang</h3>
                <p className="text-xs text-muted-foreground">
                  Arahkan barcode scanner fisik ke kemasan barang, atau ketik nama pada kolom pencarian cepat. Barang otomatis masuk ke keranjang belanja.
                </p>
              </div>

              <div className="border border-border rounded-card p-4 bg-muted/20 flex flex-col gap-2">
                <span className="size-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-serif font-semibold text-sm text-foreground">Bayar & Cetak Struk</h3>
                <p className="text-xs text-muted-foreground">
                  Pilih nominal uang tunai (Uang Pas, 50rb, 100rb, dll). Kembalian dihitung otomatis. Tekan Selesai untuk mencatat transaksi dan memotong stok.
                </p>
              </div>
            </div>

            {/* Hotkey Table */}
            <div className="border-t border-border pt-4">
              <h3 className="font-serif font-semibold text-sm text-foreground mb-3">
                Pintasan Keyboard & Tombol Kasir
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-card">
                  <span className="text-foreground">Pencarian & Scan Barcode</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded border border-border text-[11px] font-mono font-semibold">
                    Auto-Focus
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-card">
                  <span className="text-foreground">Tahan Keranjang (Hold Cart)</span>
                  <span className="font-medium text-muted-foreground">Tombol Tahan (Kuning)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-card">
                  <span className="text-foreground">Diskon Transaksi (Maks 5% Kasir)</span>
                  <span className="font-medium text-muted-foreground">&gt; 5% butuh PIN Supervisor</span>
                </div>
                <div className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-card">
                  <span className="text-foreground">Batalkan Transaksi (Void)</span>
                  <span className="font-medium text-muted-foreground">Wajib PIN Supervisor + Alasan</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-serif font-semibold text-xl text-foreground">
                Satu Inventaris Tunggal & Stok Opname
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                SembakoOS menerapkan aturan baku inventaris tunggal (BR-01): barang di rak pajang depan dan ruang penyimpanan belakang dihitung sebagai satu kesatuan stok toko.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border rounded-card p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <Truck className="size-4" />
                  <span>Penerimaan Barang (Goods Receipt)</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Saat kiriman distributor tiba, catat nomor faktur surat jalan, pilih pemasok, masukkan kuantitas barang, dan harga modal beli. Sistem otomatis menghitung harga pokok rata-rata tertimbang (Moving Weighted Average Cost) dan menambahkan saldo stok secara langsung.
                </p>
              </div>

              <div className="border border-border rounded-card p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-warning-text font-semibold text-sm">
                  <RotateCcw className="size-4" />
                  <span>Koreksi & Penyesuaian Stok Manual</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Digunakan jika ada barang tercecer, kemasan sobek, atau sampling. Wajib menyertakan alasan tertulis. Bila jumlah penyesuaian melampaui batas toleransi (Rp 100.000 atau 10 unit), sistem mewajibkan verifikasi PIN Supervisor untuk melindungi integritas toko.
                </p>
              </div>
            </div>

            <div className="border border-border rounded-card p-4 bg-muted/20">
              <h3 className="font-serif font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success-text" />
                <span>Tahapan Stok Opname Fisik (BR-24)</span>
              </h3>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <li>Buka sesi opname baru (pilih seluruh toko atau kategori tertentu). Sistem otomatis mengambil foto data saldo saat itu (system snapshot).</li>
                <li>Petugas gudang menghitung barang fisik nyata di rak dan gudang, lalu memasukkan angka hitung.</li>
                <li>Buka menu Review: periksa selisih (Surplus / Minus / Cocok) dan nilai selisih Rupiah.</li>
                <li>Supervisor memverifikasi hasil opname dan menekan Posting Opname untuk menyesuaikan saldo stok secara atomik.</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'expiry' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-serif font-semibold text-xl text-foreground">
                Manajemen Batch & Kedaluwarsa (FEFO)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Menjamin keamanan pangan dan meminimalkan kerugian toko akibat barang kedaluwarsa.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="border border-border rounded-card p-4 flex flex-col gap-2">
                <span className="font-semibold text-destructive-text flex items-center gap-1.5">
                  <AlertTriangle className="size-4" />
                  <span>Blokir Otomatis</span>
                </span>
                <p className="text-muted-foreground">
                  Jika sebuah batch telah melewati tanggal kedaluwarsa, kasir tidak dapat menjual barang tersebut. Sistem akan memblokir checkout dan meminta barang dikeluarkan.
                </p>
              </div>

              <div className="border border-border rounded-card p-4 flex flex-col gap-2">
                <span className="font-semibold text-primary flex items-center gap-1.5">
                  <Clock className="size-4" />
                  <span>Alokasi Penjualan FEFO</span>
                </span>
                <p className="text-muted-foreground">
                  First-Expired First-Out. Sistem secara otomatis memotong stok dari batch dengan masa simpan paling dekat terlebih dahulu tanpa membebani kasir.
                </p>
              </div>

              <div className="border border-border rounded-card p-4 flex flex-col gap-2">
                <span className="font-semibold text-warning-text flex items-center gap-1.5">
                  <Layers className="size-4" />
                  <span>Pemusnahan (Write-Off)</span>
                </span>
                <p className="text-muted-foreground">
                  Barang rusak atau basi dimusnahkan lewat menu Kedaluwarsa. Pergerakan dicatat ke buku besar mutasi sebagai DAMAGE_SPOILAGE dan terekam di jejak audit.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-serif font-semibold text-xl text-foreground">
                Cadangan Data (Backup), Pemulihan & Offline PWA
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Data toko Anda 100% tersimpan secara aman di dalam memori tablet (IndexedDB) dan tidak bergantung pada koneksi internet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border rounded-card p-4 flex flex-col gap-3">
                <h3 className="font-serif font-semibold text-sm text-foreground flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  <span>Rutinitas Backup Harian</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sangat disarankan mengunduh berkas cadangan (<code className="bg-muted px-1 py-0.5 rounded text-[11px]">.json</code>) setiap sore setelah tutup toko. Salin berkas cadangan ke flashdisk OTG atau kirim ke penyimpanan aman. Berkas dilengkapi sidik jari SHA-256 untuk menjamin data tidak rusak.
                </p>
              </div>

              <div className="border border-border rounded-card p-4 flex flex-col gap-3">
                <h3 className="font-serif font-semibold text-sm text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-4 text-success-text" />
                  <span>Ketahanan Mode Offline (PWA)</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Jika listrik padam atau jaringan seluler toko terputus, SembakoOS tetap berjalan normal. Seluruh fungsi kasir, cetak struk, dan update stok bekerja offline tanpa kendala melalui Service Worker PWA.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-serif font-semibold text-xl text-foreground">
                Glosarium Istilah & Pertanyaan Umum
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Daftar istilah baku yang digunakan dalam sistem operasional SembakoOS.
              </p>
            </div>

            <div className="divide-y divide-border text-xs">
              <div className="py-3">
                <span className="font-semibold text-foreground block mb-0.5">Satuan Dasar (Base Unit)</span>
                <span className="text-muted-foreground">
                  Satuan fisik terkecil dari produk (misal: pcs, bungkus, botol, atau gram). Semua konversi karton atau renceng mengacu ke satuan dasar ini untuk mencegah selisih pecahan.
                </span>
              </div>

              <div className="py-3">
                <span className="font-semibold text-foreground block mb-0.5">Buku Besar Stok (Inventory Ledger)</span>
                <span className="text-muted-foreground">
                  Catatan mutasi stok yang bersifat permanen dan tidak dapat dihapus. Saldo stok selalu merupakan hasil penjumlahan matematis dari seluruh mutasi barang masuk dan keluar.
                </span>
              </div>

              <div className="py-3">
                <span className="font-semibold text-foreground block mb-0.5">Rekonsiliasi Kasir (Cash Reconciliation)</span>
                <span className="text-muted-foreground">
                  Pencocokan antara uang fisik di laci kas saat tutup shift dengan uang yang diharapkan sistem (Saldo Awal + Penjualan Tunai - Retur Tunai).
                </span>
              </div>

              <div className="py-3">
                <span className="font-semibold text-foreground block mb-0.5">FEFO (First-Expired First-Out)</span>
                <span className="text-muted-foreground">
                  Metode perputaran barang di mana barang yang tanggal kedaluwarsanya paling dekat akan dialokasikan dan dijual terlebih dahulu.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
