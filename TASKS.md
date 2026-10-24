# TASKS — SembakoOS

Daftar tugas implementasi bertahap untuk SembakoOS. Mengikuti `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, dan `DESIGN_SYSTEM.md`.

| Atribut | Nilai |
| --- | --- |
| Versi dokumen | 1.0 |
| Tanggal | 24 Oktober 2026 |
| Status | Fase 0 aktif |

---

## Aturan Pengerjaan Tugas
1. Ambil satu tugas `[ ]` pada fase aktif, ubah ke `[~]`.
2. Selesaikan kode & tes sesuai AC / Ref terkait.
3. Jalankan `pnpm check` (typecheck, lint, test).
4. Ubah status ke `[x]` setelah semua syarat "Selesai bila" terpenuhi dan catat di riwayat kemajuan.

---

## Fase 0: Fondasi Teknis & Scaffolding (Selesai)

- [x] **T0.01 Inisialisasi Proyek & Tooling**
  - Ref: `ARCHITECTURE.md` §2, `AGENTS.md` §1–§6
  - Selesai: Vite + React 18 + TypeScript strict + Tailwind CSS + Vitest terpasang, git repo aktif dengan `.gitignore`.
- [x] **T0.02 Design System & Token Styling**
  - Ref: `DESIGN_SYSTEM.md` §3–§5
  - Selesai: Token `--background` (#FBF8F3), `--primary` (#14463C), warna status semantik, dan tipografi Inter + Fraunces aktif di `src/styles/globals.css`.
- [x] **T0.03 Dexie Database Schema v1 & Invarian Dasar**
  - Ref: `DATABASE.md` §3, §4, §5
  - Selesai: `src/data/db.ts` mendeklarasikan 17 tabel dengan indeks sesuai spesifikasi, seed roles (`owner`, `supervisor`, `cashier`, `stock_clerk`), lolos tes inisialisasi di `fake-indexeddb`.
- [x] **T0.04 Modul Domain Uang & Kuantitas**
  - Ref: `DATABASE.md` §1.1, `ARCHITECTURE.md` §12, `AGENTS.md` §4.1
  - Selesai: `domain/money` (integer Rupiah, split, round half-up, format id-ID) dan `domain/quantity` (integer `qty_base`, konversi satuan) selesai dengan 100% test coverage dan fast-check property testing.
- [x] **T0.05 Shell Aplikasi & Navigasi Layout ORBIT**
  - Ref: `DESIGN_SYSTEM.md` §2, §6.9, §7.1
  - Selesai: Layout tablet (Sidebar navigasi pil, Topbar dengan status sinkronisasi/toko, Outlet) tampil rapi, responsif 1024x768, teruji visual via browser subagent.
- [x] **T0.06 Script Verifikasi & Integrasi CI Lokal**
  - Ref: `AGENTS.md` §6, `ARCHITECTURE.md` §16
  - Selesai: Perintah `pnpm check` (`typecheck && test`) dan `pnpm build` hijau tanpa error.

---

## Fase 1: Akses (AUTH) & Katalog Produk (CAT)

- [x] **T1.01 Domain & Service Auth (PIN Hash & Lockout)**
  - Ref: `PRD.md` FR-AUTH-01..03, BR-09, `DATABASE.md` §3.1
  - Selesai: PIN di-hash menggunakan PBKDF2-SHA256 dengan salt unik per user; gagal 5x mengunci user sementara dan mencatat audit log.
- [x] **T1.02 Service Sesi Kasir (Buka/Tutup Kas)**
  - Ref: `PRD.md` FR-AUTH-05..08, BR-10, BR-11, AC-01, AC-11
  - Selesai: Sesi kasir wajib dibuka dengan saldo modal awal sebelum menjual; tutup kas mencatat saldo hitung fisik, menghitung selisih, dan mewajibkan catatan jika ada selisih.
- [x] **T1.03 UI Login PIN, Kunci Layar, dan Buka/Tutup Kas**
  - Ref: `DESIGN_SYSTEM.md` §7.5, `PRD.md` AC-01
  - Selesai: `PinPad` 56px, `LockScreenModal` dengan proteksi PIN, dan `CashierSessionModal` (buka kas & tutup kas terintegrasi rekonsiliasi).
- [x] **T1.04 CRUD Kategori & Satuan Produk**
  - Ref: `PRD.md` FR-CAT-01, FR-CAT-03, `DATABASE.md` §3.2
  - Selesai: Kategori dan multi-satuan per produk (pcs, karton, kg, g) tersimpan dengan faktor konversi satuan dasar yang valid.
- [x] **T1.05 CRUD Produk & Barcode**
  - Ref: `PRD.md` FR-CAT-02..05, BR-02, BR-03, AC-14, AC-15
  - Selesai: Produk baru tervalidasi Zod (nama, barcode unik, min stock); update harga tercatat di `price_history`.
- [x] **T1.06 Pencarian Produk Cepat (In-memory Index)**
  - Ref: `PRD.md` FR-CAT-06, `ARCHITECTURE.md` §11
  - Selesai: `ProductSearchIndex` in-memory dengan pencarian instan barcode O(1), prefix nama, dan toleransi typo ringan.
- [x] **T1.07 Halaman Katalog Produk (Tabel & Form)**
  - Ref: `DESIGN_SYSTEM.md` §6.4, §7.3
  - Selesai: Halaman `/products` interaktif lengkap dengan tabel, filter kategori, search bar, status stok, form modal tambah/edit produk, dan pengarsipan produk aman.
- [x] **T1.08 Impor Produk CSV**
  - Ref: `PRD.md` FR-CAT-07, AC-16
  - Selesai: Modal impor CSV (`CsvImportModal`) dengan pratinjau validasi per baris, contoh format, dan impor produk atomik.

---

## Fase 2: Kasir (POS) & Transaksi Penjualan (Selesai & Terverifikasi)

- [x] **T2.01 Store Keranjang POS (Zustand)**
  - Ref: `ARCHITECTURE.md` §2, `PRD.md` FR-POS-01..03
  - Selesai: `posStore.ts` mendukung scan barcode O(1), stepper, ubah qty, diskon item & transaksi, dan snapshot harga. Teruji di `tests/unit/pos/cart.test.ts`.
- [x] **T2.02 Layar Kasir POS (Integrasi Scan & Keranjang)**
  - Ref: `DESIGN_SYSTEM.md` §7.2, `PRD.md` AC-02
  - Selesai: `PosView.tsx` 2-kolom tablet (kiri: auto-focus scan barcode, pencarian, filter kategori, kartu katalog produk dengan badge stok; kanan: keranjang belanja, stepper, dan tombol Bayar 56px).
- [x] **T2.03 Dialog Pembayaran Tunai & Hitung Kembalian**
  - Ref: `PRD.md` FR-POS-04..06, BR-06, AC-02, AC-03
  - Selesai: `PaymentDialog.tsx` dengan preset nominal (Uang Pas, 50rb, 100rb, dst), validasi uang diterima ≥ total, kalkulasi kembalian realtime ukuran `display`, dan proteksi tombol ganda.
- [x] **T2.04 CheckoutService Atomik & Idempoten**
  - Ref: `PRD.md` FR-POS-07, BR-04, BR-05, BR-07, BR-08, AC-02, AC-04
  - Selesai: `CheckoutService.processCheckout` memproses dalam 1 transaksi Dexie (sales, sale_items, payments, inventory ledger reduction, rollback jika stok kurang, idempotency saleId). Teruji di `tests/integration/services/checkout.test.ts`.
- [x] **T2.05 Struk & Pratinjau Cetak**
  - Ref: `PRD.md` FR-POS-08, `DESIGN_SYSTEM.md` §6.10
  - Selesai: `ReceiptModal.tsx` dengan format 58mm & 80mm mencakup identitas toko, nomor struk unik, rincian barang, total, tunai, kembalian, dan cetak struk via `window.print()`.
- [x] **T2.06 Tahan & Pulihkan Transaksi (Held Carts)**
  - Ref: `PRD.md` FR-POS-09, AC-05
  - Selesai: `HeldCartService` & `HeldCartsModal.tsx` memparkir transaksi aktif ke tabel `held_carts` Dexie dengan catatan pengenal dan memulihkannya kembali. Teruji di `tests/integration/services/return-and-hold.test.ts`.
- [x] **T2.07 Riwayat Transaksi & Cetak Ulang**
  - Ref: `PRD.md` FR-POS-10, AC-06
  - Selesai: `TransactionHistoryView.tsx` halaman `/transactions` menampilkan riwayat penjualan lengkap, filter tanggal/status, modal rincian transaksi, dan cetak ulang struk.
- [x] **T2.08 Void Transaksi (Pembatalan Sesi Kasir Berjalan)**
  - Ref: `PRD.md` FR-POS-11, BR-14, BR-15, AC-07
  - Selesai: `CheckoutService.voidSale` mewajibkan otorisasi PIN Supervisor/Owner, alasan pembatalan wajib, pembalikan stok via ledger `SALE_VOID` movement, dan audit log.
- [x] **T2.09 Retur Barang Pelanggan**
  - Ref: `PRD.md` FR-POS-12, BR-16, AC-08
  - Selesai: `CheckoutService.processReturn` memvalidasi kuantitas retur tidak melebihi sisa pembelian, mengembalikan stok via `CUSTOMER_RETURN` movement, mencatat pengembalian dana, dan update status penjualan. Teruji di `tests/integration/services/return-and-hold.test.ts`.

---

## Fase 3: Inventaris & Pemasok (INV & SUP) (Selesai 100%)

- [x] **T3.01 InventoryService (Satu Pintu Ledger Stok)**
  - Ref: `ARCHITECTURE.md` §1, `DATABASE.md` §6, `PRD.md` BR-01, BR-04
  - Selesai: Satu pintu seluruh mutasi stok via `recordMovement`, immutable `stock_movements` & `stock_movement_items`, update `inventory_balances` atomik. Teruji di `tests/integration/services/checkout.test.ts`.
- [x] **T3.02 Kartu Stok & Riwayat Mutasi Produk**
  - Ref: `PRD.md` FR-INV-01, AC-18
  - Selesai: `InventoryService.getStockCard` menghitung kronologi mutasi (masuk, keluar, saldo berjalan). `StockCardModal.tsx` menampilkan filter referensi, badge jenis mutasi, dan rincian transaksi terkait.
- [x] **T3.03 Penyesuaian Stok Manual (Penyesuaian Selisih/Rusak)**
  - Ref: `PRD.md` FR-INV-02, BR-18, AC-19
  - Selesai: `InventoryService.adjustStock` mewajibkan alasan, otorisasi PIN Supervisor bila melampaui batas ambang (Rp 100.000 atau 10 unit), dan menghasilkan `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` movement. `StockAdjustmentModal.tsx` terintegrasi di UI. Teruji di `tests/integration/services/inventory-adjustment.test.ts`.
- [x] **T3.04 Manajemen Pemasok (Data Supplier)**
  - Ref: `PRD.md` FR-SUP-01..02
  - Selesai: `SupplierService` (CRUD, soft archive `active = 0`, validasi Zod). `SupplierFormModal.tsx` dan `SuppliersView.tsx` halaman `/suppliers`. Teruji di `tests/integration/services/supplier-receipt.test.ts`.
- [x] **T3.05 Penerimaan Barang dari Pemasok (Goods Receipt)**
  - Ref: `PRD.md` FR-SUP-03..05, BR-12, AC-20
  - Selesai: `GoodsReceiptService.createAndPostReceipt` atomik, mencatat nomor faktur & tanggal terima, menghitung moving weighted average cost (`cost_x10k`), update riwayat `price_history`, dan menambah saldo stok via movement `PURCHASE_RECEIPT`. Teruji di `tests/integration/services/supplier-receipt.test.ts`.
- [x] **T3.06 Sesi Stok Opname (Persiapan & Hitung Fisik)**
  - Ref: `PRD.md` FR-INV-03, BR-19, AC-21
  - Selesai: `StocktakeService.createSession` mendukung cakupan seluruh toko atau kategori tertentu, snapshot `system_qty_snapshot` otomatis, mode hitung blind/terlihat, input fisik multi-item. Teruji di `tests/integration/services/stocktake.test.ts`.
- [x] **T3.07 Review & Rekonsiliasi Stok Opname**
  - Ref: `PRD.md` FR-INV-04, AC-22
  - Selesai: `StocktakeService.getReviewData` menghitung selisih kuantitas fisik vs sistem snapshot, total nilai selisih Rupiah, status selisih (`SURPLUS`, `DEFICIT`, `MATCH`), dan ringkasan opname.
- [x] **T3.08 Posting Stok Opname Atomik**
  - Ref: `PRD.md` FR-INV-05, BR-20, AC-22
  - Selesai: `StocktakeService.postSession` mewajibkan otorisasi Supervisor/Owner, membuat penyesuaian otomatis per produk berselisih via `STOCKTAKE_ADJUSTMENT` movement, audit log, dan mengunci sesi opname status `COMPLETED`. Teruji di `tests/integration/services/stocktake.test.ts`.

---

## Fase 4: Batch, Kedaluwarsa & Laporan (EXP & RPT) (Selesai 100%)

- [x] **T4.01 Manajemen Batch & Tanggal Kedaluwarsa**
  - Ref: `PRD.md` FR-EXP-01..03, BR-21..24, AC-23
  - Selesai: `BatchService.createOrGetBatch` dan integrasi `GoodsReceiptService.createAndPostReceipt`. Validasi wajib kode batch & tanggal kedaluwarsa jika `track_expiry = 1` (AC-23), saldo tersimpan per batch di `inventory_balances`. Teruji di `tests/integration/services/batch-fefo.test.ts`.
- [x] **T4.02 Alokasi Penjualan FEFO (First-Expired First-Out)**
  - Ref: `PRD.md` FR-EXP-04, BR-23, AC-24
  - Selesai: `BatchService.allocateFefo` terintegrasi langsung di dalam transaksi checkout atomik `CheckoutService.processCheckout`. Mengalokasikan kuantitas otomatis dari batch terdekat, dan memblokir penjualan batch kedaluwarsa (`expiry_date < today`, FR-EXP-04). Teruji di `tests/integration/services/batch-fefo.test.ts`.
- [x] **T4.03 Peringatan Kedaluwarsa & Laporan Batch**
  - Ref: `PRD.md` FR-EXP-05, AC-25
  - Selesai: Halaman `/expiry` (`ExpiryView.tsx`) dengan metric cards (Kedaluwarsa, Kritis ≤ 7 Hari, Peringatan ≤ 30 Hari, Total Nilai Risiko), filter status, dan modal pemusnahan barang (`WriteOffModal.tsx`) via ledger movement `DAMAGE_SPOILAGE` & audit log.
- [x] **T4.04 Laporan Penjualan & Estimasi Laba Kotor**
  - Ref: `PRD.md` FR-RPT-01..03, AC-26..28
  - Selesai: `ReportService.getSalesReport` menghitung omzet kotor, total diskon, refund retur, omzet bersih, jumlah transaksi, rata-rata keranjang (basket size), dan estimasi laba kotor & % margin. Ditampilkan di tab laporan `/reports`. Teruji di `tests/integration/services/reports.test.ts`.
- [x] **T4.05 Laporan Stok, Fast-Moving, dan Kinerja Sesi Kasir**
  - Ref: `PRD.md` FR-RPT-04..06, AC-29, AC-30
  - Selesai: `ReportService.getProductPerformance` (ranking produk terlaris), `getInventoryValuationReport` (status stok & valuasi total), dan `getCashierSessionsReport` (rekonsiliasi kas aktual vs diharapkan & selisih). Teruji di `tests/integration/services/reports.test.ts`.
- [x] **T4.06 Ekspor Laporan CSV**
  - Ref: `PRD.md` FR-RPT-07, AC-31
  - Selesai: `ReportService.exportToCsv` mengekspor seluruh laporan tab aktif dengan header kolom rapi dan UTF-8 BOM (`\uFEFF`) agar kompatibel dibuka di Microsoft Excel.

---

## Fase 5: Backup, Audit, Pengaturan & Hardening (BKP, AUD, SET) (Fase Aktif)

- [ ] **T5.01 Backup Manual Terenkripsi/Validasi Checksum**
  - Ref: `PRD.md` FR-BKP-01..02, BR-28, AC-32
  - Selesai bila: Ekspor berkas `.json.gz` berisi seluruh tabel IndexedDB disertai metadata manifest & SHA-256 checksum.
- [ ] **T5.02 Restore Database & Pengujian Integritas**
  - Ref: `PRD.md` FR-BKP-03..04, AC-33
  - Selesai bila: Berkas backup divalidasi checksum & versi skema sebelum diimpor; konfirmasi destruktif AlertDialog wajib dijawab.
- [ ] **T5.03 Layanan & Viewer Audit Log**
  - Ref: `PRD.md` FR-AUD-01..03, AC-34, AC-35
  - Selesai bila: Tabel `audit_logs` append-only mencatat pengguna, waktu, aksi sensitif, payload before/after; UI audit viewer untuk Owner.
- [ ] **T5.04 Pengaturan Toko & Hak Akses Pengguna**
  - Ref: `PRD.md` FR-SET-01..04, AC-36
  - Selesai bila: Kelola nama toko, alamat struk, batas diskon, ambang opname, dan manajemen pengguna/peran.
- [ ] **T5.05 Hardening PWA & Pengujian Mode Pesawat**
  - Ref: `PRD.md` AC-37..42, `ARCHITECTURE.md` §8
  - Selesai bila: Service worker mem-precache seluruh shell & asset font; 100% alur kasir dan katalog berfungsi normal saat offline.

---

## Pertanyaan Terbuka & Catatan Produk
- [OQ-01]: Font editorial menggunakan bundle font lokal `Fraunces` / `Newsreader` dengan fallback serif.
- [OQ-02]: Default format mata uang Rupiah integer tanpa sen.
- [OQ-03]: Batas diskon kasir default 5% (di atas itu butuh approval Supervisor/Owner).

---

## Catatan Kemajuan
- 2026-10-24: Dokumen `TASKS.md` dibuat. Memulai pengerjaan T0.01.
