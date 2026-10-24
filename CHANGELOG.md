# CHANGELOG — SembakoOS

Catatan seluruh perubahan, implementasi fitur, pembaruan skema, dan keputusan arsitektur (ADR).

Format mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

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
