# CHANGELOG — SembakoOS

Catatan seluruh perubahan, implementasi fitur, pembaruan skema, dan keputusan arsitektur (ADR).

Format mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

## [Simulasi UAT 1 Hari Penuh, Pemeriksa 6 Invarian Database & Checklist Lapangan (Fase 6, Pilihan B)] - 2026-10-31

**Implementasi Simulasi UAT End-to-End, Invariant Verifier, dan Panduan Checklist Fisik (PRD §8, DATABASE.md §5, rencana_lanjutan.md Opsi 4):**
- **Pemeriksa 6 Invarian Database Wajib (`src/domain/audit/verify-invariants.ts`):**
  - Implementasi fungsi audit basis data otomatis `verifyDatabaseInvariants(db)` yang memeriksa seluruh aturan integritas data:
    1. **INV-1 Konsistensi Saldo vs Mutasi Ledger:** Memverifikasi bahwa setiap baris `inventory_balances.qty_base` persis sama dengan jumlah mutasi `stock_movement_items.qty_delta_base` untuk setiap kombinasi `[product_id, batch_id]`.
    2. **INV-2 Kekekalan Riwayat Ledger & Audit Log:** Memastikan seluruh record `stock_movements` memiliki minimal 1 rincian item, `user_id`, waktu UTC integer, dan tabel `audit_logs` utuh tanpa data corrupt.
    3. **INV-3 Integritas Uang Integer Rupiah & Rekonsiliasi Kas:** Seluruh nilai rupiah pada `payments`, `sales`, `returns`, dan `cashier_sessions` adalah integer positif/nol (dilarang pecahan desimal), serta rekonsiliasi kas sesi tertutup valid.
    4. **INV-4 Keutuhan Snapshot Transaksi:** Memastikan setiap item penjualan memiliki snapshot harga jual (`unit_price_snapshot`), modal pokok (`unit_cost_x10k_snapshot`), nama barang, dan satuan.
    5. **INV-5 Validitas Alokasi Batch & Expiry (FEFO):** Memastikan seluruh produk ber-expiry yang terjual tercatat alokasi batch-nya di `sale_item_batches` seimbang 100% dengan kuantitas yang dibeli (`sale_items.qty_base`).
    6. **INV-6 Larangan Saldo Negatif:** Memvalidasi tidak ada saldo fisik yang bernilai minus di bawah 0.
  - Perintah CLI otomatis: script `"db:check"` di `package.json` yang menjalankan `tests/integration/services/db-check.test.ts`.
- **Perbaikan Alokasi Batch Kasir (`src/services/checkout.service.ts`):**
  - Menghubungkan proses checkout dengan tabel `sale_item_batches` secara atomik di dalam transaksi Dexie checkout, menjamin seluruh alokasi batch FEFO tercatat permanen untuk audit jejak penarikan produk kedaluwarsa.
- **Skenario Integrasi UAT Satu Hari Penuh (`tests/integration/scenarios/full-day-operations.test.ts`):**
  - Menguji siklus hidup 1 hari operasional toko sembako dari buka kas hingga tutup toko:
    - **07:30 WIB**: Buka sesi kasir pagi dengan modal laci Rp 200.000.
    - **08:00–11:00 WIB (POS Sales)**:
      1. Transaksi tunai uang pas: 2 Pouch Minyak Goreng 2L (@ Rp 34.000) = Rp 68.000.
      2. Transaksi multi-satuan grosir & FEFO otomatis: 1 Dus Indomie Goreng (40 pcs) = Rp 130.000 (sistem otomatis memotong habis Batch 1 yang expired lebih dekat).
      3. Transaksi barcode internal toko prefix 20 non-tunai: 2 kg Beras Curah Repack = Rp 35.000 dibayar via QRIS statis.
      4. Skenario tahan keranjang (*Hold Cart*): Pelanggan A pesan beras curah, ditahan; kasir layani Pelanggan B (Sabun Cuci Rp 12.000 tunai); keranjang Pelanggan A dipulihkan kembali dengan diskon kupon Rp 5.000 dibayar tunai Rp 65.000.
    - **11:30 WIB (Goods Receipt)**: Penerimaan 50 pouch minyak goreng modal baru Rp 28.500 dari PT Sumber Pangan Sejahtera, saldo inventaris bertambah menjadi 68 pouch (136.000 ml).
    - **14:00 WIB (Pengecualian Kasir)**: Void transaksi Pelanggan B (salah input barang); Retur 1 pouch minyak goreng kemasan bocor (*Damaged*), refund uang tunai Rp 34.000 keluar dari kas, stok tidak bertambah karena barang rusak.
    - **16:30 WIB (Penyesuaian Stok)**: Pemusnahan 1 bungkus mie instan rusak di rak toko via `DAMAGE_SPOILAGE`.
    - **21:00 WIB (Tutup Kasir)**: Rekonsiliasi kas fisik laci (Rp 200.000 + 68.000 + 130.000 + 65.000 - 34.000 = Rp 429.000) dengan selisih tepat Rp 0. Sesi kasir terkunci dan ditutup rapi.
    - **21:30 WIB (Pencadangan Data)**: Ekspor backup database terenkripsi SHA-256 hex string 64-karakter.
    - **Verifikasi Invarian**: Menjalankan `verifyDatabaseInvariants(db)` dengan hasil 100% lulus (6/6 invarian).
- **Panduan & Lembar Checklist UAT Manual (`docs/uat-checklist-manual.md`):**
  - Lembar checklist terstruktur dengan 14 tahapan uji coba lapangan di tablet Android nyata dan printer thermal ESC/POS 58/80 mm, serta verifikasi mutu fisik cetak struk kasir.
- **Verifikasi & Build:**
  - `pnpm typecheck`: 0 errors.
  - `pnpm db:check`: 2 tests passed.
  - `pnpm test`: 31 files, 151 tests passed (100% green).
  - `pnpm build`: Vite bundle production berhasil (806 kB JS, 47.8 kB CSS).

---

## [Modernisasi Struk Kasir & Logo Toko Thermal (Fase 6)] - 2026-10-31

**Penyempurnaan Desain Struk Kasir Profesional & Logo Toko Thermal (PRD FR-POS-10, Opsi 3 Lanjutan):**
- **Domain Barcode Code-128 Murni (`src/domain/barcode/code128.ts`):**
  - Encoder alfanumerik Code-128 Set B lengkap dengan checksum Modulo 103 dan stop code 13-modul.
  - Fungsi `getCode128Bars` yang menghitung baris modul untuk rendering JSX tanpa `dangerouslySetInnerHTML` (AGENTS.md §4.3).
  - Generator SVG `renderCode128Svg` berdimensi millimeter presisi dengan `shape-rendering="crispEdges"` agar barcode nomor struk terbaca scanner barcode kasir 1D.
- **Konfigurasi Logo Toko & Filter Thermal (`src/services/settings.service.ts` & `StoreSettingsTab.tsx`):**
  - Penambahan properti `storeLogo?: string` (Data URL Base64) dan `printReceiptBarcode?: boolean` (default `true`) pada `StoreSettings`.
  - Pemrosesan gambar di sisi browser (*Canvas threshold filter* dari skill `ui-ux-pro-max`): otomatis mengonversi gambar logo berwarna ke 1-bit monochrome berkontras tinggi agar tajam pada head pemanas printer thermal.
  - Komponen pratinjau logo di menu Pengaturan dengan badge status "Siap Cetak Thermal", tombol "Ganti", dan "Hapus".
- **Generator Struk Kasir & Tipografi Retail (`src/services/receipt.service.ts`):**
  - Header struk otomatis menyertakan logo toko rata tengah jika tersedia, atau monogram inisial toko (mis. `[ SB ]`) jika logo belum diunggah.
  - Garis pemisah putus-putus khas retail (`border-top: 1px dashed #000;`), tipografi nama toko lebih tebal dan berwibawa, dan blok `TOTAL` tegas bergaris ganda.
  - Barcode nomor struk dicetak di bawah ucapan terima kasih untuk scan retur instan.
- **Pratinjau Kertas Thermal Nyata (`src/features/pos/ReceiptModal.tsx`):**
  - Pratinjau struk di layar kasir bergaya kertas thermal fisik dengan bayangan lembut, logo toko nyata, dan barcode nomor struk.
- **Integrasi Scan-to-Return di POS (`src/features/pos/PosView.tsx` & `TransactionHistoryView.tsx`):**
  - Kasir dapat langsung men-scan barcode pada struk (`STR-...`) di kasir POS untuk secara otomatis membuka riwayat transaksi atau memproses retur barang.
- **Verifikasi:** `pnpm typecheck` lulus; `pnpm test` 29 berkas / 148 tes lulus (100% green); `pnpm build` sukses.

---

## [Barcode Internal Toko (EAN-13) & Cetak Label Rak/Produk (Fase 6, Opsi 1)] - 2026-10-31

**Implementasi Fitur Barcode Internal & Label Stiker (PRD FR-CAT-11, rencana_lanjutan.md Opsi 1):**
- **Domain Barcode EAN-13 Murni (`src/domain/barcode/ean13.ts`):**
  - Implementasi standar internasional GS1 restricted distribution prefix `20`–`29` untuk item internal toko sembako curah/repack (beras karungan repack, gula curah kiloan, telur pack).
  - Algoritma perhitungan Check Digit Modulo 10 dengan bobot selang-seling 1 dan 3.
  - Encoder 95 modul EAN-13 (Left Guard `101`, 6 digit kiri dengan parity map L/G dari digit pertama, Center Guard `01010`, 6 digit kanan pola R, Right Guard `101`).
  - SVG Renderer murni tanpa dependensi eksternal: menghasilkan elemen SVG berdimensi presisi milimeter, baris garis hitam dengan `shape-rendering="crispEdges"` agar tajam saat dicetak printer thermal 203 DPI, guard bars lebih panjang 2mm, dan label teks angka di bagian bawah.
- **Layanan Pembuatan Barcode Atomik (`CatalogService.assignInternalBarcode`):**
  - Eksekusi di dalam satu transaksi Dexie atomic (`products`, `product_units`, `product_barcodes`, `counters`, `audit_logs`).
  - Sequence generator terpusat menggunakan tabel `counters` (`internal_barcode_seq`), dimulai dari `1` menghasilkan barcode berformat `2000000000015`.
  - Proteksi tabrakan sequence hingga 50 iterasi otomatis jika terdapat kode yang telah terdaftar.
  - Verifikasi hak akses `authorize(roles, 'catalog.manage')`.
  - Pencatatan jejak audit append-only (`catalog.barcode_internal_create`) lengkap dengan snapshot nama produk, satuan, dan barcode yang dibuat.
- **Generator Dokumen Cetak Label Multi-Ukuran (`src/services/label.service.ts`):**
  - Mendukung 3 preset kertas stiker:
    1. Roll Thermal 50×30 mm (1 label per halaman continuous).
    2. Roll Thermal 40×30 mm (1 label per halaman continuous, modul 0.25mm ringkas).
    3. Lembar HVS / Label Stiker A4 3×8 (24 label per lembar, ukuran 70×37 mm dengan margin 10mm).
  - Styling cetak `@page` khusus print dengan margin nol dan penanganan page-break terisolasi.
  - Konfigurasi `showPrice`: bawaan mati (`false`) untuk menghindari kerugian toko bila harga katalog berubah tetapi label fisik belum diganti (BL-08). Menampilkan peringatan jelas saat diaktifkan.
- **Antarmuka Modal Cetak Label Interaktif (`src/features/catalog/LabelPrintModal.tsx`):**
  - Kotak pencarian produk katalog cepat dengan status barcode (tanda centang hijau bila sudah ada barcode, tombol "+ Buat Barcode" bila belum berbarcode).
  - Panel daftar cetak dengan stepper kuantitas lembar per barang (`-` / `+`) dan tombol hapus.
  - Tab pemilihan ukuran kertas (Thermal 50×30, 40×30, A4 3×8) dengan ringkasan total stiker dan lembar kertas.
  - Pratinjau langsung (Live Preview) berskala proporsional yang merender SVG barcode secara nyata.
  - Dialog catatan penting panduan cetak (atur skala printer 100% / Actual Size).
  - Tombol aksi "Cetak N Label" yang mengalirkan HTML ke iframe tersembunyi via `printHtmlDocument`.
- **Integrasi Halaman Katalog (`ProductCatalogView.tsx` & `ProductFormModal.tsx`):**
  - Tombol toolbar utama "Cetak Label" di samping tombol tambah produk.
  - Tombol aksi per baris produk: ikon printer "Cetak Label" dan tombol "+ Barcode" untuk membuat barcode internal secara instan.
  - Tombol "Buat Barcode Internal" di samping input barcode satuan eceran pada formulir produk `ProductFormModal.tsx`.
- **Verifikasi & Pengujian:**
  - 12 unit tests di `tests/unit/domain/ean13.test.ts` (termasuk property-based testing dengan `fast-check` untuk ratusan ribu kemungkinan digit).
  - 7 integration tests di `tests/integration/catalog/internal-barcode.test.ts` (verifikasi transaksi atomik, sequence counter, audit log, otorisasi, penolakan barcode ganda).
  - 6 unit tests di `tests/unit/services/label.test.ts` (validasi HTML print sheet, CSS page rules, format harga, preset ukuran).
  - Total pengujian: **28 berkas uji, 138 tes lulus (100% green)**.
  - `pnpm typecheck` lulus 0 error, `pnpm build` sukses.

---



**Perbaikan Bug Unit Conversion Mismatch (AGENTS.md §4.1, PRD FR-RPT-05, AC-30):**
- **Penyebab masalah nilai stok Rp 40 Miliar:**
  Sistem menyimpan kuantitas stok produk berat dan volume dalam satuan dasar terkecil (`g` dan `ml`), misalnya Beras 100 karung = `500.000 g`, Minyak 100 pouch = `200.000 ml`, Gula 100 bungkus = `100.000 g`. Namun pada `report.service.ts`, `inventory.service.ts`, `batch.service.ts`, dan `stocktake.service.ts`, nilai valuasi persediaan dihitung dengan mengalikan kuantitas stok dasar langsung dengan harga modal kemasan (`currentStock * costPerUnit`), tanpa dibagi dengan faktor konversi satuan (`conversion_factor`). Akibatnya `500.000 g x Rp 65.000 = Rp 32.500.000.000` (dihitung Rp 65.000 per gram!), menghasilkan total fiktif Rp 40.000.000.000.
- **Perbaikan formula:**
  Valuasi persediaan kini dibagi dengan `conversion_factor`: `Math.round((currentStock * costPerUnit) / factor)`.
  Hasil valuasi sebenarnya adalah:
  - Beras Rojo Lele 5 kg: 100 sak @ Rp 65.000 = **Rp 6.500.000** (bukan Rp 32,5 Miliar)
  - Minyak Goreng Sovia 2 L: 100 pouch @ Rp 30.000 = **Rp 3.000.000** (bukan Rp 6 Miliar)
  - Gula Pasir Gulaku 1 kg: 100 bungkus @ Rp 15.000 = **Rp 1.500.000** (bukan Rp 1,5 Miliar)
  - Indomie Goreng: 0 pcs = **Rp 0**
  - **TOTAL NILAI PERSEDIAAN:** **Rp 11.000.000**
- **Penyempurnaan tampilan:**
  - `ReportsView.tsx` (Tab Status & Nilai Stok) dan dokumen ekspor Excel/PDF kini menampilkan kuantitas kemasan dengan rincian satuan dasar, contoh: `100 Sak (500.000 g)`.
  - Kolom Biaya Satuan kini mencantumkan satuan kemasan secara transparan: `Rp 65.000 / Sak 5 kg`.
  - Kolom Batas Minimum tidak lagi menampilkan `5 g` (setengah sendok teh), melainkan `5 Sak`.
  - Baris total bawah tidak lagi menjumlahkan gram + ml + pcs menjadi `800000 unit`, melainkan menampilkan total kemasan dan total valuasi Rp 11.000.000.
  - `InventoryView.tsx` menyelaraskan tampilan kuantitas dan estimasi nilai persediaan.

**Verifikasi:** `pnpm typecheck` lulus; `pnpm test` 113 lulus (+1 tes baru verifikasi konversi satuan AC-30); `pnpm build` lulus.

---

## [Struk Thermal Terisolasi 58/80 mm & Pengaturan Struk (Fase 6, Opsi 3)] - 2026-10-31

**Perubahan perilaku (dilindungi tes regresi):**
- **Struk kini memakai identitas toko dari Pengaturan.** Sebelumnya `PosView` tidak meneruskan nama/alamat/telepon sehingga struk selalu mencetak nilai bawaan komponen (`Jl. Pasar Tradisional No. 12`). `receiptFooter` yang selama ini tersimpan tetapi tidak dipakai kini dicetak.
- **Footer larangan retur dihapus.** Teks tetap *"Barang yang dibeli tidak dapat ditukar/dikembalikan"* bertentangan dengan kebijakan retur toko (`returnDaysLimit`). Diganti baris kebijakan dinamis *"Retur maks. N hari sejak tanggal beli, bawa struk ini."* (dapat dimatikan; tidak dicetak bila batas 0 hari karena PRD belum mendefinisikan artinya).
- **Cetak tidak lagi mencetak seluruh halaman aplikasi.** `window.print()` diganti `printHtmlDocument` (iframe tersembunyi) dengan `@page` sesuai lebar kertas.
- **Cetak ulang dari riwayat** memakai generator yang sama, ditandai `*** SALINAN STRUK *** (CETAK ULANG)` + waktu cetak ulang, dan memeriksa izin `sale.reprint`.

**Tambahan:**
- `src/lib/print.ts`, `src/lib/html.ts` (`escapeHtml` dipindah dari `report.service.ts`, perilaku sama).
- `src/services/receipt.service.ts`: struk monospace 32 kolom (58 mm) / 48 kolom (80 mm); pratinjau layar dan dokumen cetak memakai baris yang sama.
- `StoreSettings.defaultPaperWidth` (bawaan `58mm`) dan `showReturnPolicyOnReceipt` (bawaan aktif). Data pengaturan lama tanpa field ini tetap terbaca (digabung dengan bawaan; tanpa migrasi skema).
- Pengaturan → bagian **Struk & Printer**: kertas bawaan, sakelar batas retur, **Cetak Struk Uji** (identitas toko + penggaris kolom, tanpa barang/nominal rekaan, tidak disimpan).
- `ReceiptModal` ditulis ulang dengan token desain (sebelumnya heksadesimal/`stone-*`/`emerald-*`).

**Keputusan teknis / penyimpangan dari `rencana_lanjutan.md`:**
- Pilihan kertas di modal struk bersifat **per-cetak**; bawaan toko diubah di Pengaturan (menyimpan tiap klik akan menulis audit log berulang).
- Bagian "Struk & Printer" berada di tab Identitas Toko yang ada, bukan tab baru; pratinjau langsung di Pengaturan ditunda (pratinjau ada di modal struk dan lewat Struk Uji).

**Verifikasi:** `pnpm typecheck` lulus; `pnpm test` 112 lulus (+16 baru); `pnpm build` lulus. **Belum teruji di perangkat:** printer thermal 58/80 mm. **Tidak dapat dijalankan:** `pnpm lint` (ESLint tidak terpasang; OQ-L07).

---

## [Pusat Peringatan Operasional Toko, Kop Surat Excel Resmi, & Responsivitas Mobile] - 2026-10-30

- **Pusat Peringatan Operasional Toko (`src/components/layout/NotificationCenterPopover.tsx` & `AppLayout.tsx`)**:
  - Mengaktifkan tombol lonceng notifikasi di Topbar menjadi pusat peringatan real-time yang memantau 4 kategori operasional:
    1. **Stok Habis (`0`) & Stok Menipis** (navigasi ke `/inventory`).
    2. **Batch Sudah Kedaluwarsa & Kritis H-7** (navigasi ke `/expiry`).
    3. **Audit Hari Ini** — Transaksi Void, Retur Pelanggan, dan Koreksi/Pemusnahan Stok hari ini (navigasi ke `/transactions` & `/settings`).
    4. **Pengingat Backup Database Lokal** bila belum pernah backup atau sudah melewati 24 jam (navigasi ke `/settings`), sekaligus menyinkronkan kartu status **"Backup lokal"** di Sidebar Desktop & Mobile Drawer dengan waktu backup asli dari `db.backup_history`.
  - Redesain panel popover dengan **4-Column Segmented Tabs** (`Semua`, `Stok & ED`, `Audit`, `Backup`) bebas scrollbar horizontal, *clean ghost actions* di header, serta kartu mikro berstruktur (*squircle icon*, *overline* status, dan chip aksi interaktif).
- **Format Dokumen Laporan Excel (`.xls`) Bergaya Kop Surat Resmi (`src/services/report.service.ts`)**:
  - Menyusun ulang struktur ekspor `.xls` menjadi 9 bagian dokumen resmi: Kop Surat Toko (*Merge & Center*, alamat & telepon, sub-identitas sistem dengan garis bawah ganda), Judul Laporan Resmi, Blok Metadata Dokumen (No. Dokumen, Tanggal Cetak, Periode, Dicetak Oleh, Perihal), Tabel Ikhtisar Eksekutif KPI, Tabel Utama dengan kolom `No.` dan lebar kolom lega, Baris `TOTAL` yang selalu tampil, Kotak Catatan & Dasar Perhitungan Audit, serta Blok Pengesahan / Tanda Tangan.
- **Perbaikan Header Mobile & Kartu Metrik Angka Besar (`AppLayout.tsx`, `InventoryView.tsx`, `ReportsView.tsx`, `ExpiryView.tsx`)**:
  - Mencegah tumpang tindih header pada layar mobile `< 640px` dan menampilkan angka nominal miliaran (`formatRupiahCompact` + nominal penuh di bawahnya) agar tidak terpotong pada grid 2 kolom mobile.

---

## [Perombakan Halaman Laporan & Analitik + Ekspor Excel (.xls) & PDF Resmi (A4)] - 2026-10-30

- **Generator Dokumen Laporan Excel (`.xls`) & PDF (A4) (`src/services/report.service.ts`)**:
  - Menambahkan `buildReportExcelHtml` & `exportToExcel`: menghasilkan berkas `.xls` Spreadsheet HTML dengan `<x:ExcelWorkbook>`, lebar kolom terkunci proporsional (`mso-width-source:userset`), kop identitas toko & periode laporan, ringkasan KPI eksekutif, header tabel berwarna `#14463C`, serta baris `TOTAL` di bagian bawah tabel.
  - Menambahkan `buildReportPdfHtml` & `openPdfPrintWindow`: menghasilkan dokumen laporan resmi ukuran **A4 Portrait (`@page { size: A4 portrait; margin: 12mm; }`)** yang memuat Kop Toko (Nama, Alamat, Telepon dari `SettingsService`), 4 Kotak Ringkasan KPI, Tabel Laporan Aktif + Baris `TOTAL`, serta Kolom Pengesahan / Tanda Tangan (`Disiapkan / Dicetak Oleh` & `Pemilik Toko`), lengkap dengan fallback iframe cetak bila popup diblokir browser.
- **Perombakan UI Halaman Laporan & Analitik (`src/features/reports/ReportsView.tsx` & `ReportPdfPreviewModal.tsx`)**:
  - Mengganti tipografi angka pada 4 kartu metrik dari `font-serif` menjadi `font-sans tabular-nums` sesuai `DESIGN_SYSTEM.md` §2.3 & §4, serta mengganti warna hardcoded `stone-*` ke token desain semantik (`bg-card`, `border-border`, `bg-primary`, `bg-success`, `text-success-text`, `bg-warning`, `bg-destructive`).
  - Menambahkan **Unified Control Bar** dengan pill rentang periode (`Hari Ini`, `7 Hari`, `Bulan Ini`, `Semua`), indikator tanggal kalender aktif, tombol `Segarkan`, tombol **`Unduh Excel (.xls)`**, dan tombol **`Ekspor PDF`**.
  - Menambahkan fitur pencarian cepat di dalam setiap tab laporan, filter status stok (`Semua`, `Aman`, `Menipis`, `Habis`), badge status dengan ikon pendamping (`CheckCircle2`, `AlertTriangle`, `XCircle`), keadaan kosong (*empty state*) terstruktur, serta baris **`<tfoot>` TOTAL** otomatis di keempat tab laporan.
  - Menambahkan **Modal Pratinjau Dokumen Laporan PDF (A4)** (`ReportPdfPreviewModal.tsx`) agar pengguna dapat memeriksa bentuk lembaran A4 sebelum memilih **Simpan PDF / Cetak A4**.
- **Verifikasi Kualitas**:
  - Penambahan pengujian generator Excel & PDF di `tests/integration/services/reports.test.ts` (5 tes lulus).
  - `pnpm typecheck` 0 error dan `pnpm build` sukses.

---

## [Perombakan Template Excel/CSV & Modal Impor Katalog Produk] - 2026-10-30

- **Template Kerja Excel Rapi & Anti-Rusak Barcode (`src/lib/csv.ts`)**:
  - Menambahkan generator **Template Excel (`.xls`)** berformat tabel terstruktur dengan 4 kelompok kolom berwarna (**A. Identitas Barang**, **B. Satuan & Harga Eceran**, **C. Kemasan Grosir / Dus Opsional**, **D. Stok Awal & Kedaluwarsa**), lebar kolom proporsional, baris petunjuk pengisian di bawah header, dan proteksi format teks (`mso-number-format:'\@'`) agar angka `0` di depan barcode tidak terpotong dan barcode EAN-13 tidak berubah menjadi notasi ilmiah `8.99E+12`.
  - Memperbarui generator **Template CSV (`.csv`)** menggunakan pemisah titik koma (`;`) dengan UTF-8 BOM sehingga langsung terpisah rapi per kolom saat dibuka di Microsoft Excel regional Indonesia.
- **Smart Parser Multi-Format (`parseCsv` & `parseCatalogImportText`)**:
  - Mendeteksi otomatis pemisah **Tab (`\t`)** saat pengguna melakukan *Copy-Paste* (`Ctrl+C` lalu `Ctrl+V`) langsung dari blok sel Microsoft Excel / Google Sheets ke kotak teks.
  - Mendukung pembacaan langsung berkas `.xls` hasil unduhan maupun `.csv` (titik koma `;` dan koma `,`).
  - Otomatis melewati baris header grup, judul kolom, dan baris petunjuk pengisian sehingga tidak dianggap sebagai baris barang.
  - Membersihkan pembungkus rumus teks barcode Excel (`="089686010018"` atau `'089686010018`) dan mendeteksi barcode yang rusak akibat notasi ilmiah (`E+`).
  - Memvalidasi harga jual < harga modal, kelengkapan kolom grosir parsial, format tanggal kedaluwarsa (`YYYY-MM-DD`), serta duplikasi barcode di dalam file yang sama.
- **Penyempurnaan UI Modal Impor (`CsvImportModal.tsx`)**:
  - Menyediakan 3 langkah kerja yang jelas: Unduh Template Excel (`.xls`) / CSV (`.csv`) atau Pilih Berkas, Copy-Paste langsung dari Excel dengan tombol **"Muat 3 Contoh Barang"**, serta Tabel Pratinjau Lengkap 7 kolom (Nomor Baris, Status, Nama & Barcode, Kategori, Modal & Jual Eceran, Grosir/Dus, Stok Awal & ED).
  - Menambahkan panel **"Lihat Panduan Struktur 14 Kolom & Contoh Pengisian"** yang dapat dibuka langsung di dalam modal.
- **Verifikasi Kualitas**:
  - Penambahan 5 unit tests baru di `tests/unit/data/csv.test.ts`.
  - Seluruh 95 tests lulus (100% green), `pnpm typecheck` 0 error, dan `pnpm build` sukses.

---

## [Input Stok Awal & Tanggal Kedaluwarsa di Formulir Barang] - 2026-10-28

- **Input Stok Awal & Tanggal Kedaluwarsa Langsung (`ProductFormModal.tsx`)**:
  - Saat pendaftaran produk baru (`Tambah Barang Baru`), pengguna dapat langsung memasukkan jumlah stok awal barang yang sudah ada di rak toko.
  - Jika checkbox `"Lacak tanggal kedaluwarsa & batch (FEFO)"` dicentang, antarmuka membuka sub-card bernuansa amber yang meminta:
    1. **Jumlah Stok di Toko**: Input numerik jumlah fisik di rak.
    2. **Tanggal Kedaluwarsa**: Input kalender tanggal (`YYYY-MM-DD`) dengan validasi tanggal minimal hari ini.
    3. **Kode Batch**: Input opsional dengan placeholder otomatis `BTH-YYYYMMDD` jika tidak diisi.
  - Teks bantuan ramah: *"Biarkan stok 0 jika barang belum ada di toko (baru mau kulakan nanti). Tanggal bisa diisi saat penerimaan barang."*
- **Integrasi Ledger Stok & Batch Otomatis (`CatalogService.ts`)**:
  - `createProduct` kini menerima `initialStockBase`, `initialExpiryDate`, dan `initialBatchCode`.
  - Jika stok awal diisi $> 0$:
    - Mendaftarkan entri batch ke `product_batches` secara otomatis.
    - Mencatat saldo awal pada `inventory_balances`.
    - Mencatat mutasi ledger `INITIAL_BALANCE` pada `stock_movements` dan `stock_movement_items` dalam 1 transaksi Dexie atomik.
    - Produk langsung memiliki saldo dan seketika bisa dijual di Kasir POS (mendukung alokasi FEFO).
- **Dukungan Stok Awal pada Impor Excel/CSV (`CsvImportModal.tsx`)**:
  - Menambahkan kolom `stok_awal` dan `tanggal_kedaluwarsa` pada parser CSV dan template unduhan UTF-8 BOM (`template_katalog_sembako_os.csv`).
- **Verifikasi Kualitas**:
  - Pembuatan 4 integration tests di `tests/integration/catalog/initial-stock-expiry.test.ts` (mencakup produk non-expiry, produk ber-expiry, validasi error, dan transaksi checkout FEFO instan).
  - Seluruh 90 tests lulus (100% green), `npm run typecheck` 0 error, dan `npm run build` sukses.

---

## [Skenario Koreksi Operasional: Retur Berbasis Kondisi, Batas Hari, Void Sesi Aktif, Reversal Penerimaan & Timeline Audit] - 2026-10-28

- **GAP-01: Retur Barang Pelanggan Berbasis Kondisi (PRD BR-19, AC-28)**:
  - Antarmuka retur di `TransactionHistoryView.tsx` kini menyediakan pilihan kondisi per item: `✓ Layak Jual`, `✕ Rusak/Cacat`, dan `⏱ Kedaluwarsa`.
  - Aturan ledger dipertegas: Barang layak jual dikembalikan ke stok (`CUSTOMER_RETURN` movement), sedangkan barang rusak atau kedaluwarsa dicatat kerugiannya (`RETURN_WRITE_OFF` movement) tanpa menambah saldo stok jual.
  - Pelanggan tetap memperoleh pengembalian dana penuh sesuai ketentuan toko.
- **GAP-02 & GAP-06: Kebijakan Batas Waktu Retur Toko (PRD BR-18, FR-SET-03)**:
  - Penambahan pengaturan `returnDaysLimit` di `StoreSettings` (default 7 hari) dan input numerik pada tab Kebijakan Toko (`StoreSettingsTab.tsx`).
  - `CheckoutService.processReturn` dan antarmuka riwayat transaksi memvalidasi umur transaksi terhadap `returnDaysLimit`; transaksi yang kedaluwarsa diblokir dari proses retur dengan pesan informatif.
- **GAP-03: Pembatasan Void Hanya pada Sesi Kasir Aktif (PRD BR-17)**:
  - `CheckoutService.voidSale` mewajibkan pencocokan `sale.session_id === currentSessionId` dan status sesi masih `open`.
  - Tombol Void pada `TransactionHistoryView.tsx` otomatis nonaktif jika transaksi berasal dari sesi yang telah ditutup, dengan tooltip panduan mengarahkan kasir untuk menggunakan fitur "Retur".
- **GAP-04: Filter Tab Arsip & Reaktivasi Barang di Katalog (FR-CAT-12)**:
  - Menambahkan segment filter status (`Aktif`, `Diarsipkan`, `Semua`) pada toolbar `ProductCatalogView.tsx`.
  - Barang yang diarsipkan diberi badge status visual dan tombol **"Aktifkan"** untuk mengembalikan barang ke kasir POS secara instan tanpa kehilangan histori.
- **GAP-05: Reversal Penerimaan Barang Pemasok Terpandu (PRD BR-27, AC-25)**:
  - Menambahkan method `reverseReceipt` pada `GoodsReceiptService` yang mencatat mutasi pembalikan stok `REVERSAL`, mengubah status penerimaan menjadi `reversed`, dan mencatat ke `audit_logs` secara atomik.
  - Tombol **"Batalkan Penerimaan (Reversal)"** dengan dialog konfirmasi alasan ditambahkan pada rincian penerimaan di `SuppliersView.tsx`.
- **GAP-07: Panduan Interaktif Produk Duplikat di Katalog (`ProductCatalogView.tsx`)**:
  - Modal panduan ramah awam untuk menangani barang ganda/salah ketik: panduan 3 langkah aman (koreksi stok fisik via Sesuaikan Stok, arsipkan produk keliru, dan kepastian data riwayat transaksi lama tetap utuh).
- **GAP-08: Visual Kronologi & Audit Timeline per Transaksi (`TransactionHistoryView.tsx`)**:
  - Modal rincian struk kini dilengkapi timeline visual vertikal yang merangkum siklus hidup transaksi: pembuatan transaksi awal oleh kasir, riwayat setiap retur barang beserta kondisi kelayakan dan refund dana, serta audit pembatalan (void) dengan pemulihan saldo stok.
- **Verifikasi Kualitas**:
  - Penambahan skenario pengujian di `tests/integration/services/checkout.test.ts`, `product.test.ts`, dan `supplier-receipt.test.ts`.
  - Seluruh 86 tests lulus (100% green), `npm run typecheck` 0 error, dan `npm run build` sukses.

---

## [Multi-Satuan Eceran & Dus, Onboarding Excel Resmi & Form Ramah Awam] - 2026-10-28

- **Clean Slate (Pembersihan Data Fiktif)**:
  - Menghapus auto-seeding demo produk pada saat database kosong di `ProductCatalogView.tsx` sesuai aturan emas `AGENTS.md` §3 Aturan 3. Toko baru dimulai dalam status bersih tanpa bias informasi.
- **Formulir Manual Ramah Pengguna Awam (`ProductFormModal.tsx`)**:
  - Redesain antarmuka 3 kotak visual terpadu: Informasi Barang, Penjualan Eceran (Satuan Utama), dan Penjualan Grosir/Dus (Opsional).
  - Checkbox toggle `"Jual per Dus / Slop juga?"`: Jika tidak dicentang, formulir tetap sangat pendek dan selesai dalam 15 detik.
  - Jika dicentang, hanya meminta 4 kotak jelas: Nama Kemasan, Isi per Kemasan, Harga Dus, dan Barcode Kardus, dilengkapi teks estimasi modal & keuntungan otomatis.
  - Mendukung penambahan satuan kemasan baru pada barang yang sudah ada.
- **Layanan Katalog Multi-Satuan (`CatalogService.ts`)**:
  - `updateProduct` ditingkatkan untuk menyinkronkan penambahan satuan grosir (`product_units`) dan pemetaan barcode kemasan (`product_barcodes`) secara atomik dalam transaksi Dexie.
  - Validasi keunikan barcode eceran dan barcode dus ditegakkan.
- **Template Excel Resmi & Impor Fleksibel (`CsvImportModal.tsx`)**:
  - Tombol **"Unduh Template CSV"** dengan UTF-8 BOM (`\uFEFF`) yang rapi dibuka di Microsoft Excel, dilengkapi kolom eceran dan grosir/dus serta contoh baris nyata.
  - Tombol pemilihan file CSV dari laptop/tablet.
  - Parser CSV yang mendukung format 12-kolom multi-satuan dan pratinjau tabel validasi.
- **Quick-Add Barcode di Kasir POS (`PosView.tsx`)**:
  - Kasir yang memindai barcode belum terdaftar disajikan modal ringkas **"Barang Belum Terdaftar"** untuk mengisi Nama & Harga dalam 10 detik.
  - Barang langsung tersimpan di katalog, diberikan saldo awal otomatis 20 pcs, dan seketika masuk keranjang belanja kasir.
- **Verifikasi Kualitas**:
  - Penambahan integration test di `tests/integration/services/multi-unit-onboarding.test.ts` (4 tes baru).
  - Total 81 unit & integration tests lulus (100% green).
  - Lolos `pnpm typecheck` dan `pnpm build` (build produksi PWA lolos).

---

## [Penyempurnaan UI/UX: Layout Responsif Tablet Android & Ergonomi Sentuh] - 2026-10-27

- **Grafik Tren Penjualan Dashboard Dinamis (`DashboardView.tsx`)**:
  - Memperbaiki bug label garis waktu sumbu X yang sebelumnya ter-hardcode hanya dalam format jam (`08:00..20:00+`) untuk seluruh tab.
  - Sumbu X dan titik kurva kini beradaptasi dinamis:
    - **Hari Ini**: Rentang jam operasional (`08:00`, `10:00`, ..., `20:00+`).
    - **7 Hari**: Tanggal harian 7 hari terakhir (`22 Okt`, `23 Okt`, ..., `Hari Ini`).
    - **30 Hari**: 6 interval tanggal 5-harian (`29/9 - 3/10`, `4/10 - 8/10`, ..., `24 - Hari Ini`).
    - **Semua**: Periode bulan/tahun keseluruhan (`Awal` s/d `Okt 26`).
  - Menambahkan tooltip `<title>` pada setiap titik grafik untuk menampilkan tanggal/jam dan nominal rupiah secara interaktif saat kursor diarahkan atau disentuh.
- **Shell & Navigasi Responsif Tablet Android (`AppLayout.tsx`)**:
  - Implementasi **Mobile/Tablet Navigation Drawer** untuk layar `< lg` (< 1024px / Tablet Portrait 800x1280 & 768x1024) yang dapat dibuka melalui tombol hamburger menu dan ditutup dengan tombol silang atau klik backdrop.
  - Implementasi **Collapsible Rail Sidebar** untuk layar `≥ lg` (Desktop & Tablet Landscape 1024x768 / 1280x800) yang dapat diciutkan menjadi icon rail 72px (`w-[72px]`) untuk memberikan ruang maksimal bagi kasir saat bertransaksi.
  - Penataan ulang Header Topbar: Menghilangkan text wrapping bertumpuk, chip sinkronisasi fleksibel dengan `whitespace-nowrap shrink-0`, dan profil kasir ringkas pada layar sempit.
- **Antarmuka Kasir POS Ergonomis Tablet (`PosView.tsx`)**:
  - Penambahan **Tab Switcher (Katalog vs Keranjang)** pada mode Tablet Portrait: Katalog produk memanfaatkan 100% lebar layar tablet, mengatasi masalah kartu produk terhimpit menjadi sliver 60px dan teks 1 huruf per baris.
  - Penambahan **Floating Bottom Cart Bar**: Menampilkan ringkasan jumlah item dan total belanja di bagian bawah layar saat berada di tab katalog, dengan tombol pintas langsung menuju keranjang atau pembayaran.
  - Keranjang belanja penuh (Full-width Cart View) saat beralih ke tab Keranjang di tablet portrait dengan tombol kuantitas besar (tap target ≥ 44px) yang nyaman untuk sentuhan kasir.
  - Transisi otomatis ke layout 2-kolom berdampingan pada layar Tablet Landscape (≥ 1024px).
  - Perbaikan kartu produk katalog: `min-h-[115px]`, `line-clamp-2` pada nama barang, serta posisi badge stok dan harga yang proporsional.
- **Responsivitas Seluruh Tabel & Toolbar Data**:
  - Menambahkan pembungkus horizontal swipe aman dengan `min-w-[600px]..[750px]` di dalam `overflow-x-auto` pada `ProductCatalogView.tsx`, `TransactionHistoryView.tsx`, `InventoryView.tsx`, `ExpiryView.tsx`, `SuppliersView.tsx`, `ReportsView.tsx`, `DashboardView.tsx`, `AuditViewerTab.tsx`, dan `UserManagementTab.tsx`.
  - Toolbar pencarian dan filter di seluruh halaman disesuaikan menjadi `flex-col md:flex-row items-stretch md:items-center` dengan `flex-wrap` pada aksi tombol agar tidak terpotong.
- **Verifikasi Kualitas**:
  - Lolos `pnpm typecheck` (0 error) dan `pnpm test` (77 tests lulus, 100% green).
  - Lolos kompilasi produksi `pnpm build`.
  - Teruji visual penuh via `browser_subagent` pada resolusi 800x1024 (Portrait) dan 1024x768 (Landscape).

---

## [Penyempurnaan POS: Pembayaran Non-Tunai Manual QRIS & Transfer Bank] - 2026-10-27

### Ditambahkan
- Modul & Dialog Pembayaran Non-Tunai Manual (FR-POS-18, A-02, OQ-10):
  - Dukungan saluran non-tunai lengkap: **QRIS**, **Transfer Bank** (BCA, BRI, Mandiri, BNI, Bank Lain), dan **Debit / EDC / Lainnya**.
  - Input catatan nomor referensi transaksi / RRN / nama pengirim (`referenceNo`).
  - Pengaman verifikasi kasir: Checkbox konfirmasi bahwa dana non-tunai telah diverifikasi masuk ke rekening/QRIS toko sebelum checkout dapat diselesaikan.
  - Penyimpanan `reference_no` pada tabel `payments` di Dexie IndexedDB.
  - Tampilan struk kasir (`ReceiptModal.tsx`): Menampilkan metode non-tunai spesifik (QRIS/Transfer Bank) serta nomor referensi transaksi.
  - Tampilan riwayat transaksi (`TransactionHistoryView.tsx`): Menampilkan subtipe non-tunai di kolom metode dan rincian referensi di modal detail transaksi.
  - Proteksi rekonsiliasi kas laci kasir (BR-22): Pembayaran non-tunai tidak dihitung ke dalam kas fisik yang diharapkan pada laci uang kasir saat tutup sesi kasir.
- 77 unit & integration tests Vitest (20 test files, 100% passed).
- Pengujian interaksi visual penuh via browser subagent pada antarmuka POS dan dialog pembayaran non-tunai.

---

## [Penyempurnaan UI/UX: Unified Card Layout & Desain Token] - 2026-10-25

### Diubah
- Redesain Unified Card Layout: Menghilangkan kesan menggantung (*floating toolbar*) dan menyatukan filter, pencarian, dan aksi langsung ke dalam Card Header Toolbar pada `ProductCatalogView.tsx`, `InventoryView.tsx`, `ExpiryView.tsx`, `SuppliersView.tsx`, `TransactionHistoryView.tsx`, dan `ReportsView.tsx`.
- Redesain Halaman Pengaturan (`/settings`):
  - Segmented Tab Navigation diubah menjadi pill control (`rounded-pill`, `bg-muted`, border halus).
  - Menghilangkan pembungkus dobel padding (`p-6 max-w-7xl mx-auto`).
  - `StoreSettingsTab`: Pembersihan kode acuan PRD mentah, formulir rapi terstruktur dalam `rounded-card`, tombol dan input konsisten dengan token desain.
  - `UserManagementTab`: Penyatuan judul daftar pengguna, badge hitungan akun, dan tombol "+ Tambah Pengguna" ke dalam Card Header tabel. Status pengguna dan peran memakai badge pill semantik.
  - `BackupRestoreTab`: Kartu aksi Backup & Restore terstruktur seragam dengan `rounded-card` dan tombol pill; tabel riwayat backup terintegrasi penuh.
  - `AuditViewerTab`: Penggabungan kotak pencarian, dropdown filter aksi, dan tombol muat ulang ke dalam toolbar Card Header di atas tabel riwayat audit.
- Eliminasi Kata Mubazir & Kode Internal: Menghapus label kode PRD seperti `(FR-SET-01..03)` dan `(FR-BKP-01, AC-32)` dari antarmuka pengguna sesuai panduan copy `/antislop-copywriting`.

---

## [Penyempurnaan Dashboard, Panduan & Data Demo] - 2026-10-25

### Ditambahkan
- Dashboard Dinamis Terkoneksi Penuh: `DashboardView.tsx` terintegrasi langsung dengan IndexedDB Dexie, `ReportService`, `BatchService`, dan `CashierSessionService`. Menghitung omzet bersih, jumlah transaksi, estimasi laba kotor & margin, grafik area penjualan per jam SVG realtime, donut chart komposisi nilai persediaan per kategori, daftar produk perlu perhatian (stok kritis & batch kedaluwarsa sesuai AC-27), dan feed aktivitas mutasi stok & penjualan terbaru.
- Perbaikan UI/UX Donut Chart & Status Sinkronisasi: Memperbaiki clipping teks angka besar pada pusat Donut Chart dengan `formatRupiahCompact` (M/Jt/Rb) serta memperluas diameter lubang tengah (inner clearance) agar tidak menabrak lingkaran grafik. Memperbaiki kontras teks `SyncStatusChip` dari `text-success` (sama dengan warna background) ke `text-success-text` (`#1E6A47`) sehingga status "Tersimpan di perangkat" terbaca jelas.
- Pusat Panduan Operasional Sembako: `HelpView.tsx` menggantikan placeholder pada rute `/help`, menyediakan panduan komprehensif 5 tab interaktif (Alur Kasir POS & Hotkey, Inventaris Tunggal & Stok Opname BR-01/BR-24, Batch & FEFO, Cadangan Data & PWA Offline-First, serta Glosarium Istilah Baku Toko Sembako).
- Seeder Data Demo Terverifikasi: `src/data/seedDemo.ts` dan script `pnpm seed:demo` sesuai `AGENTS.md` §3 Rule 3, memuat katalog sembako berlabel jelas (`[DEMO]`), pemasok, saldo awal via ledger `InventoryService`, batch kedaluwarsa, sesi kasir, dan transaksi penjualan contoh.
- Unit Test Hak Akses Domain: `tests/unit/domain/permissions.test.ts` memverifikasi penegakan aturan hak akses Kasir, Supervisor, Owner, dan Petugas Gudang (AC-13, AC-20, AC-30).
- 74 unit & integration tests Vitest (20 test files, 100% passed).

---

## [Fase 5: Backup, Audit, Pengaturan & Hardening PWA] - 2026-10-25

### Ditambahkan
- Modul Backup Manual Terverifikasi: `BackupService.exportBackup` mengekspor seluruh tabel IndexedDB ke format JSON, menyertakan metadata manifest (app version, schema version, table counts), dan menghitung SHA-256 checksum untuk menjamin integritas data (FR-BKP-01..02, BR-28, AC-32).
- Modul Restore Database Atomik: `BackupService.validateBackup` memverifikasi checksum SHA-256 dan versi skema sebelum diizinkan restore. `restoreBackup` melakukan pemulihan data atomik di dalam transaksi Dexie dan mencatat audit log `system.restore` (FR-BKP-03..04, AC-33).
- Layar Backup & Restore: `BackupRestoreTab.tsx` dengan unduhan instan berkas JSON backup, pemilih berkas restore dengan pratinjau record, modal konfirmasi destruktif AlertDialog, dan tabel riwayat backup berkas.
- Modul Layanan Audit Log: `AuditService` untuk penelusuran log audit append-only dengan filter aksi dan aktor pengguna (FR-AUD-01..03, AC-34, AC-35).
- Layar Jejak Audit Sistem: `AuditViewerTab.tsx` menampilkan kronologi waktu kejadian, badge jenis aksi, nama aktor pengguna, entitas, alasan, dan tombol inspeksi detail Before/After JSON.
- Modul Pengaturan Toko & Manajemen Pengguna: `SettingsService` untuk mengelola profil toko (nama toko, alamat struk, telepon, footer) dan kebijakan operasional (diskon kasir, auto-lock, ambang kedaluwarsa). Manajemen staf pengguna dengan peran (`owner`, `supervisor`, `cashier`, `stock_clerk`), pembuatan pengguna baru, reset PIN 6-digit terenkripsi PBKDF2, dan toggle status (FR-SET-01..04, AC-36).
- Layar Antarmuka Pengaturan: `SettingsView.tsx` (`/settings`) dengan 4 tab interaktif (Identitas Toko, Pengguna & Peran, Backup & Restore, Jejak Audit).
- Hardening PWA & Offline-First: `public/manifest.json` standalone landscape, `public/sw.js` precache app shell & assets offline fallback, pendaftaran service worker di `main.tsx`.
- 67 unit & integration tests Vitest (seluruhnya lulus hijau).
- Bukti visual verifikasi browser subagent pada seluruh tab halaman `/settings`.

---

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
