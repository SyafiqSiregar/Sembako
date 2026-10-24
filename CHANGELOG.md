# CHANGELOG — SembakoOS

Catatan seluruh perubahan, implementasi fitur, pembaruan skema, dan keputusan arsitektur (ADR).

Format mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

## [Fase 4: Batch, Kedaluwarsa & Laporan] - 2026-10-25

### Ditambahkan
- Modul Batch & Kedaluwarsa: `BatchService` untuk pembuatan batch dengan kode & tanggal kedaluwarsa, pemantauan status kedaluwarsa (`EXPIRED`, `CRITICAL` H-7, `WARNING` H-30, `SAFE`), dan pemusnahan barang rusak/kedaluwarsa (`writeOffBatch`) yang menghasilkan pergerakan `DAMAGE_SPOILAGE` serta audit log (FR-EXP-01..02, FR-EXP-05..06, AC-25).
- Alokasi Penjualan FEFO (First-Expired First-Out): `BatchService.allocateFefo` otomatis dialokasikan dalam transaksi kasir `CheckoutService.processCheckout` untuk batch berumur simpan terdekat, dan pemblokiran penjualan barang yang sudah kedaluwarsa (`expiry_date < today`) (FR-EXP-03..04, AC-24).
- Validasi Wajib Batch pada Penerimaan Barang: `GoodsReceiptService.createAndPostReceipt` mewajibkan kode batch dan format tanggal YYYY-MM-DD untuk produk dengan `track_expiry = 1` (AC-23).
- Layar Monitoring Batch & Kedaluwarsa: `ExpiryView.tsx` (`/expiry`) dengan ringkasan status batch, indikator nilai risiko rupiah, filter status, dan modal pemusnahan (`WriteOffModal.tsx`).
- Modul Laporan & Analitik Bisnis: `ReportService` menghitung omzet kotor, total diskon, refund retur, omzet bersih, jumlah transaksi, rata-rata keranjang (basket size), estimasi laba kotor & % margin, ranking produk terlaris (fast-moving), status stok & valuasi persediaan, dan rekonsiliasi kas per sesi (FR-RPT-01..07, AC-26..30).
- Ekspor Laporan CSV UTF-8: `ReportService.exportToCsv` mengekspor seluruh laporan tab aktif dengan UTF-8 BOM (`\uFEFF`) agar kompatibel dibuka di Microsoft Excel (FR-RPT-08, AC-31).
- Layar Antarmuka Laporan: `ReportsView.tsx` (`/reports`) dengan 4 tab interaktif, filter rentang waktu (Hari Ini, 7 Hari, Bulan Ini, Semua), dan kartu ringkasan metrik.
- 61 unit & integration tests Vitest (seluruhnya lulus hijau).
- Bukti visual verifikasi browser subagent pada halaman `/expiry` dan seluruh tab laporan `/reports`.

---

## [Fase 3: Inventaris & Pemasok] - 2026-10-25

### Ditambahkan
- Modul Kartu Stok: `InventoryService.getStockCard` menghitung kronologi mutasi (masuk, keluar, saldo berjalan) dengan filter jenis referensi dan modal visual `StockCardModal.tsx` (FR-INV-01, AC-18).
- Modul Penyesuaian Stok Manual: `InventoryService.adjustStock` mewajibkan alasan, otorisasi PIN Supervisor bila selisih melampaui batas ambang (Rp 100.000 atau 10 unit), dan menghasilkan `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` movement serta audit log (FR-INV-02, BR-18, AC-19).
- Modul Manajemen Pemasok: `SupplierService` untuk CRUD data distributor/supplier dengan pengarsipan non-destruktif (`active = 0`), validasi Zod, form modal `SupplierFormModal.tsx`, dan halaman `/suppliers` (FR-SUP-01..02).
- Modul Penerimaan Barang (Goods Receipt): `GoodsReceiptService.createAndPostReceipt` atomik, mencatat nomor faktur & tanggal terima, menghitung moving weighted average cost (`cost_x10k`), update riwayat `price_history`, dan menambah saldo stok via movement `PURCHASE_RECEIPT` (FR-SUP-03..05, BR-12, AC-20).
- Modul Stok Opname Fisik: `StocktakeService` untuk pembuatan sesi opname bertarget (seluruh toko atau per kategori), snapshot kuantitas sistem otomatis `system_qty_snapshot`, mode hitung blind/terlihat, kalkulasi selisih & nilai rupiah (`getReviewData`), dan posting atomik via `STOCKTAKE_ADJUSTMENT` movement dengan otorisasi Supervisor/Owner (FR-INV-03..05, BR-19, BR-20, AC-21, AC-22).
- Audit Konsistensi Ledger (INV-01): `InventoryService.reconcileStockLedger` untuk memverifikasi kesesuaian saldo fisik dengan akumulasi mutasi ledger.
- 52 unit & integration tests Vitest (seluruhnya lulus hijau).
- Verifikasi browser subagent pada halaman `/inventory` (audit konsistensi, kartu stok, modal stok opname) dan `/suppliers` (daftar pemasok, dialog tambah pemasok).

---

## [Fase 2: Kasir POS & Transaksi Penjualan] - 2026-10-25

### Ditambahkan
- Modul Satu Pintu Stok: `InventoryService` untuk seluruh mutasi stok via `recordMovement`, mencatat ledger immutable di `stock_movements` & `stock_movement_items`, dan memperbarui `inventory_balances` secara atomik di dalam transaksi Dexie yang sama (AC-18, BR-01).
- Modul Checkout Atomik & Idempoten: `CheckoutService` dengan kunci idempotensi `saleId` untuk mencegah double charge (AC-03), verifikasi sesi kasir aktif, pemotongan stok otomatis via `InventoryService`, rollback total jika stok tidak mencukupi (AC-04), dan validasi uang diterima ≥ total (AC-17).
- Modul Void & Retur: `voidSale` dengan otorisasi Supervisor PIN + alasan wajib, reversal stok via `SALE_VOID`, dan audit log (AC-07). `processReturn` memvalidasi kuantitas retur tidak melebihi sisa pembelian, mengembalikan stok via `CUSTOMER_RETURN`, mencatat pengembalian dana, dan update status transaksi asal (AC-08).
- Store Keranjang POS: `posStore.ts` (Zustand) dengan scan barcode, stepper quantity (`-`/`+`), diskon per baris dan diskon transaksi, serta kalkulasi total realtime.
- Tahan & Pulihkan Transaksi (Held Carts): `HeldCartService` & `HeldCartsModal.tsx` untuk memparkir keranjang belanja ke Dexie `held_carts` dengan nama/catatan pelanggan dan memulihkannya kembali (AC-05).
- Antarmuka Kasir POS: `PosView.tsx` 2-kolom tablet (kiri: auto-focus scanner input, quick search, category pills, product grid card dengan stock status badge; kanan: keranjang kasir, stepper, discount triggers, dan tombol Bayar 56px).
- Dialog Pembayaran & Struk: `PaymentDialog.tsx` dengan preset pecahan Rupiah (Uang Pas, 50rb, 100rb, 200rb) dan kalkulasi kembalian ukuran `display`. `ReceiptModal.tsx` dengan format 58mm/80mm, rincian barang, total, tunai, kembalian, dan cetak via `window.print()`.
- Halaman Riwayat Transaksi: `TransactionHistoryView.tsx` (`/transactions`) dengan filter periode & status, detail struk, reprint receipt, otorisasi void, dan dialog retur pelanggan.
- 45 unit & integration tests Vitest (seluruhnya lulus hijau).
- Bukti visual rekaman browser subagent (`pos_checkout_flow_1792863139517.webp`) dan tangkapan layar receipt & transaction history.

---

## [Fase 1: Akses & Katalog Produk] - 2026-10-24

### Ditambahkan
- Modul Auth & PIN: Hashing PBKDF2-SHA256 dengan salt unik per user, verifikasi timing-safe, proteksi lockout 5 menit setelah 5x gagal berturut-turut, dan pencatatan audit log `auth.lockout` (AC-31).
- Modul Sesi Kasir: `CashierSessionService` untuk buka/tutup kasir dengan modal awal, aturan 1 sesi aktif per perangkat, dan rekonsiliasi kas (catatan wajib jika ada selisih, AC-32).
- Komponen UI Autentikasi: `PinPad` 56px, `LockScreenModal` untuk kunci layar instan, dan `CashierSessionModal` untuk modal buka/tutup kasir.
- Modul Katalog: `CatalogService` untuk CRUD kategori & produk dengan multi-satuan, validasi keunikan barcode dengan menyebut nama produk pemilik (AC-38), pencatatan otomatis di `price_history` saat harga jual berubah (AC-10), dan pengarsipan produk aman (AC-39).
- Modul Pencarian In-Memory: `ProductSearchIndex` untuk lookup barcode instan O(1), pencarian prefix nama, dan pencarian fuzzy toleran typo ringan.
- Halaman Antarmuka Katalog: `ProductCatalogView` interaktif dengan filter kategori, search bar, status stok, form modal tambah/edit produk, dan modal impor CSV (`CsvImportModal`).
- 32 unit & integration tests Vitest (seluruhnya lulus hijau).
- Verifikasi browser subagent pada katalog produk, modal tambah produk, modal CSV, dan flow kunci/buka layar kasir dengan PIN 123456.

---

## [Fase 0: Fondasi Teknis & Scaffolding] - 2026-10-24

### Ditambahkan
- Inisialisasi dokumen arsitektur dan tata kelola: `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DESIGN_SYSTEM.md`, `TASKS.md`, `TESTING.md`.
- Inisialisasi Git repository dan aturan `.gitignore`.
- Scaffold Vite + React 18 + TypeScript strict + Tailwind CSS + Vitest.
- Design tokens di `globals.css` (latar krem hangat `#FBF8F3`, teks `#12202B`, primary `#14463C`, warna status semantik, radius kartu 16px, font Inter & Fraunces).
- Database lokal IndexedDB melalui Dexie (`src/data/db.ts`) dengan 17 tabel sesuai skema v1 dan seed peran dasar (`owner`, `supervisor`, `cashier`, `stock_clerk`).
- Modul domain murni `domain/money` (integer Rupiah, zero-loss split) dan `domain/quantity` (integer `qty_base`).
- Shell navigasi responsif tablet mengadaptasi layout dashboard editorial ORBIT.
