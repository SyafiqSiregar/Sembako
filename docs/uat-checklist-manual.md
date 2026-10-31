# Panduan & Lembar Checklist UAT Manual (Uji Coba Lapangan) SembakoOS

Dokumen ini adalah panduan pengujian fisik di perangkat tablet Android (browser Chrome/PWA) dan printer thermal bluetooth/USB untuk memvalidasi kesiapan operasional nyata di toko sembako sebelum peluncuran penuh (PRD §8).

---

## 1. Persiapan Perangkat & Lingkungan

- [ ] **Tablet Android**: Minimal layar 8-10 inci, resolusi 1280x800 ke atas, baterai terisi.
- [ ] **Aplikasi**: Buka Google Chrome, akses URL lokal aplikasi atau buka ikon PWA di Home Screen.
- [ ] **Printer Kasir**: Printer Thermal ESC/POS (kertas 58mm atau 80mm) terkoneksi Bluetooth atau USB WebHID.
- [ ] **Barcode Scanner**: Scanner handheld USB/Bluetooth (keyboard wedge) atau kamera tablet aktif.
- [ ] **Uang Modal Kasir**: Siapkan uang fisik tunai pecahan Rp 50.000, Rp 20.000, Rp 10.000, Rp 5.000, Rp 2.000, Rp 1.000 (total Rp 200.000).

---

## 2. Lembar Checklist Pengujian per Tahapan Operasional

| # | Tahapan Skenario | Langkah Pengujian Fisik | Kriteria Keberhasilan (Pass/Fail) | Status |
|---|---|---|---|---|
| **01** | **Buka Kasir Pagi** | Masuk ke menu Kasir POS, klik *Buka Kasir*, input modal Rp 200.000. | Sesi kasir terbuka, tombol POS aktif, tidak ada galat sesi. | [ ] |
| **02** | **Katalog & Scan Barcode** | Pindai barcode produk fisik (misal: Minyak Goreng atau Beras Curah). | Produk otomatis masuk ke keranjang dalam < 300ms tanpa sentuh layar. | [ ] |
| **03** | **Transaksi Tunai Uang Pas** | Masukkan 2 barang, bayar tunai uang pas. Klik *Selesaikan Pembayaran*. | Struk tercetak rapi, laci kas terbuka (jika ada RJ-11), keranjang bersih. | [ ] |
| **04** | **Transaksi Tunai Kembalian** | Belanja Rp 130.000, kasir input uang Rp 150.000. Selesaikan transaksi. | Layar menampilkan kembalian Rp 20.000 dengan angka jelas, struk mencantumkan bayar & kembali. | [ ] |
| **05** | **FEFO Otomatis (Batch)** | Jual produk yang memiliki 2 batch expired (mis. Indomie exp dekat vs jauh). | Sistem otomatis memotong stok dari batch yang tanggal expired-nya lebih dekat. | [ ] |
| **06** | **Pembayaran QRIS Statis** | Pilih metode non-tunai > QRIS. Masukkan nomor referensi opsional. | Transaksi sukses, struk mencetak keterangan "NON-TUNAI (QRIS)", uang laci kas tidak bertambah. | [ ] |
| **07** | **Tahan & Pulihkan Keranjang** | Tambah barang, klik *Tahan Keranjang*. Layani pelanggan lain, lalu pulihkan kembali (*Recall*). | Keranjang pelanggan pertama pulih 100% lengkap dengan item & diskon. | [ ] |
| **08** | **Penerimaan Barang Kulakan** | Masuk menu Penerimaan Barang, catat faktur kiriman pemasok, masukkan kuantitas & harga modal baru. | Saldo inventaris bertambah di katalog dan kartu stok, harga modal bergerak (moving average) terupdate. | [ ] |
| **09** | **Pengecualian: Void Transaksi** | Dari riwayat transaksi, pilih struk salah input dalam sesi aktif, klik *Void*. Masukkan PIN Pemilik & alasan. | Transaksi berstatus void, stok barang kembali ke rak, kas tidak dihitung ganda. | [ ] |
| **10** | **Pengecualian: Retur Barang Rusak** | Pilih transaksi lama, klik *Retur*, pilih barang bocor/rusak (*Damaged*), konfirmasi pengembalian uang. | Uang refund keluar dari kas, stok layak jual TIDAK bertambah karena rusak, struk retur tercetak. | [ ] |
| **11** | **Koreksi Stok Rusak (Stock Adj)** | Masuk Manajemen Inventaris > Koreksi Stok, catat barang hilang/hancur di toko dengan alasan. | Stok fisik berkurang, mutasi penyesuaian tercatat di ledger dengan alasan jelas. | [ ] |
| **12** | **Tutup Kasir & Rekonsiliasi** | Klik *Tutup Kasir*, hitung fisik uang di laci (Modal + Penjualan Tunai - Refund Tunai). Masukkan nominal. | Selisih kas terhitung tepat Rp 0. Sesi terkunci rapi, struk ringkasan shift kasir tercetak. | [ ] |
| **13** | **Pencadangan Database Lokal** | Masuk Pengaturan > Cadangkan Data, klik *Export Cadangan*. | File JSON ber-manifest dan SHA-256 terunduh ke memori tablet. | [ ] |
| **14** | **Uji Offline Total** | Matikan Wi-Fi dan Data Seluler (Mode Pesawat). Lakukan 3 transaksi POS, cetak struk, dan tutup kasir. | Aplikasi berjalan lancar 100% tanpa internet, data tersimpan di IndexedDB browser lokal. | [ ] |

---

## 3. Verifikasi Mutu Fisik Struk Thermal

Periksa fisik kertas struk hasil cetak dari printer kasir:
- [ ] **Lebar Kertas**: Pas di margin kiri-kanan (tidak terpotong di mode 58mm maupun 80mm).
- [ ] **Logo Monogram Toko**: Tampil profesional dan kontras di bagian atas.
- [ ] **Tipografi & Garis**: Garis pemisah tegas, rincian barang, harga, dan total sejajar rapi.
- [ ] **Barcode Struk Code-128**: Garis barcode hitam pekat dan tajam.
- [ ] **Keterbacaan Barcode**: Barcode struk dapat di-scan kembali oleh scanner barcode tanpa kendala.
- [ ] **Angka Struk**: Teks nomor faktur di bawah barcode bersih, tidak bertumpuk/overlap (*obsite*).

---

## 4. Evaluasi Akhir UAT

- Tanggal Pengujian: ________________________
- Penguji (Owner / Kasir): ________________________
- Perangkat / Model Tablet: ________________________
- Model Printer Thermal: ________________________
- Hasil Evaluasi: [ ] DITERIMA UNTUK PRODUKSI &nbsp;&nbsp;&nbsp; [ ] PERLU PERBAIKAN
- Catatan Tambahan: __________________________________________________
