# TASKS — SembakoOS

Daftar tugas implementasi bertahap untuk SembakoOS. Mengikuti `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, dan `DESIGN_SYSTEM.md`.

| Atribut | Nilai |
| --- | --- |
| Versi dokumen | 1.1 |
| Tanggal | 25 Oktober 2026 |
| Status | Fase 0–5 Selesai 100% & Terverifikasi (Penyempurnaan UI/UX Unified Card Selesai) |

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

## Fase 5: Backup, Audit, Pengaturan & Hardening (BKP, AUD, SET) (Selesai 100%)

- [x] **T5.01 Backup Manual Terenkripsi/Validasi Checksum**
  - Ref: `PRD.md` FR-BKP-01..02, BR-28, AC-32
  - Selesai: `BackupService.exportBackup` mengekspor seluruh tabel IndexedDB, menyertakan metadata manifest (app version, schema version, record count), dan menghitung SHA-256 checksum yang divalidasi. Mencatat ke `backup_history`. Teruji di `tests/integration/services/backup-restore.test.ts`.
- [x] **T5.02 Restore Database & Pengujian Integritas**
  - Ref: `PRD.md` FR-BKP-03..04, AC-33
  - Selesai: `BackupService.validateBackup` memverifikasi integritas checksum SHA-256 dan versi skema sebelum diizinkan restore. `restoreBackup` mengeksekusi pemulihan data atomik di dalam transaksi Dexie dan mencatat audit log `system.restore`. Modal konfirmasi destruktif (`BackupRestoreTab.tsx`). Teruji di `tests/integration/services/backup-restore.test.ts`.
- [x] **T5.03 Layanan & Viewer Audit Log**
  - Ref: `PRD.md` FR-AUD-01..03, AC-34, AC-35
  - Selesai: `AuditService.listAuditLogs` mengambil seluruh jejak audit append-only dengan filter aksi/aktor. `AuditViewerTab.tsx` menampilkan badge semantik dan modal inspector detail Before/After JSON. Teruji di `tests/integration/services/settings-audit.test.ts`.
- [x] **T5.04 Pengaturan Toko & Hak Akses Pengguna**
  - Ref: `PRD.md` FR-SET-01..04, AC-36
  - Selesai: `SettingsService` mengelola identitas toko (nama toko, alamat struk, telepon, footer) dan kebijakan batas keamanan. Manajemen staf pengguna dengan peran (`owner`, `supervisor`, `cashier`, `stock_clerk`), pembuatan pengguna baru, reset PIN 6-digit terenkripsi PBKDF2, dan toggle status aktif/nonaktif (`StoreSettingsTab.tsx`, `UserManagementTab.tsx`). Teruji di `tests/integration/services/settings-audit.test.ts`.
- [x] **T5.05 Hardening PWA & Pengujian Mode Pesawat**
  - Ref: `PRD.md` AC-37..42, `ARCHITECTURE.md` §8
  - Selesai: `public/manifest.json` standalone orientation landscape, `public/sw.js` precache app shell & assets offline fallback, pendaftaran service worker di `main.tsx`, dan 100% data transaksi tersimpan lokal di IndexedDB Dexie. Teruji dengan build produksi `pnpm build` hijau.

---

## Fase 6: Penyempurnaan Pasca-MVP (rincian: `rencana_lanjutan.md`)

Urutan: Opsi 3 (struk) → Opsi 2 (auto-lock) → Opsi 1 (barcode & label) → Opsi 4 (UAT).

### Opsi 3 — Struk & Printer Thermal (kode & tes selesai; menunggu uji perangkat)

- [x] **T6.01 Utilitas cetak terisolasi** — `src/lib/print.ts` (iframe tersembunyi), `src/lib/html.ts` (`escapeHtml` bersama).
- [x] **T6.02 Pengaturan struk** — `StoreSettings.defaultPaperWidth` (`58mm`/`80mm`, bawaan 58mm) dan `showReturnPolicyOnReceipt` (bawaan aktif); validasi lebar kertas di `SettingsService`.
- [x] **T6.03 Generator struk monospace** — `src/services/receipt.service.ts` (32 kolom/58mm, 48 kolom/80mm, penanda SALINAN saat cetak ulang, struk uji tanpa data rekaan). Tes: `tests/unit/services/receipt.test.ts` (11), `tests/integration/services/receipt-print.test.ts` (5).
- [x] **T6.04 Redesain `ReceiptModal` + sambungan Pengaturan + cetak ulang riwayat** — identitas & footer struk kini dari Pengaturan; token desain; cetak ulang lewat `sale.reprint`.
- [x] **T6.05 Bagian "Struk & Printer" di Pengaturan** — pilihan kertas bawaan, sakelar batas retur, tombol Cetak Struk Uji.
- Belum teruji di perangkat: RC-M01–M04 (printer thermal 58/80 mm, Bluetooth/USB, tablet Android).

### Opsi 1 — Barcode Internal Toko (EAN-13) & Cetak Label Rak/Produk (FR-CAT-11)

- [x] **T6.09 Checksum EAN-13, encoder bit modul, & pure SVG renderer** — `src/domain/barcode/ean13.ts` (awalan GS1 internal 20, modul 95-bit standar, guard bars panjang, teks human-readable, pure SVG tanpa pustaka luar). Tes: `tests/unit/domain/ean13.test.ts` (12 tes: BC-U01..BC-U12 termasuk property-based tests).
- [x] **T6.10 Generator barcode internal atomik & idempoten** — `CatalogService.assignInternalBarcode` di `src/services/catalog.service.ts` (sequence counter `internal_barcode_seq`, append-only audit log, verifikasi otorisasi `catalog.manage`, proteksi tabrakan). Tes: `tests/integration/catalog/internal-barcode.test.ts` (7 tes: BC-I01..BC-I08).
- [x] **T6.11 Tombol & integrasi barcode internal pada UI Katalog** — `ProductCatalogView.tsx` (tombol "+ Barcode", badge label per baris produk, integrasi modal cetak) dan `ProductFormModal.tsx` (tombol "Buat Barcode Internal" dengan indikator loading dan proteksi produk belum disimpan).
- [x] **T6.12 Generator lembar label stiker & Modal Cetak Label Interaktif** — `src/services/label.service.ts` (preset thermal 50×30 mm, 40×30 mm, HVS A4 3×8 70×37 mm; `@page` CSS; SVG barcode tajam `crispEdges`; proteksi harga dinamis BL-08) dan `src/features/catalog/LabelPrintModal.tsx` (pencarian produk, stepper kuantitas lembar, pemilihan ukuran kertas, pratinjau live SVG, dialog peringatan skala 100%, cetak via `printHtmlDocument`). Tes: `tests/unit/services/label.test.ts` (6 tes: LB-U01..LB-U06).
- Belum teruji di perangkat: printer barcode stiker / label roll thermal Bluetooth/USB di tablet Android.
- Belum bisa dijalankan: `pnpm lint` (ESLint tidak terpasang & tanpa konfigurasi di repo; lihat Pertanyaan Terbuka OQ-L07).

---

## Pertanyaan Terbuka & Catatan Produk
- [OQ-01]: Font editorial menggunakan bundle font lokal `Fraunces` / `Newsreader` dengan fallback serif.
- [OQ-02]: Default format mata uang Rupiah integer tanpa sen.
- [OQ-03]: Batas diskon kasir default 5% (di atas itu butuh approval Supervisor/Owner).
- [OQ-L01..L06]: Lihat `rencana_lanjutan.md` §6 (durasi auto-lock, nonaktifkan kunci, harga di label, kertas stiker, PIN saat buka aplikasi, definisi retur di laporan). Belum dijawab pemilik.
- [OQ-L07]: `pnpm lint` gagal — paket `eslint` tidak ada di `package.json` dan tidak ada berkas konfigurasi. Menambah ESLint = dependensi baru (butuh persetujuan, AGENTS.md §7). Rekomendasi: pasang ESLint flat config + `typescript-eslint` + aturan `no-explicit-any`; ada beberapa `any` di `authStore.ts`/`TransactionHistoryView.tsx` yang akan terdeteksi.
- [OQ-L08]: `PosView.loadCatalogData` mengisi stok 50 kemasan ke setiap produk bila total stok 0 (`INITIAL_BALANCE`). Ini data palsu di jalur produksi (AGENTS.md §3 Aturan 3). Tidak diubah di Opsi 3 karena di luar lingkup; perlu persetujuan pemilik karena mengubah perilaku yang berjalan.
- [OQ-L09]: `SettingsService.updateStoreSettings` belum memanggil `authorize(..., 'settings.manage')` (AGENTS.md §4.3). Tidak diubah di Opsi 3; usulan tugas terpisah.

---

## Catatan Kemajuan
- 2026-10-24: Inisialisasi proyek, arsitektur dasar, schema Dexie v1, domain money/quantity, dan layout ORBIT (Fase 0).
- 2026-10-25 (Pagi): Implementasi Fase 1 (Auth PIN, sesi kasir, katalog produk & multi-satuan) dan Fase 2 (POS touchscreen, checkout atomik, struk, held carts, void, retur).
- 2026-10-25 (Siang): Implementasi Fase 3 (Inventory ledger, stok opname blind/visible, pemasok & goods receipt), Fase 4 (Batch FEFO otomatis, expiry monitor, reports & CSV export), dan Fase 5 (Backup SHA-256, atomic restore, audit trail append-only, store settings, user management, PWA hardening).
- 2026-10-25 (Sore):
  - Dashboard live-query terintegrasi Dexie & modul bantuan operasional (`/help`).
  - Perbaikan bug duplikasi header Ringkasan Toko pada sub-halaman.
  - Pembersihan copy antislop: menghapus subtitle filler dan kode dokumen internal di seluruh halaman.
  - Redesain Unified Card Layout: menyatukan search & filter toolbar langsung ke Card Header pada seluruh view tabel.
  - Redesain halaman Pengaturan (`/settings`): segmented pill tabs, cards terpadu, dan token styling.
  - Pembuatan dokumentasi `README.md` komprehensif dan push repositori ke GitHub (`https://github.com/SyafiqSiregar/Sembako.git`).
  - Total 75 unit & integration tests lulus (100% green).
- 2026-10-27:
  - Implementasi Pembayaran Non-Tunai Manual (QRIS & Transfer Bank) di Kasir POS (FR-POS-18, A-02, OQ-10, BR-22).
  - Dialog pembayaran `PaymentDialog.tsx` mendukung QRIS statis, Transfer Bank (BCA, BRI, Mandiri, BNI, Lainnya), Debit/EDC, input catatan nomor referensi/nama pengirim, dan proteksi checkbox verifikasi dana masuk.
  - Parameter `referenceNo` diteruskan ke `CheckoutService.processCheckout` dan dicatat ke tabel `payments` IndexedDB.
  - Cetak struk kasir `ReceiptModal.tsx` dan tabel riwayat transaksi `TransactionHistoryView.tsx` menampilkan saluran non-tunai dan nomor referensi.
  - Penambahan 2 unit & integration tests baru di `checkout.test.ts` & `session.test.ts`, total 77 tests lulus (100% green).
  - **Penyempurnaan UI/UX Responsif Tablet Android (Portrait 800x1280 & Landscape 1024x768)**:
    - Sidebar adaptif: Slide-over Drawer overlay pada `< lg` via Hamburger Menu, Collapsible Rail 72px pada `≥ lg`.
    - POS Tablet Portrait: Tab switcher (Katalog vs Keranjang), Floating Bottom Cart Bar, kartu produk proporsional (`line-clamp-2`, `min-h-[115px]`, tap target ≥ 44px).
    - POS Tablet Landscape: 2-kolom berdampingan yang seimbang dan leluasa.
    - Topbar & Status Bar fleksibel tanpa teks wrapping bertumpuk.
    - Seluruh tabel data (`products`, `inventory`, `expiry`, `suppliers`, `transactions`, `reports`, `dashboard`, `settings`) dibekali `min-w` di dalam container `overflow-x-auto` yang aman untuk horizontal swipe di tablet Android.
    - Grafik Tren Penjualan Dashboard (`DashboardView.tsx`) dinamis: Sumbu X otomatis beralih antara format jam operasional (Hari Ini), tanggal harian (7 Hari), rentang 5-harian (30 Hari), dan periode bulanan (Semua), lengkap dengan kurva data akurat dan tooltip nilai rupiah.
    - Terverifikasi via `browser_subagent` dengan rekaman screenshot portrait & landscape, `pnpm typecheck`, `pnpm test` (77 tests passed), dan `pnpm build`.
- 2026-10-28:
  - **Sistem Multi-Satuan (Eceran & Dus), Onboarding Excel Resmi & Form Ramah Awam**:
    - **Clean Slate**: Menghapus auto-seed produk tiruan di `ProductCatalogView.tsx` sesuai `AGENTS.md` §3 Aturan 3. Database toko dimulai bersih tanpa bias data.
    - **Formulir Manual Ramah Awam (`ProductFormModal.tsx`)**: Terbagi dalam 3 kotak jelas (Informasi Barang, Eceran, dan Grosir/Dus opsional). Menghilangkan jargon teknis, menyediakan pilihan tombol satuan cepat, teks bantuan kalkulasi modal & untung otomatis, serta validasi barcode.
    - **Pembaruan Layanan Katalog (`CatalogService.ts`)**: `updateProduct` mendukung penambahan satuan grosir baru (`product_units`) dan barcode kemasan (`product_barcodes`) secara atomik dalam transaksi Dexie.
    - **Template Excel & Impor CSV (`CsvImportModal.tsx`)**: Tombol unduh template resmi format UTF-8 BOM yang langsung rapi di Excel, pemilih berkas CSV, dan parser yang mendukung data eceran serta dus/grosir sekaligus.
    - **Quick-Add Barcode di Kasir POS (`PosView.tsx`)**: Modal instan 10 detik saat kasir scan barcode belum terdaftar agar transaksi tidak terhambat.
    - **Tabel Katalog Multi-Satuan (`ProductCatalogView.tsx`)**: Menampilkan badge harga eceran dan dus/grosir berdampingan serta rincian barcode tiap kemasan.
    - **Pengujian & Verifikasi**: Pembuatan `multi-unit-onboarding.test.ts` (4 tes baru), total 81 tests lulus (100% green), `pnpm typecheck` (0 error), dan `pnpm build` sukses.
  - **Skenario Edit, Koreksi Transaksi, Retur Kondisi, Batas Hari, Void Sesi, Reversal Penerimaan & Timeline Audit**:
    - **GAP-01**: Retur barang berbasis kondisi (`sellable` -> `CUSTOMER_RETURN` saldo bertambah; `damaged`/`expired` -> `RETURN_WRITE_OFF` saldo tidak bertambah, dicatat kerugian). Konsistensi ledger & rekonsiliasi 100% terpenuhi.
    - **GAP-02 & GAP-06**: Pengaturan `returnDaysLimit` (default 7 hari) di `StoreSettings` dan tab Kebijakan Toko. Validasi umur transaksi memblokir retur kedaluwarsa.
    - **GAP-03**: Pembatasan void hanya pada transaksi dari sesi kasir aktif yang masih `open` (BR-17).
    - **GAP-04**: Tab filter `Aktif`, `Diarsipkan`, `Semua` serta tombol "Aktifkan" reaktivasi barang di `ProductCatalogView.tsx`.
    - **GAP-05**: Reversal penerimaan barang pemasok (`GoodsReceiptService.reverseReceipt`) via mutasi `REVERSAL` & audit log, dilengkapi tombol aksi di `SuppliersView.tsx`.
    - **GAP-07**: Panduan 3 langkah menangani produk duplikat langsung di `ProductCatalogView.tsx`.
    - **GAP-08**: Visual Kronologi & Timeline Audit per transaksi di modal rincian struk `TransactionHistoryView.tsx`.
    - **Pengujian**: 5 tes integrasi baru di `checkout.test.ts`, `product.test.ts`, dan `supplier-receipt.test.ts`. Total 86 tests lulus (100% green), typecheck 0 error, build produksi PWA sukses.
  - **Input Stok Awal & Tanggal Kedaluwarsa Langsung di Formulir Barang (`ProductFormModal.tsx` & `CatalogService.ts`)**:
    - Progressive disclosure: sub-card amber stok awal dan tanggal expired terbuka saat `trackExpiry` dicentang, atau input stok ringkas saat tidak dicentang.
    - `CatalogService.createProduct` secara atomik mendaftarkan batch (`product_batches`), membuat saldo (`inventory_balances`), dan mencatat mutasi ledger `INITIAL_BALANCE`.
    - Barang baru langsung siap dan bisa dijual di Kasir POS dengan alokasi FEFO.
    - Template & parser CSV mendukung kolom `stok_awal` dan `tanggal_kedaluwarsa`.
    - Pengujian: 4 tes integrasi baru di `initial-stock-expiry.test.ts`. Total 90 tests lulus (100% green), typecheck 0 error, build produksi PWA sukses.
- 2026-10-30:
  - **Perombakan Template Excel/CSV & Modal Impor Katalog Produk (`src/lib/csv.ts`, `CsvImportModal.tsx`, `csv.test.ts`)**:
    - **Template Kerja Excel Rapi (`.xls` Spreadsheet HTML/XML)**: 14 kolom terstruktur dalam 4 kelompok berwarna (A. Identitas Barang, B. Satuan & Harga Eceran, C. Kemasan Grosir/Dus Opsional, D. Stok Awal & Kedaluwarsa), lebar kolom otomatis, baris petunjuk pengisian, dan format teks (`mso-number-format:'\@'`) pada sel barcode agar angka `0` di depan tidak hilang dan barcode 13 digit tidak rusak menjadi notasi ilmiah `8.99E+12`.
    - **Template CSV Excel Indonesia (`.csv`)**: Pemisah titik koma (`;`) dengan UTF-8 BOM agar tidak menumpuk di Kolom A saat dibuka di Microsoft Excel regional Indonesia.
    - **Smart Multi-Format Parser (`src/lib/csv.ts`)**: Mendukung auto-detect pemisah Tab (`\t` hasil Copy-Paste langsung dari blok sel Excel), titik koma (`;`), koma (`,`), serta pembacaan langsung berkas `.xls` HTML Table. Otomatis melewati baris judul grup dan baris petunjuk, membersihkan rumus teks barcode `="089..."`, dan memvalidasi kelengkapan grosir, harga modal vs harga jual, tanggal kedaluwarsa, serta duplikasi barcode.
    - **Antarmuka Modal Impor Baru (`CsvImportModal.tsx`)**: Dilengkapi panel interaktif **"Panduan Struktur 14 Kolom & Contoh Pengisian"**, tombol **"Muat 3 Contoh Barang"**, dan tabel pratinjau lengkap 7 kolom (Baris #, Status, Nama & Barcode, Kategori, Modal/Jual Eceran, Grosir/Dus, Stok Awal & ED). Disempurnakan menjadi satu tombol utama **"Unduh Template Excel (.xls)"** dengan `mso-width-source:userset`.
    - **Pengujian**: 5 unit tests baru di `tests/unit/data/csv.test.ts`, total 95 tests lulus (100% green).
  - **Perombakan Halaman Laporan & Analitik + Ekspor Excel (`.xls`) & PDF Resmi A4 (`ReportsView.tsx`, `ReportPdfPreviewModal.tsx`, `report.service.ts`)**:
    - Perbaikan tipografi kartu metrik menggunakan `tabular-nums`, token warna semantik `DESIGN_SYSTEM.md`, badge status dengan ikon, pencarian cepat per tab, filter status stok, serta baris `<tfoot>` `TOTAL` otomatis di keempat tab laporan.
    - Penambahan fitur **`Unduh Excel (.xls)`** terformat rapi (`mso-width-source:userset`, kop toko, periode, dan baris total) menggantikan CSV mentah.
    - Penambahan fitur **`Ekspor PDF`** lengkap dengan **Modal Pratinjau Dokumen Laporan PDF (A4)**, Kop Identitas Toko, 4 Kotak Ringkasan KPI, Tabel + Total, dan Kolom Tanda Tangan Pemilik Toko.
    - **Pengujian**: Penambahan tes integrasi ekspor Excel & PDF di `tests/integration/services/reports.test.ts`, `pnpm typecheck` 0 error, dan `pnpm build` sukses.
- 2026-10-31:
  - **Opsi 3: Struk Thermal Terisolasi 58/80 mm & Pengaturan Struk (`receipt.service.ts`, `ReceiptModal.tsx`, `StoreSettingsTab.tsx`)**:
    - Generator struk teks terisolasi dengan lebar kertas 58mm (32 col) / 80mm (48 col), watermark cetak ulang, cetak via iframe terisolasi, dan tombol "Cetak Struk Uji" di Pengaturan.
    - 16 tes baru (`receipt.test.ts`, `receipt-print.test.ts`), `pnpm typecheck` lulus, `pnpm build` lulus.
  - **Bugfix Valuasi Persediaan & Konversi Satuan Dasar (`report.service.ts`, `inventory.service.ts`, `ReportsView.tsx`, `InventoryView.tsx`)**:
    - Mengatasi bug kalkulasi nilai persediaan Rp 40 Miliar akibat perkalian langsung kuantitas satuan dasar (`g` / `ml`) dengan biaya kemasan eceran tanpa dibagi faktor konversi kemasan (`conversion_factor`).
    - Memperbaiki formula: `Math.round((currentStock * costPerUnit) / factor)`. Nilai stok 4 produk kini terhitung akurat sebesar **Rp 11.000.000**.
    - Memperbaiki tampilan tabel di tab Status & Nilai Stok dan dokumen ekspor Excel/PDF agar menyajikan kuantitas kemasan dan rincian satuan dasar (misal `100 Sak (500.000 g)`), biaya satuan dengan keterangan kemasan (`Rp 65.000 / Sak 5 kg`), serta batas stok minimum yang relevan (`5 Sak`).
    - 1 tes baru di `reports.test.ts`, total 113 tes lulus (100% green), `pnpm typecheck` bebas error, `pnpm build` sukses.
  - **Opsi 1: Barcode Internal Toko (EAN-13) & Cetak Label Rak/Produk (`ean13.ts`, `label.service.ts`, `LabelPrintModal.tsx`, `ProductCatalogView.tsx`, `ProductFormModal.tsx`)**:
    - **Domain Barcode EAN-13 Murni**: Checksum Modulo 10 GS1, parity map 95 modul, guard bars 101/01010/101, SVG renderer tajam `shape-rendering="crispEdges"`, zero third-party dependencies (`src/domain/barcode/ean13.ts`).
    - **Layanan Pembuatan Barcode Atomik**: `CatalogService.assignInternalBarcode` dengan transaksi Dexie atomic, sequence counter `internal_barcode_seq`, append-only audit log, proteksi tabrakan sequence, otorisasi `catalog.manage`.
    - **Generator Cetak Label Multi-Ukuran**: `LabelService.buildLabelSheetHtml` mendukung thermal 50×30 mm, 40×30 mm, dan HVS A4 3×8 (70×37 mm) dengan CSS `@page` khusus print, barcode SVG proporsional, serta sakelar opsional `showPrice` (bawaan nonaktif sesuai BL-08) dan `showStoreName`.
    - **Antarmuka Modal Cetak Interaktif**: `LabelPrintModal.tsx` dengan pencarian barang cepat, pemilih ukuran kertas, stepper jumlah label, pratinjau live SVG realtime, dialog peringatan skala cetak 100%, dan cetak via iframe terisolasi (`printHtmlDocument`).
    - **Integrasi UI Katalog**: Tombol "Cetak Label" di toolbar katalog produk, tombol "Cetak Label" & "+ Barcode" per baris barang yang belum berbarcode, dan tombol "Buat Barcode Internal" pada formulir produk `ProductFormModal.tsx`.
    - **Pengujian Lengkap**: 25 tes baru (12 unit `ean13.test.ts`, 7 integrasi `internal-barcode.test.ts`, 6 unit `label.test.ts`). Total **138 tes lulus (100% green)**, `pnpm typecheck` 0 error, dan `pnpm build` sukses.

