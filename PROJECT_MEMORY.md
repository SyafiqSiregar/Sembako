# MEMORI PROYEK — SembakoOS (Handover & State Resume)

Dokumen ini adalah **catatan memori permanen** untuk sesi kerja saat ini dan masa depan. Ketika proyek ini dibuka kembali oleh AI agent atau developer, baca file ini untuk langsung memahami status terakhir, keputusan penting pengguna, dan apa yang harus dilakukan selanjutnya.

| Atribut | Nilai |
| --- | --- |
| Tanggal Simpan | 25 Oktober 2026 |
| Status Proyek | **Fase 0–5 Selesai 100% & Terverifikasi** |
| Git Branch / Remote | `main` -> `https://github.com/SyafiqSiregar/Sembako.git` |
| Verifikasi Kualitas | **75 Unit & Integration Tests Passed (20 files)**, `pnpm typecheck` hijau |
| Local Dev URL | `http://localhost:3000` |

---

## 1. Apa yang Telah Diselesaikan

### Modul Bisnis Inti (Fase 0 s/d Fase 5)
1. **Fase 0: Fondasi & Scaffolding**
   - Skema Dexie IndexedDB v1 (17 tabel dengan indeks).
   - Domain Money (integer Rupiah, split, round half-up) & Quantity (`qty_base`).
   - Layout ORBIT (Sidebar + Topbar status toko/sinkronisasi).
2. **Fase 1: Akses & Katalog**
   - Login PIN 6 digit PBKDF2-SHA256, lockout otomatis setelah 5x gagal.
   - Sesi kasir wajib (buka modal awal, tutup kas dengan rekonsiliasi selisih).
   - Katalog produk multi-satuan bertingkat, barcode unik, pencarian in-memory, dan impor CSV.
3. **Fase 2: Kasir POS & Transaksi**
   - Kasir POS touchscreen tablet dengan target sentuh ≥ 56px, snapshot harga transaksi.
   - Dialog pembayaran tunai kalkulasi kembalian realtime, nota struk 58mm/80mm.
   - Held carts (tahan/parkir transaksi) ke IndexedDB.
   - Pembatalan transaksi (Void) dan Retur barang dengan pengembalian stok via ledger movement serta persetujuan supervisor.
4. **Fase 3: Inventaris & Pemasok**
   - Ledger stok satu pintu (`InventoryService`), mutasi terdaftar di `stock_movements`.
   - Penyesuaian stok manual (Adjustment) dengan ambang batas otorisasi.
   - Penerimaan barang pemasok (*Goods Receipt*) dengan kalkulasi moving weighted average cost (`_x10k`).
   - Sesi stok opname (blind/visible snapshot) dan posting penyesuaian atomik.
5. **Fase 4: Batch, Kedaluwarsa & Laporan**
   - Pelacakan batch kedaluwarsa & alokasi otomatis **FEFO (*First-Expired, First-Out*)** saat checkout.
   - Monitoring kedaluwarsa (Aman, H-30, H-7, Expired) dan pemusnahan barang rusak/kedaluwarsa (*write-off*).
   - Laporan penjualan, estimasi laba kotor & margin, produk terlaris, dan valuasi persediaan modal.
   - Ekspor laporan ke format **CSV (UTF-8 BOM)** untuk Microsoft Excel.
6. **Fase 5: Backup, Audit, Pengaturan & PWA**
   - Backup manual ekspor JSON dengan **SHA-256 Checksum**.
   - Restore database aman atomik dengan pratinjau manifest dan verifikasi integritas.
   - Viewer audit log append-only dengan inspeksi Before/After JSON.
   - Pengaturan profil toko, kebijakan operasional, dan manajemen pengguna multi-peran.
   - PWA hardening (`manifest.json` standalone landscape, `sw.js` offline caching).
7. **Penyempurnaan Tambahan**:
   - Dashboard analitik live-query Dexie dengan grafik area SVG dan donut chart.
   - Halaman pusat panduan toko `/help` komprehensif.
   - Seeder data demo `pnpm seed:demo` (AGENTS.md §3 Rule 3).

---

## 2. Keputusan UI/UX & Desain yang Telah Disetujui

1. **Eliminasi Duplikasi Header Ringkasan Toko**:
   - Header toko/omzet dipastikan hanya tampil di Dashboard utama (`/`). Halaman fitur lain menggunakan header konteks masing-masing.
2. **Pembersihan Copy (*Antislop Copywriting*)**:
   - Seluruh teks filler, subtitle bertele-tele, dan kode PRD mentah seperti `(FR-SET-01..03)`, `(FR-BKP-01, AC-32)` telah dihapus dari antarmuka pengguna agar bersih, tenang, dan profesional.
3. **Unified Card Layout (Opsi A - Disetujui Pengguna)**:
   - Menghilangkan kesan menggantung (*floating toolbars*).
   - Di seluruh halaman tabel (`/products`, `/inventory`, `/expiry`, `/suppliers`, `/transactions`, `/reports`, `/settings`), kotak pencarian, dropdown filter, dan tombol aksi terintegrasi langsung ke dalam **Card Header Toolbar** tabel.
4. **Redesain Halaman Pengaturan (`/settings`)**:
   - Navigasi tab diubah menjadi segmented pill control (`rounded-pill`, `bg-muted`).
   - Tidak ada dobel padding (*double-gutter*).
   - Seluruh form dan tabel memakai container `rounded-card` yang seragam.

---

## 3. Catatan Belum Teruji di Perangkat Nyata (Hardware)

Sesuai `AGENTS.md` §6, jujur mengenai hal yang belum teruji secara fisik:
- **Printer Thermal Bluetooth/USB Fisik**: Logika cetak `window.print()` dan format CSS struk 58mm/80mm sudah siap dan teruji di print preview browser, namun belum teruji dengan pairing perangkat printer thermal fisik di toko.
- **Barcode Scanner Fisik USB/Bluetooth**: Algoritma auto-focus, buffer barcode scanning (`hooks/useBarcodeScanner`), dan in-memory lookup O(1) sudah lulus unit test, namun belum dicolokkan ke scanner barcode fisik.

---

## 4. Perintah Cepat untuk Melanjutkan Nanti

```bash
# Menjalankan aplikasi
pnpm dev

# Menjalankan pengujian otomatis (75 tests)
pnpm check

# Memuat data demo toko jika IndexedDB kosong
pnpm seed:demo

# Memeriksa status git & remote
git status
git log -n 5 --oneline
```

---

*Disimpan secara otomatis untuk kelanjutan pengembangan berikutnya.*
