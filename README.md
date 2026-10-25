# SembakoOS 🏪

**Sistem Kasir (POS) & Manajemen Stok Offline-First untuk Toko Sembako**

SembakoOS dirancang khusus untuk memenuhi kebutuhan toko sembako fisik dengan operasional cepat dan minim ketergantungan jaringan. Berjalan sebagai **Progressive Web App (PWA) Offline-First** di tablet atau komputer kasir dengan penyimpanan lokal IndexedDB (Dexie.js).

---

## 🎯 Prinsip Inti Arsitektur

1. **Satu Inventaris Gabungan (*Single Shared Inventory*)**  
   Toko depan dan gudang belakang berbagi satu saldo inventaris fisik yang sama tanpa pemisahan lokasi fiktif.
2. **Offline-First Mutlak**  
   Seluruh transaksi kasir, penerimaan barang, stok opname, dan laporan keuangan berjalan 100% lokal di perangkat tanpa membutuhkan koneksi internet aktif.
3. **Akurasi Uang & Stok Integer**  
   - Nilai uang disimpan dalam **integer Rupiah** murni (menghindari galat pembulatan *floating-point*).
   - Kuantitas stok disimpan dalam **integer satuan terkecil** (`qty_base`).
   - Perhitungan harga beli per satuan dasar menggunakan skala desimal presisi tinggi (`_x10k`).
4. **Mutasi Stok Berbasis Ledger (*Stock Movement Ledger*)**  
   Perubahan stok hanya dapat terjadi melalui satu pintu (`InventoryService`) yang selalu mencatat riwayat mutasi (*append-only*).
5. **FEFO (*First-Expired, First-Out*) Otomatis**  
   Alokasi stok kasir memprioritaskan batch dengan tanggal kedaluwarsa paling dekat, serta memblokir penjualan batch kedaluwarsa secara otomatis.
6. **Keamanan & Otorisasi di Lapisan Service**  
   Validasi izin peran (*Owner*, *Supervisor*, *Cashier*, *Stock Clerk*) ditegakkan di lapisan bisnis (`authorize()`), bukan hanya sekadar menyembunyikan tombol UI.
7. **Jejak Audit Lengkap (*Audit Trail*)**  
   Seluruh aksi sensitif (void nota, retur uang, penyesuaian stok, reset PIN, restore database) tercatat permanen pada tabel audit append-only dengan metadata sebelum/sesudah (*before/after JSON*).

---

## ✨ Fitur Utama

| Modul | Deskripsi |
| --- | --- |
| **Kasir POS** | Transaksi cepat dengan tombol kuantitas sentuh besar (min 56px), barcode scanner, pencarian instan nama produk, alokasi FEFO batch, diskon per item & per nota dengan batas otorisasi supervisor, penahanan nota (*hold cart*), dan pencetakan struk thermal 58mm/80mm. |
| **Sesi Kas (*Cash Session*)** | Alur buka kasir dengan modal awal, pemantauan selisih kas fisik (*cash float*), dan tutup kas harian dengan rekonsiliasi. |
| **Katalog Produk Multi-Satuan** | Pengaturan satuan bertingkat (mis. 1 Dus = 24 Pcs, 1 Bal = 10 Bungkus) dengan harga jual grosir/eceran dan konversi satuan dasar otomatis. |
| **Manajemen Inventaris & Opname** | Pemantauan stok menipis, penerimaan barang dari pemasok (*Goods Receipt*), penyesuaian manual (*Adjustment*), serta sesi stok opname terpadu dengan perhitungan varians otomatis. |
| **Monitoring Kedaluwarsa (*Expiry & Batch*)** | Status batch visual: *Aman*, *Waspada (H-30)*, *Kritis (H-7)*, dan *Kedaluwarsa*. Dilengkapi fitur pemusnahan barang rusak/kedaluwarsa (*write-off*). |
| **Laporan & Analitik Bisnis** | Ringkasan omzet kotor, omzet bersih, margin & estimasi laba kotor, produk terlaris (*fast-moving*), valuasi persediaan modal, serta ekspor laporan ke format **CSV (UTF-8 BOM)** untuk Microsoft Excel. |
| **Pencadangan & Pemulihan Data** | Ekspor cadangan database lengkap ke berkas JSON dengan **SHA-256 Checksum**, validasi integritas struktur data, dan pemulihan atomik (*safe restore*). |
| **Pengaturan & Manajemen Pengguna** | Profil toko dan catatan kaki struk, batas persentase diskon kasir, durasi kunci layar otomatis (*auto-lock*), pembuatan staf kasir dengan PIN 6-digit PBKDF2, dan proteksi lockout jika 5x salah PIN. |

---

## 🛠️ Tumpukan Teknologi

- **Frontend Core**: React 18, TypeScript (*strict mode*), Vite
- **Styling & UI**: Tailwind CSS, Lucide Icons, Shadcn-inspired token design system
- **Penyimpanan Lokal**: IndexedDB via [Dexie.js](https://dexie.org/) & `dexie-react-hooks`
- **Manajemen State**: [Zustand](https://github.com/pmndrs/zustand) (Keranjang belanja & Sesi kasir aktif)
- **Validasi Skema**: [Zod](https://zod.dev/)
- **Pengujian**: Vitest, React Testing Library, Fake-IndexedDB (75+ unit & integration tests)

---

## 🚀 Memulai (Instalasi & Penggunaan)

### Prasyarat
- [Node.js](https://nodejs.org/) v18+ atau v20+
- [pnpm](https://pnpm.io/) v9+ (atau `npm` / `yarn`)

### 1. Kloning Repositori
```bash
git clone https://github.com/SyafiqSiregar/Sembako.git
cd Sembako
```

### 2. Pasang Dependensi
```bash
pnpm install
```

### 3. Jalankan Server Pengembangan
```bash
pnpm dev
```
Buka browser di `http://localhost:3000` (atau port yang tertera pada terminal).

### 4. Memuat Data Demo (Opsional)
Untuk menguji aplikasi dengan data contoh katalog sembako, pemasok, transaksi kasir, dan batch kedaluwarsa:
```bash
pnpm seed:demo
```

---

## 🧪 Pengujian & Verifikasi Kualitas

SembakoOS menerapkan aturan kualitas ketat (*Zero Broken Invariants*):
```bash
# Pemeriksaan tipe TypeScript
pnpm typecheck

# Menjalankan seluruh unit & integration test
pnpm test

# Pemeriksaan lengkap sekaligus
pnpm check
```

---

## 📁 Struktur Direktori

```text
src/
├── app/                  # Layout utama (AppLayout, Sidebar, Header, Rute)
├── assets/               # Aset gambar & ikon lokal
├── components/           # Komponen UI bersama (Dialog, Button, Card, Table)
├── data/                 # Definisi skema Dexie IndexedDB (db.ts) & seeders
├── domain/               # Aturan bisnis murni tanpa dependensi UI/DB
│   ├── money/            # Format & kalkulasi uang integer Rupiah
│   ├── permissions/      # Kebijakan peran (Owner, Supervisor, Cashier, Clerk)
│   ├── pin/              # Hashing & verifikasi PIN 6-digit
│   └── quantity/         # Konversi satuan bertingkat & qty_base
├── features/             # Halaman fitur terisolasi
│   ├── auth/             # Login PIN, dialog lockout, dan switch user
│   ├── cashier/          # POS touchscreen, keranjang, bayar, struk thermal
│   ├── catalog/          # Daftar produk, kategori, dan konversi satuan
│   ├── inventory/        # Stok saldo, mutasi pergerakan, dan stok opname
│   ├── expiry/           # Monitoring batch & pemusnahan barang
│   ├── reports/          # Laporan omzet, laba kotor, dan ekspor CSV
│   ├── settings/         # Profil toko, kelola user, backup, dan jejak audit
│   └── suppliers/        # Direktori pemasok & penerimaan barang
├── hooks/                # Custom React hooks (scanner barcode, hotkey)
├── lib/                  # Format mata uang Intl id-ID, tanggal, dan helper copy
├── services/             # Lapisan orkestrasi transaksi Dexie (Service Layer)
└── styles/               # Desain token & variabel CSS tema
```

---

## 📄 Dokumentasi Tambahan

- [`PRD.md`](./PRD.md) — *Product Requirements Document*, acceptance criteria, dan aturan bisnis.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Arsitektur offline-first, alur data, dan batas lapisan kode.
- [`DATABASE.md`](./DATABASE.md) — Skema tabel IndexedDB, relasi indeks, dan unit transaksi atomik.
- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — Panduan token warna, tipografi, radius, dan target sentuh POS.
- [`CHANGELOG.md`](./CHANGELOG.md) — Riwayat implementasi dan keputusan teknis per fase.

---

## 📝 Lisensi

Hak Cipta © 2026 Syafiq Siregar. Dikembangkan untuk efisiensi operasional toko sembako offline-first.
