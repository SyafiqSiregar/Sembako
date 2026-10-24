# DESIGN_SYSTEM — SembakoOS

Pedoman UI/UX agar tampilan konsisten di setiap halaman, baik dibuat manusia maupun AI agent.

| Atribut | Nilai |
| --- | --- |
| Versi | 1.0 |
| Tanggal | 24 Oktober 2026 |
| Mengacu ke | `PRD.md` v1.1 (C-01, C-03, persyaratan nonfungsional aksesibilitas) |
| Stack UI | React + TypeScript + Tailwind CSS + shadcn/ui + Lucide |
| Referensi visual | `docs/design/orbit-reference.png` (dashboard "ORBIT") |

> **Aturan emas:** jangan menulis warna, ukuran, atau radius "mentah" di komponen. Selalu pakai token (CSS variable / kelas Tailwind yang memetakan ke token). Jika token yang dibutuhkan belum ada, **tambahkan token di dokumen ini dan di `globals.css`**, jangan menyelipkan nilai satu kali.

---

## Daftar Isi

1. [Prinsip Desain](#1-prinsip-desain)
2. [Referensi Visual dan Adaptasinya](#2-referensi-visual-dan-adaptasinya)
3. [Design Tokens](#3-design-tokens)
4. [Tipografi](#4-tipografi)
5. [Spacing, Radius, Elevasi, dan Grid](#5-spacing-radius-elevasi-dan-grid)
6. [Komponen](#6-komponen)
7. [Pola Halaman](#7-pola-halaman)
8. [Keadaan UI dan Umpan Balik](#8-keadaan-ui-dan-umpan-balik)
9. [Responsive Design](#9-responsive-design)
10. [Aksesibilitas](#10-aksesibilitas)
11. [Format Data dan Bahasa Antarmuka](#11-format-data-dan-bahasa-antarmuka)
12. [Aturan Penggunaan shadcn/ui](#12-aturan-penggunaan-shadcnui)
13. [Ikon, Gerak, dan Suara](#13-ikon-gerak-dan-suara)
14. [Checklist Review UI](#14-checklist-review-ui)

---

## 1. Prinsip Desain

| # | Prinsip | Artinya dalam praktik |
| --- | --- | --- |
| D-01 | **Kecepatan kasir di atas estetika** | Layar POS minim dekorasi, target sentuh besar, nol animasi yang menunda. |
| D-02 | **Angka adalah bintang** | Total, kembalian, stok, dan omzet tampil paling besar dan paling kontras. |
| D-03 | **Tenang dan terang** | Latar krem hangat, permukaan putih, aksen hijau gelap. Merah hanya untuk bahaya/error. |
| D-04 | **Status tidak hanya warna** | Setiap status memakai ikon + teks + warna. |
| D-05 | **Jujur** | Tidak ada tombol palsu, angka dekoratif, atau data contoh yang menyamar sebagai data nyata. Fitur belum tersedia disembunyikan atau diberi label "Segera hadir" yang nonaktif jelas. |
| D-06 | **Konsisten** | Satu pola untuk satu masalah: satu cara konfirmasi, satu cara pesan kesalahan, satu gaya tabel. |
| D-07 | **Aman dari salah sentuh** | Aksi destruktif butuh konfirmasi; dialog pembayaran tidak tertutup karena klik di luar. |
| D-08 | **Offline terasa normal** | Status offline ditampilkan tenang dan jelas, bukan alarm. |

---

## 2. Referensi Visual dan Adaptasinya

Screenshot: `docs/design/orbit-reference.png` (dashboard fintech "ORBIT"). Yang diambil adalah **struktur dan nuansa**, bukan konten kripto.

### 2.1 Yang diambil dari referensi

| Ciri di referensi | Dipakai di SembakoOS |
| --- | --- |
| Sidebar kiri dengan ikon + label, item aktif berupa pil hijau gelap berteks putih | Navigasi utama (lihat 6.9) |
| Judul halaman bergaya editorial (serif besar) dengan subjudul abu singkat | Judul halaman (lihat 4) |
| Label kecil huruf kapital berjarak ("YOUR BALANCE") di atas angka besar | Label metrik (`overline`) |
| Kartu metrik dengan latar tint lembut (hijau muda, peach) dan ikon dalam lingkaran | Kartu metrik |
| Pil perubahan (▲ +12,4%) berlatar tint hijau | `Badge` tren |
| Area chart garis hijau dengan isian gradasi halus | Grafik penjualan |
| Donut chart dengan angka total di tengah dan legenda persentase | Komposisi nilai persediaan per kategori |
| Daftar aktivitas dengan ikon lingkaran, waktu, dan nominal berwarna | Aktivitas terbaru |
| Tabel bersih tanpa garis vertikal, baris lega | Tabel data |
| Border tipis, radius besar, bayangan hampir tidak ada | Kartu dan panel |

### 2.2 Pemetaan konten ORBIT → SembakoOS

| Elemen ORBIT | Menjadi di SembakoOS |
| --- | --- |
| "Portfolio overview" | **Ringkasan Toko** |
| Pemilih rentang tanggal | Pemilih rentang tanggal (default: hari ini) |
| Lonceng notifikasi (titik oranye) | Notifikasi stok menipis dan kedaluwarsa |
| "Your balance" + grafik | **Penjualan hari ini** + grafik penjualan per jam/hari |
| Pilihan 1D/1W/1M/3M/1Y/ALL | Hari ini / 7 hari / 30 hari / Bulan ini / Kustom |
| Asset allocation (donut) | **Komposisi nilai persediaan per kategori** |
| Kartu "Total return", "Monthly income", "Goals progress" | **Estimasi laba kotor**, **Jumlah transaksi**, **Stok menipis** |
| Tabel "Your assets" | **Perlu perhatian**: stok menipis dan batch hampir kedaluwarsa |
| Recent activity | **Aktivitas terbaru**: penjualan, penerimaan, penyesuaian, void |
| Kartu promo "Grow your wealth" | **Dihapus.** Diganti kartu status kecil "Backup terakhir" |
| Menu: Overview, Assets, Transactions, Earn, Insights, Goals | Lihat 6.9 |

### 2.3 Yang sengaja tidak diambil

- Estetika kripto: ikon koin, tema "wealth", kartu promosi.
- Serif sebagai font angka (angka memakai sans tabular agar rata).
- Dekorasi ilustratif pada layar kasir.

---

## 3. Design Tokens

> Nilai di bawah **diperkirakan dari screenshot referensi** dan disesuaikan agar lolos kontras WCAG AA. Verifikasi dengan pipet warna dan pemeriksa kontras sebelum dibekukan; setelah itu ubah nilai hanya lewat revisi dokumen ini.

### 3.1 Warna dasar (mode terang; MVP hanya mode terang)

| Token | Hex | Penggunaan |
| --- | --- | --- |
| `--background` | `#FBF8F3` | Latar halaman (krem hangat) |
| `--foreground` | `#12202B` | Teks utama (hampir hitam kebiruan) |
| `--card` | `#FFFFFF` | Permukaan kartu, panel, dialog |
| `--card-foreground` | `#12202B` | Teks di kartu |
| `--popover` | `#FFFFFF` | Dropdown, tooltip |
| `--popover-foreground` | `#12202B` | Teks popover |
| `--primary` | `#14463C` | Aksi utama, item nav aktif, tombol Bayar |
| `--primary-foreground` | `#FFFFFF` | Teks di atas primary |
| `--primary-hover` | `#0F372F` | Hover/pressed primary |
| `--secondary` | `#E9F2EC` | Tombol sekunder, latar tint hijau |
| `--secondary-foreground` | `#14463C` | Teks di atas secondary |
| `--muted` | `#F3F0E9` | Latar area tenang, header tabel, input nonaktif |
| `--muted-foreground` | `#5E646B` | Teks sekunder, label, placeholder |
| `--accent` | `#DCEEE2` | Hover baris, item terpilih ringan |
| `--accent-foreground` | `#14463C` | Teks di atas accent |
| `--border` | `#E6E1D6` | Garis tipis kartu, tabel, pemisah |
| `--input` | `#D9D3C5` | Border input |
| `--ring` | `#2F7A63` | Cincin fokus (lihat 10.2) |

### 3.2 Warna status (semantik)

| Token | Fill (tint) | Teks/ikon | Border | Arti |
| --- | --- | --- | --- | --- |
| `--success` | `#DCEEE2` | `#1E6A47` | `#A9D3B9` | Berhasil, stok aman, tersimpan lokal |
| `--warning` | `#FFF1D6` | `#8A5300` | `#F0CE8A` | Stok menipis, kedaluwarsa dekat, backup lama, sync tertunda |
| `--destructive` | `#FCE4E1` | `#B3261E` | `#F2B1AB` | Error, habis, kedaluwarsa, void, aksi berbahaya |
| `--info` | `#E3EEF7` | `#1F5C8A` | `#B5D0E6` | Informasi netral, mode offline |
| `--neutral` | `#F3F0E9` | `#5E646B` | `#E6E1D6` | Status netral/arsip/nonaktif |

`--destructive` juga dipakai sebagai warna solid untuk tombol destruktif (`#B3261E`, teks putih).

### 3.3 Warna dekoratif (hanya untuk kartu metrik dan grafik)

| Token | Hex | Penggunaan |
| --- | --- | --- |
| `--tint-green` | `#EAF3EC` | Latar kartu metrik utama |
| `--tint-peach` | `#FDEBE2` | Latar kartu metrik pendamping |
| `--chart-1` | `#14463C` | Seri utama grafik |
| `--chart-2` | `#7DB594` | Seri kedua |
| `--chart-3` | `#F4B091` | Seri ketiga |
| `--chart-4` | `#D6D3C8` | Seri keempat |
| `--chart-5` | `#8FB8D4` | Seri kelima |

Aturan: warna dekoratif **tidak** membawa makna status. Grafik tetap harus terbaca tanpa warna (label nilai, pola, atau legenda berlabel).

### 3.4 Pemetaan status bisnis

| Status | Varian | Ikon (Lucide) | Teks |
| --- | --- | --- | --- |
| Stok aman | success | `CheckCircle2` | "Aman" |
| Stok menipis | warning | `AlertTriangle` | "Menipis" |
| Stok habis | destructive | `XCircle` | "Habis" |
| Kedaluwarsa ≤ 30 hari | warning | `Clock` | "Kedaluwarsa dalam N hari" |
| Sudah kedaluwarsa | destructive | `Ban` | "Kedaluwarsa" |
| Transaksi selesai | success | `Check` | "Selesai" |
| Transaksi void | destructive | `Undo2` | "Void" |
| Transaksi diretur | warning | `RotateCcw` | "Diretur sebagian" / "Diretur" |
| Draft | neutral | `FilePen` | "Draft" |
| Tersimpan lokal | success | `HardDriveDownload` | "Tersimpan di perangkat" |
| Offline | info | `WifiOff` | "Offline" |
| Menyimpan | info | `Loader2` (berputar) | "Menyimpan…" |
| Sync tertunda / gagal | warning / destructive | `CloudOff` | "Sync tertunda" / "Sync gagal" |
| Produk nonaktif | neutral | `Archive` | "Nonaktif" |

### 3.5 Implementasi token

`src/styles/globals.css` memuat token sebagai CSS variable dan `tailwind.config` memetakannya ke nama semantik (`bg-background`, `text-muted-foreground`, `bg-success`, dsb.). Nama variable mengikuti konvensi shadcn/ui agar komponen bawaan otomatis ikut. Token tambahan (`success`, `warning`, `info`, `neutral`, `tint-*`, `chart-*`) didaftarkan di konfigurasi Tailwind.

---

## 4. Tipografi

| Peran | Font | Catatan |
| --- | --- | --- |
| Judul halaman, judul kartu besar | **Serif editorial** (usulan: *Fraunces* atau *Newsreader*) | Memberi nuansa referensi. Hanya untuk judul, bukan angka. |
| Teks antarmuka, tabel, form, tombol | **Inter** (variabel) | Font utama. |
| Angka (uang, stok, total) | Inter dengan `font-variant-numeric: tabular-nums` | Agar kolom angka rata dan stabil. |

**Wajib offline:** semua font dikemas di aplikasi (berkas `woff2`, subset Latin) dan di-precache oleh service worker. **Dilarang** memuat font dari CDN eksternal pada produksi karena aplikasi harus berjalan tanpa internet. Sediakan fallback `ui-sans-serif, system-ui` dan `Georgia, serif`.

### 4.1 Skala ukuran

| Token | Ukuran / tinggi baris | Berat | Penggunaan |
| --- | --- | --- | --- |
| `display` | 48 / 52 | 600 | Total pembayaran dan kembalian di POS |
| `h1` (serif) | 36 / 40 | 600 | Judul halaman |
| `h2` (serif) | 24 / 30 | 600 | Judul kartu/panel |
| `h3` | 18 / 26 | 600 | Sub-bagian |
| `metric` | 32 / 38 | 600 | Angka di kartu metrik |
| `body` | 16 / 24 | 400 | Teks standar (minimum untuk konten) |
| `body-strong` | 16 / 24 | 600 | Nama produk, nilai penting |
| `small` | 14 / 20 | 400 | Teks sekunder, sel tabel padat |
| `overline` | 12 / 16 | 600, huruf kapital, jarak 0,08em | Label di atas angka |

Aturan: ukuran teks konten **tidak boleh di bawah 14 px**; di layar POS minimum 16 px. Panjang baris deskripsi maksimum ~70 karakter.

---

## 5. Spacing, Radius, Elevasi, dan Grid

### 5.1 Spacing (basis 4 px)

`1=4`, `2=8`, `3=12`, `4=16`, `5=20`, `6=24`, `8=32`, `10=40`, `12=48`, `16=64` px. Pakai kelas Tailwind bawaan; jangan memakai nilai di luar skala.

| Konteks | Nilai |
| --- | --- |
| Padding kartu | 20–24 px |
| Jarak antar kartu | 16–24 px |
| Padding halaman (tablet) | 24–32 px |
| Jarak antar field form | 16 px |
| Tinggi baris tabel | 48 px (padat 40 px) |

### 5.2 Radius

| Token | Nilai | Penggunaan |
| --- | --- | --- |
| `--radius` | `12px` | Dasar shadcn (input, tombol) |
| `radius-card` | `16px` | Kartu, panel, dialog |
| `radius-pill` | `9999px` | Badge, chip, item nav aktif, pemilih rentang |
| `radius-sm` | `8px` | Tooltip, elemen kecil |

### 5.3 Elevasi

Gaya datar. Kartu: `border 1px var(--border)` tanpa bayangan. Dialog/popover: bayangan lembut tunggal (`0 8px 24px rgba(18,32,43,0.08)`). Tidak ada bayangan bertingkat lain.

### 5.4 Grid dan lebar

- Sidebar tetap 240 px (tablet landscape), rail ikon 72 px (tablet portrait).
- Area konten maksimum 1440 px, grid 12 kolom, gap 24 px.
- Dashboard: baris metrik 4 kolom; area utama 8 + 4 kolom (grafik + panel samping).

---

## 6. Komponen

Semua komponen dibangun di atas shadcn/ui. Daftar di bawah menetapkan **varian dan ukuran yang diizinkan**; varian lain dilarang tanpa revisi dokumen.

### 6.1 Button

| Varian | Tampilan | Penggunaan |
| --- | --- | --- |
| `default` | Latar `--primary`, teks putih | Aksi utama (Bayar, Simpan, Posting) |
| `secondary` | Latar `--secondary`, teks hijau gelap | Aksi pendukung |
| `outline` | Border `--input`, latar transparan | Aksi netral (Batal, Filter) |
| `ghost` | Tanpa border | Aksi tersier, ikon di tabel |
| `destructive` | Latar `--destructive`, teks putih | Void, hapus, restore |
| `link` | Teks bergaris bawah | Navigasi inline |

| Ukuran | Tinggi | Penggunaan |
| --- | --- | --- |
| `sm` | 36 px | Aksi di dalam tabel (di desktop) |
| `md` (bawaan) | 44 px | Aplikasi umum |
| `lg` | 56 px | Layar POS (Bayar, nominal cepat, numpad) |
| `icon` | 44 × 44 px | Tombol ikon |

Aturan: satu tombol `default` per area keputusan. Tombol yang sedang memproses menampilkan spinner, label tetap terbaca, dan `disabled` (mencegah klik ganda). Tombol nonaktif wajib punya alasan yang bisa dibaca (tooltip atau teks bantu).

### 6.2 Input dan Form

| Komponen | Spesifikasi |
| --- | --- |
| Input teks | Tinggi 44 px (48 px di POS), radius 12 px, border `--input`, fokus memakai ring |
| Input uang | Awalan "Rp", rata kanan, tabular-nums, keypad numerik di perangkat sentuh, pemisah ribuan titik |
| Input kuantitas | Stepper `−` / `+` 44 px; mendukung desimal sesuai satuan (koma desimal) |
| Input scan/cari | Selalu fokus otomatis di POS; ikon scan; menerima Enter dari pemindai |
| Select, Combobox | Pencarian di dalam daftar untuk >8 opsi (produk, pemasok) |
| Date picker | Rentang dengan preset (Hari ini, 7 hari, 30 hari, Bulan ini); tanggal kedaluwarsa memakai input tanggal kalender |
| Form | `react-hook-form` + `zod`; label di atas field, bukan placeholder; pesan galat di bawah field |

Aturan form: label selalu terlihat; field wajib ditandai teks "wajib" (bukan hanya tanda bintang); galat muncul setelah blur atau submit, ditulis dalam bahasa manusia ("Barcode ini sudah dipakai produk Beras Rojolele 5 kg"); fokus pindah ke field galat pertama saat submit gagal.

### 6.3 Card dan Kartu Metrik

- **Card dasar:** latar `--card`, border 1 px, radius 16 px, padding 20–24 px, judul `h2` serif.
- **Kartu metrik:** `overline` (label) → `metric` (angka) → baris pendukung (badge tren + teks periode). Varian latar: `neutral` (putih), `tint-green`, `tint-peach`. Opsional ikon dalam lingkaran 40 px di kiri atas dan chevron `>` di kanan atas bila bisa diklik.
- Setiap metrik wajib punya definisi (lihat `PRD.md` §7.7) yang dapat dibuka lewat tooltip ikon info.

### 6.4 Table

- Header latar `--muted`, teks `small` semibold huruf kecil; tanpa garis vertikal; garis horizontal `--border`.
- Kolom angka **rata kanan**, tabular-nums; kolom teks rata kiri; kolom aksi paling kanan.
- Baris 48 px; hover `--accent`; baris terpilih `--accent` + indikator kiri hijau.
- Header lengket (sticky) pada tabel panjang; paginasi atau virtualisasi untuk >200 baris.
- Keadaan kosong, memuat (skeleton), dan galat wajib ada (lihat 8).
- Di layar sempit, tabel menjadi daftar kartu atau memakai gulir horizontal di dalam kontainernya (halaman tidak boleh bergulir horizontal).
- Status di tabel memakai `Badge` (ikon + teks).

### 6.5 Badge dan Chip

- `Badge` varian: `success`, `warning`, `destructive`, `info`, `neutral`, `outline`. Selalu memuat teks; ikon dianjurkan (lihat 3.4).
- Badge tren: panah ▲/▼ + persen, latar `success`/`destructive` tint. Tren turun yang buruk memakai `destructive`; jangan memakai merah untuk penurunan yang memang diinginkan (mis. stok menipis berkurang).

### 6.6 Dialog, AlertDialog, Sheet

| Komponen | Kapan | Aturan |
| --- | --- | --- |
| `Dialog` | Form pendek, detail | Dapat ditutup dengan Esc dan tombol Tutup |
| `AlertDialog` | Konfirmasi aksi berisiko (void, restore, posting opname, arsip) | Judul menyebut aksi, isi menyebut dampak, tombol konfirmasi menyebut aksi ("Void transaksi"), bukan "OK" |
| `Sheet` | Drawer navigasi di layar kecil, filter, detail samping | Sisi kiri untuk navigasi, kanan untuk detail |
| Dialog pembayaran | Memproses pembayaran | **Tidak** tertutup oleh klik di luar atau Esc saat sedang menyimpan; tombol terkunci; hasil ditampilkan di dalam dialog |
| Dialog Approval | Aksi butuh persetujuan | Meminta PIN Supervisor/Owner; menampilkan aksi dan alasan; hasil tercatat di audit log |

### 6.7 Toast dan Alert

- Toast (Sonner) untuk umpan balik singkat nonkritis ("Produk tersimpan"). Hilang setelah 4 detik; dapat dibatalkan jika aksinya reversibel.
- `Alert` inline untuk pesan yang harus tetap terlihat (peringatan stok, backup lama, mode offline lama).
- Galat kritis (gagal menyimpan transaksi) **tidak** boleh hanya berupa toast; tampil sebagai `Alert` atau dialog yang menetap sampai dibaca.

### 6.8 Tabs, Skeleton, Empty State

- `Tabs` untuk pembagian konten setara (Ringkasan / Riwayat / Batch di halaman produk).
- `Skeleton` meniru bentuk konten; dipakai setelah 150 ms memuat.
- Empty state: ikon, satu kalimat penjelasan, satu aksi utama ("Belum ada produk. Tambah produk pertama").

### 6.9 Navigasi

**Sidebar** (kiri, mengikuti referensi): logo/nama toko di atas; item = ikon Lucide 20 px + label; item aktif = pil `--primary` teks putih; item lain teks `--muted-foreground`, hover `--accent`. Menu bawah dipisah garis: Pengaturan, Bantuan. Menu disaring menurut hak akses pengguna.

| Menu | Ikon | Peran yang melihat |
| --- | --- | --- |
| Ringkasan | `Home` | Owner, Supervisor |
| Kasir | `ScanBarcode` | Owner, Supervisor, Kasir |
| Produk | `Package` | Owner, Supervisor, Petugas stok |
| Inventaris | `Boxes` | Owner, Supervisor, Petugas stok |
| Kedaluwarsa | `CalendarClock` | Owner, Supervisor, Petugas stok |
| Pemasok | `Truck` | Owner, Supervisor, Petugas stok |
| Transaksi | `ReceiptText` | Owner, Supervisor, Kasir (milik sendiri) |
| Laporan | `BarChart3` | Owner, Supervisor |
| Pengguna | `Users` | Owner |
| Pengaturan | `Settings` | Owner |

Kasir yang login langsung diarahkan ke layar POS; Ringkasan tidak ditampilkan untuk Kasir.

**Header:** judul halaman (serif) + subjudul; di kanan: pemilih rentang tanggal (bila relevan), **chip status data** (offline / menyimpan / tersimpan lokal), pengguna aktif (menu: kunci layar, keluar), notifikasi.

### 6.10 Komponen khusus aplikasi

| Komponen | Deskripsi |
| --- | --- |
| `MoneyText` | Menampilkan Rupiah (`Rp 12.500`), tabular-nums, rata kanan di tabel |
| `QtyText` | Menampilkan kuantitas dengan satuan dan desimal lokal (`0,75 kg`) |
| `StatusBadge` | Pemetaan status bisnis → varian + ikon + teks (3.4) |
| `SyncStatusChip` | Chip status data di header |
| `ScanInput` | Input fokus otomatis, menangani Enter pemindai, umpan balik berhasil/gagal |
| `Numpad` | Papan angka besar untuk uang diterima dan PIN (tombol 56–64 px) |
| `PinPad` | Numpad khusus PIN dengan titik masking |
| `CartLine` | Baris keranjang: nama, harga, stepper, diskon, subtotal, hapus |
| `PaymentSummary` | Subtotal, diskon, total, uang diterima, kembalian (ukuran `display`) |
| `ReceiptPreview` | Pratinjau struk lebar 58/80 mm |
| `MetricCard` | Kartu metrik (6.3) |
| `ApprovalDialog` | Dialog PIN persetujuan (6.6) |
| `ConfirmAction` | Pembungkus `AlertDialog` standar untuk aksi berisiko |
| `EmptyState`, `ErrorState` | Keadaan kosong dan galat standar |

---

## 7. Pola Halaman

### 7.1 Ringkasan (dashboard)

```
┌───────────┬──────────────────────────────────────────────────────────┐
│ Sidebar   │ Ringkasan Toko                        [Rentang ▾] [🔔]   │
│           │ Gambaran penjualan, stok, dan aktivitas toko Anda.       │
│ Ringkasan │ ┌─ Penjualan hari ini (tint-green) ──────┐ ┌─ Komposisi ┐│
│ Kasir     │ │ PENJUALAN HARI INI   [Hari ini|7h|30h]  │ │ nilai      ││
│ Produk    │ │ Rp 2.480.000   ▲ +8,2% vs kemarin       │ │ persediaan ││
│ Inventaris│ │ [grafik area]                           │ │ (donut)    ││
│ ...       │ └─────────────────────────────────────────┘ └────────────┘│
│           │ ┌ Est. laba kotor ┐┌ Transaksi ┐┌ Stok menipis ┐┌ Backup ┐│
│ Pengaturan│ └─────────────────┘└───────────┘└──────────────┘└────────┘│
│           │ ┌─ Perlu perhatian (tabel) ──────────┐┌─ Aktivitas ─────┐ │
│           │ │ Produk | Stok | Status | Aksi      ││ terbaru         │ │
│           │ └────────────────────────────────────┘└─────────────────┘ │
└───────────┴──────────────────────────────────────────────────────────┘
```

Aturan: setiap angka memiliki definisi (PRD §7.7); tidak ada data dummy di produksi; keadaan kosong menjelaskan apa yang perlu dilakukan (mis. "Belum ada penjualan hari ini").

### 7.2 Layar Kasir (POS)

```
┌───────────────────────────────────────────┬───────────────────────────┐
│ [🔍 Scan atau cari produk...         ]    │ Keranjang (3 item)  [Tahan]│
│ ┌ Favorit ┐ ┌ Beras ┐ ┌ Minyak ┐ ┌ Gula ┐ │ ───────────────────────── │
│ │ (grid)  │ │       │ │        │ │      │ │ Beras 5kg    1  Rp72.000 │
│ └─────────┘ └───────┘ └────────┘ └──────┘ │ Minyak 1L    2  Rp36.000 │
│ Hasil pencarian / daftar produk           │ Gula 1kg     1  Rp17.000 │
│                                           │ ───────────────────────── │
│                                           │ Subtotal      Rp125.000  │
│                                           │ Diskon              Rp0  │
│                                           │ TOTAL        Rp125.000   │
│                                           │ [        BAYAR        ]  │
└───────────────────────────────────────────┴───────────────────────────┘
```

Aturan POS:
- Area scan/cari dan keranjang adalah fokus; sidebar diciutkan menjadi rail atau disembunyikan pada layar kasir.
- Total memakai ukuran `display`; tombol **Bayar** `lg`, lebar penuh, selalu terlihat (tidak ikut tergulir).
- Fokus otomatis kembali ke `ScanInput` setelah item ditambahkan atau dialog ditutup.
- Setiap scan memberi umpan balik: baris baru tersorot ±600 ms + bunyi pendek; gagal = pesan di bawah input + bunyi galat.
- Produk bermasalah (stok tidak cukup, nonaktif, kedaluwarsa) menampilkan pesan jelas **sebelum** pembayaran.
- Dialog pembayaran: ringkasan total, input uang diterima + nominal cepat (Uang pas, pecahan umum), kembalian besar, tombol Bayar terkunci selama proses, hasil sukses menampilkan nomor struk dengan aksi Cetak / Transaksi baru.

### 7.3 Daftar dan Detail (Produk, Inventaris, Transaksi, Pemasok)

- Pola: judul + aksi utama di kanan atas → bar filter/pencarian → tabel → paginasi.
- Detail membuka halaman atau `Sheet` kanan dengan `Tabs` (Ringkasan, Riwayat, dll.).
- Form panjang dibagi dalam kartu bagian (Informasi dasar, Harga dan satuan, Barcode, Stok dan kedaluwarsa) dengan tombol Simpan lengket di bawah.

### 7.4 Alur Bertahap (Penerimaan barang, Stok opname)

- Penanda langkah di atas (Pilih → Isi → Tinjau → Posting).
- Tahap Tinjau menampilkan ringkasan dan dampak ("Stok 14 produk akan bertambah") sebelum tombol Posting.
- Draft tersimpan otomatis; tombol keluar menanyakan jika ada perubahan belum disimpan.

### 7.5 Login dan Kunci Layar

- Layar sederhana tengah: nama toko, pilih pengguna (avatar/nama), `PinPad`, tautan bantuan. Tidak ada tampilan data bisnis.
- PIN salah: getar halus + pesan; sisa percobaan ditampilkan; saat terkunci tampil hitung mundur.

---

## 8. Keadaan UI dan Umpan Balik

Setiap layar data wajib mendefinisikan lima keadaan:

| Keadaan | Perilaku |
| --- | --- |
| Memuat | Skeleton setelah 150 ms; jangan layar kosong |
| Kosong | `EmptyState` dengan aksi |
| Galat | `ErrorState`: apa yang gagal, apakah data aman, aksi "Coba lagi"; tanpa istilah teknis |
| Sukses | Toast singkat atau perubahan tampilan yang jelas |
| Sebagian (parsial) | Tampilkan yang berhasil dan tandai yang gagal (mis. impor CSV) |

**Status data (chip di header):**

| Keadaan | Teks | Varian |
| --- | --- | --- |
| Online, tersimpan | "Tersimpan di perangkat" | success |
| Offline | "Offline — data aman di perangkat" | info |
| Sedang menyimpan | "Menyimpan…" | info |
| Penyimpanan hampir penuh / tidak persisten | "Penyimpanan perlu perhatian" | warning |
| Sync tertunda / gagal (jika ada) | "Sync tertunda" / "Sync gagal" | warning / destructive |

**Konfirmasi:** aksi destruktif dan tidak dapat dibatalkan selalu lewat `ConfirmAction`. Aksi reversibel (hapus item keranjang) memakai Batalkan di toast.

**Tombol yang belum berfungsi:** dilarang. Fitur yang belum ada disembunyikan; jika perlu dikomunikasikan, tampil sebagai elemen nonaktif berlabel jelas "Segera hadir".

---

## 9. Responsive Design

Perangkat prioritas: **tablet Android landscape**, lalu tablet portrait, lalu desktop. Ponsel hanya didukung untuk melihat data dan operasi ringan.

| Breakpoint | Lebar | Perilaku |
| --- | --- | --- |
| `sm` | ≥ 640 px | Ponsel besar: satu kolom, navigasi drawer |
| `md` | ≥ 768 px | Tablet portrait: sidebar menjadi rail ikon; konten 1–2 kolom |
| `lg` | ≥ 1024 px | Tablet landscape (**target utama**): sidebar penuh, grid 2–3 kolom, POS 2 panel |
| `xl` | ≥ 1280 px | Desktop: grid 12 kolom penuh |

Aturan:
- Desain **dari tablet**, bukan dari desktop yang diperkecil.
- Layar < `md`: sidebar menjadi `Sheet`; POS menumpuk (daftar produk di atas, keranjang sebagai panel bawah dengan total dan tombol Bayar tetap terlihat).
- Halaman tidak boleh memiliki gulir horizontal; tabel lebar bergulir di dalam kontainernya.
- Dukung orientasi berganti tanpa kehilangan keranjang atau input yang sedang diketik.
- Pakai unit relatif (`rem`) dan `min-h-dvh`; hindari tinggi tetap yang memotong konten saat keyboard virtual muncul.
- Target sentuh minimum 44 × 44 px, jarak antar target ≥ 8 px; di POS 56 px.

---

## 10. Aksesibilitas

Standar: **WCAG 2.2 level AA**.

### 10.1 Kontras dan warna
- Teks normal ≥ 4,5:1; teks besar (≥ 24 px atau 18,5 px tebal) dan komponen UI ≥ 3:1.
- Pasangan token di bagian 3 sudah dirancang memenuhi aturan ini; **verifikasi dengan alat pemeriksa kontras** saat nilai final dibekukan dan setiap kali token berubah.
- Warna tidak pernah menjadi satu-satunya pembeda (ikon + teks mendampingi, lihat 3.4).

### 10.2 Fokus dan keyboard
- Semua fungsi dapat dijalankan dengan keyboard (termasuk pemindai HID yang berperilaku sebagai keyboard).
- Cincin fokus terlihat: 2 px `--ring` + offset 2 px, tidak boleh dihapus.
- Urutan tab logis; dialog menjebak fokus dan mengembalikannya ke pemicu saat ditutup.
- Pintasan POS (usulan): `F2` cari, `F4` bayar, `Esc` tutup dialog (kecuali saat memproses). Pintasan harus dapat ditemukan di bantuan.

### 10.3 Semantik dan pembaca layar
- Gunakan elemen semantik (`button`, `nav`, `main`, `table`, `th scope`).
- Ikon tanpa teks memiliki `aria-label`.
- Hasil scan dan pesan galat POS diumumkan lewat `aria-live="polite"` (galat kritis `assertive`).
- Setiap input memiliki label terkait; galat dihubungkan lewat `aria-describedby`.
- Tabel data memiliki keterangan (`caption` atau `aria-label`).

### 10.4 Gerak dan kenyamanan
- Hormati `prefers-reduced-motion`: matikan transisi non-esensial.
- Tidak ada kedipan lebih dari 3 kali per detik.
- Batas waktu (auto-lock) memberi peringatan sebelum mengunci dan tidak menghapus keranjang.

### 10.5 Pengujian aksesibilitas
- `axe-core` otomatis di pengujian komponen dan e2e (lihat `TESTING.md`).
- Uji manual: navigasi hanya dengan keyboard pada alur Penjualan; zoom 200%; TalkBack pada satu alur utama.

---

## 11. Format Data dan Bahasa Antarmuka

| Jenis | Format | Contoh |
| --- | --- | --- |
| Uang | `Rp` + spasi + titik ribuan, tanpa desimal | `Rp 12.500` |
| Uang negatif/selisih | Tanda minus di depan angka | `−Rp 10.000` |
| Persen | Koma desimal | `12,4%` |
| Kuantitas | Koma desimal sesuai satuan, satuan di belakang | `0,75 kg`, `12 pcs` |
| Tanggal | `d MMM yyyy` bahasa Indonesia | `24 Okt 2026` |
| Waktu | 24 jam + zona | `14.35 WIB` |
| Nomor struk | Monospace, huruf kapital | `TAB1-20261024-0007` |

Gunakan `Intl.NumberFormat('id-ID')` dan `Intl.DateTimeFormat('id-ID')` melalui helper tunggal di `src/lib/format`; dilarang memformat angka manual di komponen.

**Bahasa dan gaya teks**
- Bahasa Indonesia sehari-hari yang sopan; kalimat pendek; kata kerja di tombol ("Simpan produk", "Void transaksi").
- Istilah baku dan konsisten: **Kasir, Bayar, Keranjang, Stok, Stok opname, Penyesuaian, Penerimaan, Retur, Void, Kedaluwarsa, Pemasok, Struk**. Jangan bergantian dengan sinonim.
- Pesan galat: apa yang terjadi + apa yang bisa dilakukan, tanpa kode teknis di depan pengguna. Contoh: "Stok tidak cukup. Tersedia 3 pcs." bukan "Error: INSUFFICIENT_STOCK".
- Tidak menyalahkan pengguna; tidak memakai huruf kapital semua untuk kalimat.

---

## 12. Aturan Penggunaan shadcn/ui

1. **Inisialisasi** dengan CLI shadcn (gaya `new-york`, base color `neutral`, CSS variables aktif), lalu ganti nilai variable dengan token bagian 3.
2. Komponen hasil CLI berada di `src/components/ui/`. **Jangan mengedit** berkas ini kecuali untuk menambah varian lewat `cva` yang tercantum di dokumen ini. Perilaku khusus aplikasi dibuat sebagai pembungkus di `src/components/shared/`.
3. **Pakai komponen yang sudah ada sebelum membuat yang baru.** Urutan keputusan: (a) komponen di `ui/` → (b) komposisi dari `ui/` di `shared/` → (c) komponen baru (butuh alasan tertulis di PR).
4. Komponen yang disetujui dipasang: `button`, `input`, `label`, `textarea`, `select`, `combobox` (command + popover), `checkbox`, `radio-group`, `switch`, `form`, `card`, `table`, `badge`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `popover`, `tooltip`, `calendar`, `date-range-picker` (komposisi), `sonner`, `skeleton`, `alert`, `separator`, `scroll-area`, `sidebar`, `chart` (recharts), `pagination`.
5. Jangan menambah pustaka komponen UI lain (MUI, Ant, dll.). Pustaka tambahan hanya bila shadcn tidak menyediakan (mis. `recharts` via `chart`, `cmdk` via `command`).
6. Jangan menulis warna heksadesimal, `px` ad hoc, atau `style={{}}` untuk tampilan di komponen. Pakai kelas Tailwind bertoken.
7. Setiap komponen baru di `shared/` wajib menangani: keadaan fokus, nonaktif, memuat, dan galat bila relevan; serta lolos pemeriksaan axe.
8. Semua teks antarmuka berasal dari satu tempat (`src/lib/copy` atau berkas i18n) agar istilah konsisten.

---

## 13. Ikon, Gerak, dan Suara

- **Ikon:** hanya Lucide (`lucide-react`). Ukuran 20 px (nav, tombol), 16 px (badge), 24 px (empty state). Ketebalan garis 1,75. Ikon dekoratif `aria-hidden`.
- **Gerak:** durasi ≤ 150 ms, easing standar; hanya untuk transisi dialog, sheet, dan hover. Tidak ada animasi pada layar POS selain sorotan item baru dan spinner proses. Hormati reduced motion.
- **Suara:** bunyi pendek untuk scan berhasil dan scan gagal (dapat dimatikan di Pengaturan). Umpan balik getar bila tersedia. Bunyi tidak boleh menjadi satu-satunya indikator.
- **Tema gelap:** di luar MVP (P2). Token disusun sebagai variable sehingga tema gelap dapat ditambahkan tanpa mengubah komponen.

---

## 14. Checklist Review UI

Setiap halaman atau komponen baru harus lolos daftar ini sebelum dinyatakan selesai:

- [ ] Hanya memakai token dan komponen dari dokumen ini; tidak ada warna/ukuran mentah.
- [ ] Menggunakan komponen `ui/` atau `shared/` yang sudah ada; komponen baru punya alasan.
- [ ] Lima keadaan (memuat, kosong, galat, sukses, parsial) tertangani.
- [ ] Target sentuh ≥ 44 px (POS 56 px); fokus terlihat; dapat dioperasikan dengan keyboard.
- [ ] Kontras lolos AA; status tidak hanya dibedakan dengan warna.
- [ ] Tidak ada gulir horizontal halaman pada 768 px dan 1024 px; diuji portrait dan landscape.
- [ ] Format uang, angka, tanggal lewat helper `format`; teks lewat berkas copy.
- [ ] Aksi berisiko memakai `ConfirmAction`; pembayaran tidak dapat tertutup tidak sengaja.
- [ ] Tidak ada tombol palsu atau data dummy; fitur belum ada disembunyikan.
- [ ] Hak akses menyaring menu dan aksi (validasi sebenarnya di lapisan bisnis, bukan hanya UI).
- [ ] axe tanpa pelanggaran serius; lolos uji visual di tablet target.
