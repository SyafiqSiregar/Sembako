# PRD — SembakoOS

**POS Kasir & Manajemen Stok Toko Sembako**

| Atribut | Nilai |
| --- | --- |
| Nama kerja produk | SembakoOS |
| Versi dokumen | 1.1 |
| Status | Draft untuk validasi dan implementasi |
| Tanggal | 24 Oktober 2026 |
| Platform target | Web app responsif / PWA, dioptimalkan untuk tablet Android |
| Mode operasi | Offline-first, satu toko, satu perangkat kasir utama (MVP) |
| Mata uang / zona waktu | Rupiah (IDR) tanpa desimal / WIB (Asia/Jakarta), dapat dikonfigurasi |

> **Fungsi dokumen ini:** menjadi satu-satunya sumber kebenaran untuk **apa** yang dibangun, **untuk siapa**, dan **kapan sebuah fitur dianggap benar**. Dokumen ini sengaja tidak memuat detail teknis (skema tabel, struktur kode, token desain). Detail tersebut ada di dokumen pendamping (lihat [Bagian 16](#16-peta-dokumen-proyek)).

---

## Daftar Isi

1. [Ringkasan Produk](#1-ringkasan-produk)
2. [Latar Belakang dan Masalah](#2-latar-belakang-dan-masalah)
3. [Tujuan, Non-Tujuan, dan Ukuran Keberhasilan](#3-tujuan-non-tujuan-dan-ukuran-keberhasilan)
4. [Ruang Lingkup, Asumsi, dan Kendala](#4-ruang-lingkup-asumsi-dan-kendala)
5. [Pengguna, Peran, dan Hak Akses](#5-pengguna-peran-dan-hak-akses)
6. [Daftar Fitur dan Prioritas](#6-daftar-fitur-dan-prioritas)
7. [Persyaratan Fungsional per Modul](#7-persyaratan-fungsional-per-modul)
8. [Alur Bisnis](#8-alur-bisnis)
9. [Aturan Bisnis dan Operasional](#9-aturan-bisnis-dan-operasional)
10. [Persyaratan Nonfungsional](#10-persyaratan-nonfungsional)
11. [Kriteria Penerimaan (Acceptance Criteria)](#11-kriteria-penerimaan-acceptance-criteria)
12. [Definisi Selesai (Definition of Done)](#12-definisi-selesai-definition-of-done)
13. [Risiko dan Mitigasi](#13-risiko-dan-mitigasi)
14. [Keputusan Terbuka yang Perlu Dikonfirmasi](#14-keputusan-terbuka-yang-perlu-dikonfirmasi)
15. [Glosarium](#15-glosarium)
16. [Peta Dokumen Proyek](#16-peta-dokumen-proyek)
17. [Riwayat Revisi](#17-riwayat-revisi)

---

## Konvensi Dokumen

| Konvensi | Arti |
| --- | --- |
| **P0 (Must)** | Wajib ada di MVP. Tanpa ini aplikasi tidak layak dipakai di toko. |
| **P1 (Should)** | Sangat diharapkan di MVP. Boleh bergeser ke rilis berikutnya jika waktu terbatas, tetapi tidak boleh diabaikan diam-diam. |
| **P2 (Could)** | Pasca-MVP. Tidak dikerjakan sebelum P0 dan P1 stabil. |
| **FR-xxx-nn** | Persyaratan fungsional (modul `xxx`, nomor `nn`). |
| **BR-nn** | Aturan bisnis. |
| **AC-nn** | Kriteria penerimaan (dapat diuji). |
| **OQ-nn** | Keputusan terbuka yang perlu dikonfirmasi pemilik toko. |
| **[USULAN]** | Nilai bawaan yang diusulkan dokumen ini, **belum diputuskan pemilik**. Diperlakukan sebagai default yang dapat dikonfigurasi sampai dikonfirmasi. |
| "harus / wajib" | Persyaratan P0. Pelanggaran dianggap cacat. |
| "sebaiknya" | Persyaratan P1. |
| "dapat / boleh" | Opsional (P2). |

Jika terjadi kontradiksi antara PRD ini dan dokumen lain, **PRD ini yang menang** untuk urusan kebutuhan produk, dan dokumen lain harus diperbaiki.

---

## 1. Ringkasan Produk

SembakoOS adalah aplikasi kasir (POS) dan manajemen inventaris untuk **satu toko sembako skala kecil hingga menengah**. Aplikasi mengelola katalog barang, barcode, transaksi penjualan tunai, stok, penerimaan barang, penyesuaian dan stok opname, pemasok, batch dan kedaluwarsa, laporan, pengguna, serta backup.

**Nilai utama bagi pengguna**

- **Kasir** bekerja cepat dan hampir tidak mungkin salah hitung total atau kembalian.
- **Pemilik** tahu stok sebenarnya, barang yang mau kedaluwarsa, penjualan, dan selisih kas, tanpa harus berada di toko.
- **Toko tetap berjalan** saat internet putus karena semua operasi inti disimpan lokal terlebih dahulu.

**Prinsip produk** (dipakai untuk memutuskan bila ada pertentangan antarfitur)

1. **Akurasi di atas kecepatan fitur.** Uang dan stok harus benar sebelum fitur menjadi banyak.
2. **Offline-first.** Operasi inti tidak boleh bergantung pada internet.
3. **Semua bisa ditelusuri.** Tidak ada perubahan stok atau uang tanpa jejak (siapa, kapan, mengapa).
4. **Sederhana untuk kasir.** Layar kasir hanya menampilkan yang dibutuhkan untuk menjual.
5. **Satu inventaris.** Barang di rak depan dan ruang belakang dihitung sebagai satu saldo toko.

---

## 2. Latar Belakang dan Masalah

> Tabel berikut adalah **hipotesis masalah** yang umum di toko sembako. Validasi lewat wawancara singkat dengan pemilik dan kasir sebelum desain final.

| # | Masalah di lapangan | Dampak | Respons SembakoOS |
| --- | --- | --- | --- |
| M-01 | Harga dan total dihitung manual atau lewat kalkulator | Salah hitung, antrean lambat | Scan barcode, total dan kembalian otomatis |
| M-02 | Stok dicatat di buku atau ditebak dari ingatan | Barang kosong tanpa disadari, kelebihan stok | Saldo stok otomatis dari setiap transaksi |
| M-03 | Stok rak depan dan gudang belakang tercatat terpisah atau tidak sama sekali | Angka stok membingungkan | Satu saldo inventaris gabungan |
| M-04 | Barang kedaluwarsa baru ketahuan saat sudah lewat | Kerugian dan risiko keamanan pangan | Pelacakan batch, peringatan H-30 s.d. H-1, blokir penjualan |
| M-05 | Internet toko tidak stabil | Aplikasi berbasis cloud berhenti total | Offline-first, data lokal sebagai sumber kebenaran |
| M-06 | Pemilik tidak tahu untung sebenarnya | Salah menetapkan harga | Laporan estimasi laba kotor berbasis harga pokok |
| M-07 | Selisih uang di laci kas tidak terlacak | Kebocoran sulit dibuktikan | Sesi kasir dengan saldo awal, hitung akhir, dan selisih |
| M-08 | Koreksi stok dan pembatalan transaksi dilakukan tanpa catatan | Tidak ada akuntabilitas | Audit log wajib dengan alasan |

---

## 3. Tujuan, Non-Tujuan, dan Ukuran Keberhasilan

### 3.1 Tujuan

| ID | Tujuan |
| --- | --- |
| G-01 | Mempercepat proses kasir dan mengurangi kesalahan harga, jumlah, serta pembayaran. |
| G-02 | Menyediakan satu sumber kebenaran stok untuk seluruh toko, termasuk ruang belakang. |
| G-03 | Mencatat semua perubahan stok sebagai movement yang dapat diaudit, bukan mengubah angka stok langsung. |
| G-04 | Menyediakan laporan penjualan, estimasi laba kotor, stok menipis, produk terlaris, dan barang kedaluwarsa. |
| G-05 | Menjaga transaksi yang sudah tersimpan tetap aman saat aplikasi ditutup atau perangkat restart. |
| G-06 | Memungkinkan backup dan pemulihan data yang terbukti dapat dipulihkan. |

### 3.2 Non-Tujuan (MVP)

- Menjadi aplikasi akuntansi penuh (buku besar, pajak kompleks, laporan keuangan formal).
- Mengelola banyak cabang atau banyak lokasi stok.
- Memproses pembayaran online atau terhubung ke marketplace.
- Mengelola karyawan, penggajian, atau pengadaan otomatis ke pemasok.
- Memberi prediksi permintaan berbasis AI.

### 3.3 Ukuran Keberhasilan

| Indikator | Target awal [USULAN] | Cara mengukur |
| --- | --- | --- |
| Waktu transaksi reguler | Mayoritas transaksi sederhana (≤ 5 item) selesai ≤ 30 detik sejak item pertama dipindai | Uji tugas dengan kasir nyata |
| Akurasi pembayaran | 0 transaksi dengan total atau kembalian salah pada test suite | Pengujian otomatis + rekonsiliasi |
| Ketahanan offline | 100% alur P0 berjalan dalam mode pesawat | Uji manual mode pesawat |
| Integritas stok | Untuk setiap produk, saldo = jumlah seluruh movement | Rekonsiliasi ledger vs saldo |
| Pemulihan backup | Backup berhasil dipulihkan di perangkat uji | Uji restore berkala |
| Akuntabilitas | 100% aksi sensitif punya pengguna, waktu, alasan, dan nilai sebelum/sesudah | Review audit log |
| Adopsi | Kasir baru dapat menyelesaikan penjualan pertama tanpa bantuan setelah pelatihan ≤ 30 menit | Uji pelatihan |

---

## 4. Ruang Lingkup, Asumsi, dan Kendala

### 4.1 Termasuk dalam MVP

- Login PIN, peran pengguna, dan sesi kasir (buka/tutup kas).
- Dashboard ringkasan operasional.
- Katalog: produk, kategori, satuan dan konversi, barcode, harga jual, harga modal, stok minimum, status aktif.
- POS: scan/cari produk, keranjang, diskon terbatas, pembayaran tunai, kembalian, struk, riwayat transaksi, void, dan retur.
- Inventaris tunggal: stok masuk, penjualan, retur, barang rusak/kedaluwarsa, koreksi, dan stok opname.
- Pemasok dan penerimaan barang (tanpa purchase order).
- Batch dan tanggal kedaluwarsa untuk produk yang memerlukannya.
- Laporan: penjualan, produk, estimasi laba kotor, stok, stok minimum, kedaluwarsa, sesi kasir.
- Backup/restore lokal manual, ekspor CSV, dan pengaturan dasar.
- Audit log untuk aksi sensitif.

### 4.2 Di Luar MVP

| Item | Catatan |
| --- | --- |
| Multi-cabang, pemisahan saldo toko/gudang | Bertentangan dengan BR-01 |
| Banyak perangkat yang bertransaksi offline bersamaan | Butuh desain konflik stok dan sinkronisasi (OQ-08) |
| Akuntansi penuh, pajak kompleks | Di luar fokus produk |
| Pembayaran online, marketplace, loyalty, promo bertingkat kompleks | Fase lanjutan |
| Prediksi permintaan AI, rekomendasi otomatis | Fase lanjutan |
| Payroll, pengadaan otomatis ke pemasok | Di luar produk |
| Purchase order, utang pemasok | P2 (FR-SUP-06, FR-SUP-07) |
| Penjualan kredit / kasbon pelanggan | Belum diputuskan (OQ-02) |
| Harga bertingkat (eceran/grosir) | Belum diputuskan (OQ-03) |

### 4.3 Asumsi (harus dikonfirmasi)

| ID | Asumsi |
| --- | --- |
| A-01 | MVP untuk **satu perangkat kasir utama**. Jika lebih dari satu perangkat aktif bersamaan, desain sinkronisasi harus ditetapkan sejak awal. |
| A-02 | Metode pembayaran MVP adalah **tunai**. Non-tunai hanya dapat dicatat manual tanpa integrasi payment gateway. |
| A-03 | Aplikasi berjalan sebagai web app/PWA di browser Android pada tablet. Kebutuhan APK native serta printer/scanner tertentu perlu diuji di perangkat nyata. |
| A-04 | Mata uang Rupiah tanpa desimal untuk harga standar. |
| A-05 | Kebijakan retur, diskon maksimum, dan pembatal transaksi ditetapkan pemilik (default pada [BR](#9-aturan-bisnis-dan-operasional) bersifat [USULAN]). |
| A-06 | Setiap pegawai yang menggunakan aplikasi memiliki akun dan PIN sendiri. Tidak ada akun bersama. |

### 4.4 Kendala Produk

| ID | Kendala | Sumber |
| --- | --- | --- |
| C-01 | UI memakai **shadcn/ui + Tailwind CSS** (komponen React untuk web). | Keputusan pemilik proyek |
| C-02 | Platform adalah web app/PWA. Jika kebutuhan berubah menjadi APK native murni, pilihan UI harus dievaluasi ulang. | Konsekuensi C-01 |
| C-03 | Referensi visual: dashboard bergaya editorial dengan sidebar, kartu metrik, grafik, dan panel aktivitas, warna netral hangat dengan aksen hijau gelap. Diadaptasi untuk konteks toko; detail di `DESIGN_SYSTEM.md`. | Screenshot referensi |
| C-04 | Data bisnis disimpan lokal (bukan hanya di cache halaman). Detail teknologi di `ARCHITECTURE.md`. | Prinsip offline-first |

---

## 5. Pengguna, Peran, dan Hak Akses

### 5.1 Persona dan Kebutuhan

| Peran | Siapa | Tujuan utama | Titik sakit | Kebutuhan kunci |
| --- | --- | --- | --- | --- |
| **Owner/Admin** | Pemilik toko | Mengendalikan uang dan stok, memantau tanpa selalu hadir | Tidak tahu stok dan laba sebenarnya, curiga selisih kas | Dashboard, laporan, audit log, backup, pengaturan kebijakan |
| **Supervisor** | Kepala toko / kasir senior | Menyetujui pengecualian dan memastikan data benar | Menjadi tempat bertanya semua kasir | Persetujuan void/retur/diskon, stok opname, laporan operasional |
| **Kasir** | Penjaga kasir | Melayani pelanggan cepat dan benar | Antrean, salah harga, barang tidak ada barcode | Layar POS cepat, pencarian instan, kembalian otomatis, tutup kas mudah |
| **Petugas stok** | Penerima barang / penjaga gudang | Mencatat barang masuk dan menghitung stok dengan rapi | Faktur tertinggal, expiry terlewat | Penerimaan barang, batch/expiry, stok opname, penyesuaian terbatas |

Satu orang dapat memiliki lebih dari satu peran.

### 5.2 Matriks Hak Akses [USULAN]

Legenda: **Ya** = diizinkan, **—** = tidak diizinkan, **Approval** = diizinkan hanya dengan PIN Supervisor/Owner yang dimasukkan di tempat (override), dan tercatat di audit log.

| Aksi | Owner | Supervisor | Kasir | Petugas stok |
| --- | --- | --- | --- | --- |
| Buka/tutup sesi kasir | Ya | Ya | Ya | — |
| Membuat penjualan tunai | Ya | Ya | Ya | — |
| Diskon dalam batas peran | Ya | Ya | Ya | — |
| Diskon di atas batas peran | Ya | Ya (sampai batas Supervisor) | Approval | — |
| Cetak ulang struk | Ya | Ya | Ya | — |
| Lihat riwayat transaksi | Semua | Semua | Milik sendiri | — |
| Void transaksi | Ya | Ya | Approval | — |
| Retur | Ya | Ya | Approval | — |
| Tambah/ubah produk (selain harga) | Ya | Ya | — | Ya |
| Ubah harga jual | Ya | Ya | — | — |
| Penerimaan barang | Ya | Ya | — | Ya |
| Penyesuaian stok | Ya | Ya | — | Ya (batas nilai) / Approval di atas batas |
| Hitung fisik stok opname | Ya | Ya | — | Ya |
| Menyetujui dan memposting stok opname | Ya | Ya | — | — |
| Laporan penjualan dan laba | Ya | Ya | — | — |
| Laporan stok dan kedaluwarsa | Ya | Ya | — | Ya |
| Lihat audit log | Ya | Ya (baca) | — | — |
| Backup | Ya | Ya | — | — |
| Restore | Ya | — | — | — |
| Kelola pengguna dan peran | Ya | — | — | — |
| Pengaturan toko dan kebijakan | Ya | — | — | — |

**Aturan penegakan:** hak akses divalidasi di **lapisan logika bisnis**, bukan hanya dengan menyembunyikan tombol (lihat AC-13).

---

## 6. Daftar Fitur dan Prioritas

Ringkasan per modul. Rincian ada di [Bagian 7](#7-persyaratan-fungsional-per-modul).

| Modul | Fitur utama | Prioritas | Fase* | Peran utama |
| --- | --- | --- | --- | --- |
| **AUTH** — Akses & sesi kasir | Login PIN, lockout, auto-lock, buka/tutup kas | P0 (auto-lock P1) | 1 | Semua |
| **CAT** — Katalog | Produk, kategori, barcode, satuan, harga, stok minimum, pencarian | P0 | 1 | Owner, Petugas stok |
| **CAT** — Efisiensi data awal | Impor CSV produk, cetak label barcode internal | P1 | 1 | Owner |
| **POS** — Kasir | Keranjang, scan/cari, tunai, kembalian, struk, riwayat | P0 | 2 | Kasir |
| **POS** — Pengecualian | Void, retur, diskon berizin | P0 / P1 (diskon) | 2 | Supervisor |
| **POS** — Kenyamanan | Tahan transaksi, produk favorit, nominal cepat, non-tunai manual | P1 | 2 | Kasir |
| **INV** — Inventaris | Saldo gabungan, movement, kartu stok, penyesuaian | P0 | 3 | Petugas stok |
| **INV** — Stok opname | Sesi hitung, review, posting | P0 | 3 | Supervisor |
| **SUP** — Pemasok & penerimaan | Data pemasok, penerimaan langsung, biaya | P0 | 3 | Petugas stok |
| **EXP** — Batch & kedaluwarsa | Batch, FEFO, peringatan, blokir jual | P0 (peringatan P1) | 4 | Petugas stok, Owner |
| **RPT** — Laporan | Dashboard, penjualan, produk, stok, kedaluwarsa, sesi kas, CSV | P0 (laba P1) | 4 | Owner |
| **BKP** — Backup | Backup manual, validasi, restore, ekspor | P0 | 5 | Owner |
| **AUD** — Audit | Audit log aksi sensitif | P0 | 5 | Owner |
| **SET** — Pengaturan | Setup awal, identitas struk, kebijakan, pengguna | P0 (kelola pengguna P1) | 1 dan 5 | Owner |
| **Lanjutan** | Purchase order, cloud sync, multi-device, PPN, pembulatan | P2 | 6 | Owner |

\*Nomor fase mengikuti urutan implementasi di `TASKS.md` (Fase 0 = fondasi teknis).

---

## 7. Persyaratan Fungsional per Modul

### 7.1 AUTH — Akses dan Sesi Kasir

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-AUTH-01 | Pengguna masuk dengan PIN pribadi. Panjang PIN minimum ditetapkan di pengaturan [USULAN: 6 digit]. | P0 |
| FR-AUTH-02 | PIN disimpan sebagai hash dengan salt; tidak pernah disimpan atau dicatat dalam bentuk asli. | P0 |
| FR-AUTH-03 | Setelah beberapa kali PIN salah berturut-turut [USULAN: 5], akun dikunci sementara dan kejadian dicatat di audit log. | P0 |
| FR-AUTH-04 | Layar terkunci otomatis setelah tidak aktif; durasi dapat dikonfigurasi [USULAN: 5 menit]. Keranjang yang belum dibayar tidak hilang saat layar terkunci. | P1 |
| FR-AUTH-05 | Penjualan hanya dapat dilakukan saat ada sesi kasir yang terbuka. | P0 |
| FR-AUTH-06 | Kasir membuka sesi dengan saldo awal laci (boleh 0). | P0 |
| FR-AUTH-07 | Kasir menutup sesi dengan memasukkan kas aktual. Sistem menghitung kas yang diharapkan dan selisih; jika selisih tidak nol, catatan wajib diisi. | P0 |
| FR-AUTH-08 | Pada MVP hanya satu sesi kasir yang boleh terbuka pada satu waktu per perangkat. | P0 |
| FR-AUTH-09 | Logout, kunci layar, atau penutupan aplikasi tidak menghapus transaksi yang telah tersimpan. | P0 |

### 7.2 CAT — Katalog Produk

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-CAT-01 | Tambah, lihat, ubah, dan **arsipkan** produk. Produk yang sudah punya transaksi tidak boleh dihapus permanen. | P0 |
| FR-CAT-02 | Data minimal produk: nama, SKU (opsional), kategori, satuan dasar, harga jual, harga modal terakhir, stok minimum, penanda pelacakan kedaluwarsa (ya/tidak), status aktif. | P0 |
| FR-CAT-03 | Satu produk dapat memiliki beberapa barcode. Barcode harus unik; duplikasi yang tidak disengaja ditolak. | P0 |
| FR-CAT-04 | Pencarian berdasarkan nama, SKU, atau barcode, dengan hasil instan dan urutan relevan. Toleransi salah ketik ringan. | P0 (toleransi ketik P1) |
| FR-CAT-05 | Kategori produk dapat dikelola (tambah, ubah, arsip). | P0 |
| FR-CAT-06 | Satuan jual dapat berupa unit dasar, pack, atau karton dengan faktor konversi eksplisit. Stok dihitung dalam satuan dasar. | P0 |
| FR-CAT-07 | Produk timbang/curah (beras, gula, minyak curah, dsb.) dapat dijual dengan **kuantitas desimal** pada satuan berat/volume. *Bergantung pada OQ-01.* | P0 (jika dikonfirmasi) |
| FR-CAT-08 | Perubahan harga hanya berlaku untuk transaksi baru; transaksi lama memakai snapshot harga (BR-05). | P0 |
| FR-CAT-09 | Setiap perubahan harga jual dan harga modal tercatat (siapa, kapan, dari, ke). | P1 |
| FR-CAT-10 | Impor produk dari CSV dengan pratinjau dan laporan kesalahan per baris sebelum disimpan. | P1 |
| FR-CAT-11 | Pembuatan dan pencetakan **barcode internal** untuk produk yang tidak memiliki barcode pabrik atau dijual curah. | P1 |
| FR-CAT-12 | Produk nonaktif tidak muncul di pencarian POS tetapi tetap muncul di riwayat dan laporan. | P0 |

### 7.3 POS — Kasir dan Transaksi

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-POS-01 | Kasir memulai keranjang baru, lalu menambahkan barang lewat pemindai barcode atau pencarian manual. | P0 |
| FR-POS-02 | Memindai barang yang sama menambah kuantitas. Kasir dapat mengubah kuantitas dan menghapus item sebelum pembayaran. | P0 |
| FR-POS-03 | Keranjang menampilkan nama, harga satuan, kuantitas, diskon (jika ada), subtotal item, dan indikasi stok. | P0 |
| FR-POS-04 | Sistem menghitung subtotal, diskon, total akhir, uang diterima, dan kembalian secara otomatis. | P0 |
| FR-POS-05 | Pembayaran tunai: kasir memasukkan uang diterima; tombol Bayar nonaktif bila uang kurang dari total. Tersedia tombol nominal cepat (uang pas, pecahan umum). | P0 (nominal cepat P1) |
| FR-POS-06 | Diskon per item atau per transaksi (nominal atau persen) dengan batas sesuai peran. Melebihi batas membutuhkan Approval. | P1 |
| FR-POS-07 | Saat pembayaran dikonfirmasi, penjualan, item, pembayaran, dan pergerakan stok disimpan dalam **satu operasi atomik** (BR-03). | P0 |
| FR-POS-08 | Mencegah transaksi ganda: tombol Bayar terkunci selama proses dan setiap transaksi memiliki ID unik (idempotency). | P0 |
| FR-POS-09 | Jika penyimpanan gagal, sistem tidak menampilkan sukses, stok tidak berubah sebagian, dan keranjang tetap utuh. | P0 |
| FR-POS-10 | Penjualan melebihi stok tersedia ditolak (BR-10). | P0 |
| FR-POS-11 | Produk nonaktif atau batch kedaluwarsa tidak dapat dijual dan diberi pesan yang jelas. | P0 |
| FR-POS-12 | Setelah sukses, sistem menampilkan nomor struk, mengosongkan keranjang, dan menawarkan cetak atau tampil struk. Kegagalan printer tidak membatalkan transaksi dan struk dapat dicetak ulang. | P0 |
| FR-POS-13 | Riwayat transaksi dapat dicari berdasarkan nomor struk, tanggal, dan kasir, sesuai hak akses. | P0 |
| FR-POS-14 | **Void:** pembatalan seluruh transaksi dengan alasan wajib dan izin sesuai peran. Menghasilkan reversal; transaksi asli tidak dihapus (BR-04). | P0 |
| FR-POS-15 | **Retur:** pengembalian sebagian atau seluruh item yang terhubung ke transaksi asal, dengan alasan, kondisi barang, dan nilai refund. | P0 |
| FR-POS-16 | Tahan transaksi (hold) dan lanjutkan: kasir dapat memiliki beberapa keranjang yang ditahan. | P1 |
| FR-POS-17 | Grid produk favorit/sering dijual untuk barang tanpa barcode. | P1 |
| FR-POS-18 | Pembayaran non-tunai dapat **dicatat manual** (misalnya transfer atau QRIS) sebagai metode pembayaran, tanpa integrasi. | P1 |
| FR-POS-19 | Pajak (PPN) dapat diaktifkan di pengaturan. Bawaan: nonaktif. | P2 |
| FR-POS-20 | Pembulatan total ke kelipatan tertentu (misalnya Rp100), dengan selisih tercatat terpisah. *Bergantung pada OQ-04.* | P2 |

### 7.4 INV — Inventaris Tunggal

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-INV-01 | Seluruh stok toko depan dan ruang belakang adalah **satu saldo** (BR-01). Tidak ada transfer antar-ruangan di MVP. | P0 |
| FR-INV-02 | Stok hanya berubah melalui: penjualan, penerimaan, retur, penyesuaian, barang rusak/kedaluwarsa, atau stok opname yang disetujui. Semuanya menghasilkan movement. | P0 |
| FR-INV-03 | Tampilkan stok saat ini per produk, stok minimum, status menipis/habis, dan nilai persediaan estimasi. | P0 |
| FR-INV-04 | **Penyesuaian** wajib memilih jenis (rusak, kedaluwarsa, hilang, koreksi lain) dan mengisi alasan. | P0 |
| FR-INV-05 | **Stok opname** dikelola sebagai sesi: tentukan cakupan, hitung fisik, bandingkan dengan sistem, review, lalu posting selisih. | P0 |
| FR-INV-06 | Mode **hitung buta** (blind count) menyembunyikan jumlah sistem dari penghitung. | P1 |
| FR-INV-07 | **Kartu stok** per produk: waktu, tipe movement, referensi, masuk, keluar, saldo, pengguna, catatan. | P0 |
| FR-INV-08 | Saldo tidak dapat diedit langsung. Koreksi movement dilakukan dengan reversal yang terlacak. | P0 |
| FR-INV-09 | Peringatan stok menipis/habis ditampilkan di dashboard. | P1 |
| FR-INV-10 | Alat pemeriksaan konsistensi: bandingkan saldo dengan jumlah movement dan tandai produk yang tidak cocok. | P1 |

### 7.5 EXP — Batch dan Kedaluwarsa

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-EXP-01 | Produk dengan pelacakan kedaluwarsa menyimpan batch: kode batch, tanggal kedaluwarsa, kuantitas, biaya per unit. | P0 |
| FR-EXP-02 | Tanggal kedaluwarsa disimpan sebagai **tanggal kalender**, bukan timestamp. | P0 |
| FR-EXP-03 | Penjualan mengalokasikan stok dengan **FEFO** (kedaluwarsa terdekat keluar lebih dulu) secara otomatis. Kasir tidak memilih batch di MVP [USULAN]. | P0 |
| FR-EXP-04 | Batch yang sudah kedaluwarsa diblokir dari penjualan normal. Pengecualian hanya jika owner mengaktifkannya secara eksplisit (bawaan: blokir). | P0 |
| FR-EXP-05 | Peringatan default H-30, H-14, H-7, H-1, dan sudah kedaluwarsa; rentang dapat dikonfigurasi. | P1 |
| FR-EXP-06 | Barang rusak/kedaluwarsa dikeluarkan dari stok melalui penyesuaian yang mencatat alasan dan pengguna. | P0 |
| FR-EXP-07 | Saldo awal produk yang dilacak kedaluwarsa wajib dimasukkan dengan batch dan tanggal kedaluwarsa. | P0 |

### 7.6 SUP — Pemasok dan Penerimaan Barang

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-SUP-01 | Kelola pemasok: nama, kontak (opsional), alamat (opsional), catatan, status aktif. Pemasok yang pernah dipakai diarsipkan, bukan dihapus. | P0 |
| FR-SUP-02 | Penerimaan langsung tanpa PO: nomor faktur/surat jalan, tanggal, pemasok, item, kuantitas, satuan, biaya beli, diskon (opsional), batch dan expiry bila berlaku. | P0 |
| FR-SUP-03 | Penerimaan baru menambah stok **setelah dikonfirmasi (diposting)**. | P0 |
| FR-SUP-04 | Penerimaan dapat disimpan sebagai draft sebelum diposting. Penerimaan yang sudah diposting tidak diedit diam-diam; koreksi lewat reversal. | P0 (draft P1) |
| FR-SUP-05 | Harga pokok memakai **weighted average cost** untuk laporan, sambil menyimpan biaya per penerimaan/batch (BR-26). | P0 |
| FR-SUP-06 | Purchase order dengan penerimaan sebagian. | P2 |
| FR-SUP-07 | Pencatatan utang pemasok. | P2 |

### 7.7 RPT — Dashboard dan Laporan

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-RPT-01 | Dashboard Overview: penjualan hari ini, jumlah transaksi, estimasi laba kotor, stok menipis, grafik penjualan, produk terlaris, aktivitas terbaru, peringatan stok/kedaluwarsa. | P0 |
| FR-RPT-02 | Laporan penjualan per hari, rentang tanggal, dan bulan: jumlah transaksi, omzet kotor, diskon, retur, omzet bersih. | P0 |
| FR-RPT-03 | Laporan per produk: kuantitas terjual, omzet, dan produk terlaris. | P0 |
| FR-RPT-04 | Estimasi laba kotor, **dilabeli "estimasi"** bila harga pokok tidak lengkap. | P1 |
| FR-RPT-05 | Laporan stok: stok saat ini, stok minimum, menipis, nol, nilai persediaan estimasi. | P0 |
| FR-RPT-06 | Laporan kedaluwarsa berdasarkan rentang tanggal dan status. | P0 |
| FR-RPT-07 | Laporan sesi kasir: saldo awal, penerimaan tunai sistem, kas aktual, selisih. | P0 |
| FR-RPT-08 | Ekspor CSV UTF-8 dengan nama kolom jelas, mengikuti filter yang sedang aktif. | P0 |
| FR-RPT-09 | Viewer audit log dengan filter pengguna, aksi, dan tanggal. | P1 |

**Definisi metrik** (tidak boleh ada angka tanpa definisi):

| Metrik | Definisi |
| --- | --- |
| Omzet kotor | Jumlah total penjualan berstatus selesai pada periode, sebelum retur |
| Omzet bersih | Omzet kotor − diskon (jika belum termasuk) − nilai refund retur pada periode |
| Jumlah transaksi | Jumlah penjualan berstatus selesai (void tidak dihitung) |
| Estimasi laba kotor | Omzet bersih item − (kuantitas bersih × harga pokok snapshot) |
| Stok menipis | Produk aktif dengan stok ≤ stok minimum dan stok minimum > 0 |
| Produk terlaris | Urut berdasarkan kuantitas terjual pada periode (dapat diganti ke omzet) |
| Nilai persediaan | Σ (stok × harga pokok rata-rata), berlabel estimasi |

### 7.8 BKP — Backup, Restore, dan Ekspor

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-BKP-01 | Backup manual dari menu pengaturan; tampilkan waktu dan status backup terakhir. | P0 |
| FR-BKP-02 | Status "berhasil" hanya ditampilkan setelah file benar-benar terbentuk dan lolos validasi dasar (checksum, keterbacaan). | P0 |
| FR-BKP-03 | Sebelum restore: validasi file, versi skema, dan integritas; buat backup data saat ini atau minta konfirmasi eksplisit. | P0 |
| FR-BKP-04 | Restore hanya dapat dilakukan Owner dan tercatat di audit log. | P0 |
| FR-BKP-05 | Pengingat bila backup terakhir lebih lama dari batas yang ditentukan [USULAN: 7 hari]. | P1 |
| FR-BKP-06 | Ekspor CSV master data dan transaksi. Ekspor CSV **bukan** pengganti backup penuh. | P1 |
| FR-BKP-07 | Backup cloud dan sinkronisasi, bila ada, dijelaskan sebagai dua fitur berbeda. | P2 |

### 7.9 SET — Pengaturan dan Pengguna

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-SET-01 | Setup awal (onboarding): identitas toko, akun Owner pertama dengan PIN, zona waktu, dan kebijakan dasar. | P0 |
| FR-SET-02 | Identitas struk: nama toko, alamat, kontak, catatan kaki. | P0 |
| FR-SET-03 | Kebijakan yang dapat dikonfigurasi: batas diskon per peran, stok negatif (bawaan: mati), auto-lock, hari peringatan kedaluwarsa, batas hari retur, ambang persetujuan penyesuaian stok. | P0 |
| FR-SET-04 | Owner mengelola pengguna: tambah, ubah peran, reset PIN, nonaktifkan. Pengguna tidak dihapus jika sudah punya jejak. | P1 |
| FR-SET-05 | Indikator status data yang jelas: offline, menyimpan, tersimpan lokal; (bila sync ada) sync tertunda dan gagal sync. | P0 |
| FR-SET-06 | Halaman uji perangkat untuk memeriksa scanner dan printer. | P1 |

### 7.10 AUD — Audit

| ID | Persyaratan | Prioritas |
| --- | --- | --- |
| FR-AUD-01 | Audit log mencatat: perubahan harga, koreksi stok, void, retur, Approval, perubahan peran/izin, PIN gagal dan lockout, restore, serta perubahan pengaturan penting. | P0 |
| FR-AUD-02 | Setiap entri menyimpan aktor, waktu, jenis aksi, entitas, nilai sebelum/sesudah (bila relevan), alasan, dan referensi. | P0 |
| FR-AUD-03 | Audit log bersifat append-only; tidak dapat diubah atau dihapus lewat aplikasi. | P0 |

---

## 8. Alur Bisnis

### 8.1 Penjualan Tunai

1. Kasir login dan membuka sesi kas.
2. Kasir memindai barcode atau mencari produk.
3. Aplikasi memuat harga dan stok dari data lokal, lalu menambahkan item ke keranjang.
4. Kasir memeriksa kuantitas dan total.
5. Kasir memilih tunai dan memasukkan uang diterima; kembalian dihitung.
6. Kasir menekan **Bayar** sekali; tombol terkunci selama proses.
7. Sistem menyimpan penjualan, item, pembayaran, dan movement stok dalam satu operasi atomik.
8. Aplikasi menampilkan nomor struk dan menawarkan cetak.

**Alur alternatif**

| Kondisi | Perilaku |
| --- | --- |
| Barcode tidak dikenal | Pesan "produk tidak ditemukan", tawarkan pencarian manual; tidak ada item ditambahkan |
| Produk nonaktif / kedaluwarsa | Ditolak dengan pesan jelas |
| Stok tidak cukup | Ditolak; tampilkan stok tersedia |
| Uang diterima kurang | Tombol Bayar nonaktif |
| Penyimpanan gagal | Tidak ada status sukses, stok tidak berubah, keranjang tetap |
| Printer gagal | Transaksi tetap tersimpan, tawarkan cetak ulang |
| Diskon melebihi batas | Minta Approval |

### 8.2 Status Siklus Hidup Penjualan

```
[Keranjang] --Bayar (atomik)--> [Selesai] --Void (izin + alasan)--> [Void]
                                    |
                                    +--Retur sebagian--> [Sebagian diretur]
                                    +--Retur seluruhnya--> [Diretur penuh]
```

| Pembeda | Void | Retur |
| --- | --- | --- |
| Kapan | Kesalahan input / transaksi dibatalkan seluruhnya | Barang sudah diserahkan lalu dikembalikan pelanggan |
| Cakupan | Seluruh transaksi | Sebagian atau seluruh item |
| Stok | Dikembalikan penuh melalui reversal | Bertambah hanya jika barang layak jual |
| Batas waktu | [USULAN] hanya pada sesi kas yang sama; setelahnya gunakan retur | [USULAN] 7 hari, dapat dikonfigurasi |

### 8.3 Penerimaan Barang

1. Pengguna berizin membuka penerimaan barang.
2. Memilih pemasok atau menambah pemasok baru.
3. Memindai/mencari produk; mengisi kuantitas, satuan, biaya beli, serta batch dan expiry bila perlu.
4. Memeriksa ringkasan sebelum posting.
5. Setelah dikonfirmasi, sistem menambah saldo dan membuat movement penerimaan, serta memperbarui harga pokok rata-rata.
6. Penerimaan yang sudah diposting tidak diedit diam-diam; koreksi lewat reversal atau penyesuaian terlacak.

### 8.4 Stok Opname

1. Supervisor membuat sesi dan menentukan cakupan produk.
2. Penghitung memasukkan jumlah fisik (opsional hitung buta).
3. Sistem menyimpan saldo sistem pada saat tiap item dihitung (*snapshot*) dan menghitung selisih.
4. Supervisor meninjau item yang selisih dan dapat meminta hitung ulang.
5. Setelah disetujui, sistem memposting penyesuaian untuk selisih yang disetujui (BR-24).

### 8.5 Retur dan Void

1. Pengguna berizin mencari transaksi asal.
2. Memilih item dan kuantitas, alasan, serta kondisi barang (layak jual / rusak / kedaluwarsa).
3. Sistem menghitung refund dan meminta konfirmasi.
4. Sistem membuat catatan retur atau reversal; stok hanya bertambah bila barang layak jual.
5. Audit log mencatat pengguna, alasan, referensi transaksi, dan perubahan stok/uang.

### 8.6 Buka dan Tutup Sesi Kas

1. Kasir membuka sesi dan memasukkan saldo awal laci.
2. Selama sesi, setiap penjualan tunai, retur tunai, dan void tercatat pada sesi.
3. Saat menutup, kasir menghitung uang fisik di laci dan memasukkannya.
4. Sistem menampilkan kas diharapkan, kas aktual, dan selisih (BR-22).
5. Jika selisih tidak nol, kasir wajib menulis catatan; sesi lalu ditutup dan masuk laporan sesi kasir.

### 8.7 Pemantauan Kedaluwarsa

1. Sistem menghitung status batch setiap hari kerja dan saat aplikasi dibuka.
2. Dashboard menampilkan batch yang masuk jendela peringatan.
3. Petugas stok meninjau, memindahkan barang ke depan, memberi promosi manual, atau menarik barang.
4. Barang yang ditarik dikeluarkan lewat penyesuaian jenis "kedaluwarsa" dengan alasan.

---

## 9. Aturan Bisnis dan Operasional

### 9.1 Inventaris dan Integritas Data

| ID | Aturan |
| --- | --- |
| BR-01 | Stok toko dan gudang adalah satu saldo inventaris gabungan. Tidak ada lokasi inventaris terpisah pada MVP. |
| BR-02 | Semua perubahan stok menghasilkan stock movement yang immutable, atau hanya dapat dikoreksi dengan reversal yang terlacak. |
| BR-03 | Penjualan, item, pembayaran, dan pengurangan stok disimpan dalam satu transaksi atomik. Jika salah satu gagal, semua dibatalkan. |
| BR-04 | Transaksi yang selesai tidak dihapus permanen. Pembatalan dan retur dibuat sebagai catatan baru yang terhubung. |
| BR-05 | Nama, harga, satuan, dan harga pokok pada item penjualan adalah **snapshot** saat transaksi. |
| BR-06 | Uang disimpan sebagai bilangan bulat satuan terkecil (Rupiah), bukan angka pecahan. |
| BR-07 | ID internal tahan bentrok (misalnya UUID) agar sinkronisasi dapat ditambahkan tanpa migrasi paksa. |
| BR-08 | Waktu transaksi disimpan konsisten dan ditampilkan dalam zona waktu toko. Tanggal kedaluwarsa disimpan sebagai tanggal kalender. |
| BR-09 | Produk nonaktif tidak dapat ditambahkan ke transaksi baru, tetapi histori lama tetap tersedia. |
| BR-10 | Stok negatif diblokir secara default. Pengaktifan override membutuhkan izin Owner dan dicatat di audit log. |
| BR-11 | Stok opname harus direview sebelum selisih diposting ke saldo. |
| BR-12 | Kegagalan printer tidak membatalkan transaksi yang sudah tersimpan. |
| BR-13 | Produk timbang disimpan dalam satuan dasar terkecil yang relevan (misalnya gram, mililiter) untuk menghindari kesalahan pembulatan pecahan. *Bergantung pada OQ-01.* |
| BR-25 | Saldo disimpan dalam satuan dasar; konversi pack/karton dilakukan saat transaksi dan dicatat pada snapshot. |

### 9.2 Harga, Diskon, dan Pembayaran

| ID | Aturan |
| --- | --- |
| BR-14 | Total baris = kuantitas × harga satuan, dibulatkan ke Rupiah terdekat (pembulatan setengah ke atas) **per baris**. Total transaksi = jumlah baris − diskon. |
| BR-15 | Diskon tidak boleh membuat total negatif dan tidak boleh melebihi batas peran [USULAN: Kasir ≤ 5%, Supervisor ≤ 20%, Owner tidak dibatasi]. |
| BR-23 | Menjual di bawah harga pokok **diperingatkan** (tidak diblokir) dan tercatat. |
| BR-16 | Nomor struk unik dengan format `{KODE-PERANGKAT}-{YYYYMMDD}-{NNNN}` [USULAN] agar tidak bentrok bila kelak ada lebih dari satu perangkat. |
| BR-22 | Kas diharapkan = saldo awal + Σ(uang diterima − kembalian) pada penjualan tunai − refund tunai. Selisih = kas aktual − kas diharapkan. |

### 9.3 Void, Retur, dan Penyesuaian

| ID | Aturan |
| --- | --- |
| BR-17 | Void hanya pada sesi kas yang sama dan membutuhkan Supervisor/Owner atau Approval [USULAN]; setelah sesi ditutup gunakan retur. |
| BR-18 | Retur dibatasi dalam jumlah hari tertentu sejak transaksi [USULAN: 7 hari] dan tidak boleh melebihi kuantitas terjual dikurangi retur sebelumnya. |
| BR-19 | Barang retur yang rusak atau kedaluwarsa **tidak** kembali ke stok jual; dicatat sebagai movement tersendiri. |
| BR-20 | Penyesuaian stok di atas ambang nilai atau kuantitas tertentu membutuhkan Approval [USULAN]. |
| BR-24 | Selisih opname dihitung terhadap saldo saat item dihitung (snapshot). Saat posting: penyesuaian = jumlah hitung − snapshot, diterapkan pada saldo terkini. Penjualan yang terjadi antara waktu hitung dan posting tidak dibatalkan. |

*Contoh BR-24:* snapshot 10, hitung fisik 8, lalu 2 terjual sebelum posting (saldo 8). Penyesuaian = 8 − 10 = −2, saldo akhir = 6.

### 9.4 Sesi, Biaya, dan Kedaluwarsa

| ID | Aturan |
| --- | --- |
| BR-21 | Penjualan hanya dapat dilakukan saat ada sesi kasir terbuka. |
| BR-26 | Harga pokok memakai weighted average cost per produk, diperbarui saat penerimaan diposting. Penjualan menyimpan harga pokok snapshot; retur memakai harga pokok snapshot transaksi asal. |
| BR-27 | Dokumen yang sudah diposting (penerimaan, opname, penjualan) tidak dapat diubah; hanya dikoreksi dengan catatan baru. |
| BR-28 | Barang kedaluwarsa tidak dijual secara normal. Alokasi batch memakai FEFO. |
| BR-29 | Zona waktu toko menentukan batas hari pada seluruh laporan. Rentang tanggal laporan bersifat inklusif. |

---

## 10. Persyaratan Nonfungsional

Ringkasan. Cara pemenuhan teknis ada di `ARCHITECTURE.md`, cara verifikasi di `TESTING.md`.

| Area | Persyaratan |
| --- | --- |
| Offline | Seluruh alur P0 berfungsi tanpa koneksi setelah data awal tersedia. |
| Performa | Pencarian produk dan hasil scan terasa instan di tablet target. Ambang angka ditetapkan setelah uji perangkat nyata. |
| Reliabilitas | Operasi stok dan checkout atomik; kegagalan me-rollback seluruh operasi terkait. |
| Keamanan | PIN di-hash, kontrol akses per operasi di lapisan bisnis, audit log, backup terlindungi. |
| Aksesibilitas | Kontras memadai, target sentuh besar, label form, navigasi keyboard, status tidak hanya dibedakan dengan warna. |
| Kompatibilitas | Chrome Android dan satu browser desktop yang dipakai; ukuran tablet jadi prioritas. |
| Pemeliharaan | Komponen reusable, logika domain terpisah dari UI, migrasi skema, log error tanpa data sensitif. |
| Pemulihan | Tersedia prosedur backup/restore dan panduan jika database tidak dapat dibuka. |
| Privasi | MVP tidak mengumpulkan data pelanggan secara default; tidak menyimpan data kartu. |
| Ketahanan penyimpanan | Aplikasi meminta penyimpanan persisten dari browser dan menampilkan peringatan jika tidak diberikan. |
| Lokalisasi | Antarmuka Bahasa Indonesia; format angka dan tanggal sesuai lokal Indonesia. |

---

## 11. Kriteria Penerimaan (Acceptance Criteria)

Format: **Given** (kondisi awal), **When** (aksi), **Then** (hasil yang harus terbukti). Setiap AC harus punya setidaknya satu tes otomatis atau prosedur uji manual di `TESTING.md`.

### 11.1 Akses dan Sesi

| ID | Given | When | Then | Ref |
| --- | --- | --- | --- | --- |
| AC-13 | Pengguna berperan Kasir | Memanggil operasi koreksi stok atau void secara langsung (UI maupun pemanggilan logic/API) | Ditolak oleh lapisan bisnis tanpa mengubah data | FR-AUTH, §5.2 |
| AC-30 | Pengguna berperan Kasir | Membuka laporan laba atau menu pengguna | Menu tidak tersedia dan akses langsung ditolak | §5.2 |
| AC-31 | PIN salah sebanyak batas percobaan | Mencoba lagi | Akun terkunci sementara dan kejadian tercatat di audit log | FR-AUTH-03 |
| AC-32 | Sesi kas dibuka dengan saldo awal Rp100.000, penjualan tunai bersih Rp450.000 | Kasir menutup dengan kas aktual Rp540.000 | Kas diharapkan Rp550.000, selisih −Rp10.000, catatan wajib diisi | FR-AUTH-07, BR-22 |
| AC-41 | Tidak ada sesi kasir terbuka | Kasir mencoba membayar | Ditolak dengan pesan untuk membuka sesi kas | BR-21 |

### 11.2 Katalog

| ID | Given | When | Then | Ref |
| --- | --- | --- | --- | --- |
| AC-01 | Produk dengan nama dan barcode tersimpan | Kasir mencari dengan nama atau memindai barcode | Produk yang dipilih sesuai dan ditambahkan ke keranjang | FR-CAT-04, FR-POS-01 |
| AC-38 | Barcode sudah dipakai produk A | Pengguna menyimpan produk B dengan barcode yang sama | Ditolak dengan pesan yang menyebut produk A | FR-CAT-03 |
| AC-39 | Produk sudah memiliki transaksi | Pengguna mencoba menghapus | Hanya dapat diarsipkan; histori tetap utuh | FR-CAT-01 |
| AC-10 | Struk lama berisi harga Rp10.000 | Harga master diubah ke Rp12.000 | Struk lama tetap Rp10.000; transaksi baru memakai Rp12.000 | BR-05 |
| AC-19 | Produk berstatus nonaktif | Kasir mencari atau memindai | Tidak dapat ditambahkan ke keranjang dan tampil pesan jelas | BR-09 |

### 11.3 POS dan Pembayaran

| ID | Given | When | Then | Ref |
| --- | --- | --- | --- | --- |
| AC-02 | Keranjang berisi item dan pembayaran valid | Kasir menekan Bayar | Penjualan, item, pembayaran, dan pengurangan stok tersimpan sebagai satu unit atomik | BR-03 |
| AC-03 | Keranjang siap dibayar | Kasir menekan Bayar berulang kali atau menekan lalu menyegarkan halaman | Hanya satu transaksi terbentuk dan stok berkurang sekali | FR-POS-08 |
| AC-04 | Penyimpanan dipaksa gagal saat checkout | Kasir menekan Bayar | Tidak ada status sukses, stok tidak berubah, keranjang tetap | FR-POS-09 |
| AC-05 | Transaksi sudah tersimpan | Aplikasi ditutup dan dibuka kembali | Transaksi tetap tersedia di riwayat | G-05 |
| AC-16 | Perangkat dalam mode pesawat | Kasir menyelesaikan penjualan | Transaksi tersimpan lokal dan stok berkurang | C-04 |
| AC-17 | Total Rp47.500 | Uang diterima Rp50.000 | Kembalian Rp2.500. Jika uang diterima Rp40.000, tombol Bayar nonaktif dan muncul pesan kekurangan | FR-POS-04, FR-POS-05 |
| AC-18 | Stok produk 3 | Kasir menambah kuantitas 5 | Ditolak dengan pesan "stok tersedia 3" | BR-10 |
| AC-20 | Batas diskon Kasir 5% | Kasir memberi diskon 10% | Meminta Approval; tanpa Approval ditolak. Dengan Approval, tercatat di audit log | FR-POS-06, BR-15 |
| AC-21 | Produk timbang Rp14.000/kg, stok 5 kg *(jika OQ-01 dikonfirmasi)* | Kasir menjual 0,75 kg | Total baris Rp10.500 dan stok menjadi 4,25 kg | FR-CAT-07, BR-14 |
| AC-12 | Printer tidak merespons | Kasir menyelesaikan transaksi | Transaksi tersimpan dan struk dapat dicetak ulang | BR-12 |
| AC-22 | Satu keranjang sedang dikerjakan | Kasir menahan keranjang dan memulai keranjang baru | Keranjang pertama dapat dilanjutkan tanpa kehilangan item | FR-POS-16 |

### 11.4 Void dan Retur

| ID | Given | When | Then | Ref |
| --- | --- | --- | --- | --- |
| AC-11 | Transaksi selesai | Supervisor melakukan void dengan alasan | Transaksi asal tetap ada berstatus void; stok kembali lewat reversal; audit log tercatat | BR-04 |
| AC-28 | Retur dengan kondisi "layak jual" dan "rusak" | Retur diposting | Stok bertambah hanya untuk yang layak jual; yang rusak tercatat sebagai movement terpisah | BR-19 |
| AC-29 | Item terjual 2, sudah diretur 1 | Pengguna meretur 2 | Ditolak karena melebihi sisa yang dapat diretur | BR-18 |

### 11.5 Inventaris dan Penerimaan

| ID | Given | When | Then | Ref |
| --- | --- | --- | --- | --- |
| AC-06 | Barang di rak depan dan ruang belakang | Stok dilihat | Hanya ada satu saldo gabungan; tidak ada pemisahan lokasi | BR-01 |
| AC-07 | Penerimaan dikonfirmasi | Penerimaan diposting | Stok bertambah; pemasok, waktu, kuantitas, dan biaya tercatat | FR-SUP-02, 03 |
| AC-08 | Pengguna membuat penyesuaian | Tanpa alasan | Ditolak. Dengan alasan, pengguna dan movement tercatat | FR-INV-04 |
| AC-23 | Snapshot 10, hitung fisik 8, lalu 2 terjual | Opname diposting | Penyesuaian −2, saldo akhir 6 | BR-24 |
| AC-24 | Produk dengan banyak movement | Kartu stok dibuka | Saldo akhir sama dengan jumlah seluruh movement | FR-INV-07 |
| AC-25 | Penerimaan sudah diposting | Pengguna mencoba mengedit kuantitas | Tidak dapat diedit; hanya koreksi lewat reversal terlacak | BR-27 |
| AC-42 | Sesi opname belum disetujui | Penghitung memasukkan hasil | Saldo belum berubah sampai Supervisor menyetujui | BR-11 |

### 11.6 Batch dan Kedaluwarsa

| ID | Given | When | Then | Ref |
| --- | --- | --- | --- | --- |
| AC-09 | Produk dilacak expiry, seluruh batch sudah kedaluwarsa | Kasir mencoba menjual | Diblokir dengan pesan jelas | FR-EXP-04 |
| AC-26 | Batch A (exp 1 Des, 3 unit) dan batch B (exp 1 Jan, 10 unit) | Terjual 5 unit | Batch A berkurang 3 dan batch B berkurang 2 | FR-EXP-03 |
| AC-27 | Batch kedaluwarsa dalam 7 hari | Dashboard dibuka | Batch muncul di daftar peringatan dengan sisa hari | FR-EXP-05 |

### 11.7 Laporan, Backup, dan Audit

| ID | Given | When | Then | Ref |
| --- | --- | --- | --- | --- |
| AC-14 | Transaksi pada rentang tanggal tertentu | Laporan dibuka dengan rentang tersebut | Angka sama dengan agregat transaksi sumber, termasuk batas hari | BR-29 |
| AC-33 | Ada transaksi void dan retur | Laporan penjualan dibuka | Void tidak dihitung; retur mengurangi omzet bersih sesuai definisi metrik | §7.7 |
| AC-34 | Filter tanggal aktif | Pengguna mengekspor CSV | File UTF-8 dengan kolom jelas dan hanya berisi data sesuai filter | FR-RPT-08 |
| AC-15 | Backup dibuat | Dipulihkan pada perangkat uji | Data identik dan terverifikasi (jumlah produk, transaksi, saldo) | FR-BKP-03 |
| AC-35 | File backup rusak atau versi tidak cocok | Restore dicoba | Ditolak dengan pesan jelas dan data saat ini tidak berubah | FR-BKP-03 |
| AC-36 | Pembuatan backup gagal di tengah jalan | Proses berakhir | Status tidak menampilkan "berhasil" | FR-BKP-02 |
| AC-37 | Perangkat kehilangan koneksi | Pengguna melihat header aplikasi | Indikator offline/tersimpan lokal tampil jelas | FR-SET-05 |
| AC-40 | Aksi sensitif dilakukan | Audit log dibuka | Entri menampilkan aktor, waktu, aksi, nilai sebelum/sesudah, alasan; entri tidak dapat diubah | FR-AUD-01 s.d. 03 |

---

## 12. Definisi Selesai (Definition of Done)

Sebuah fitur dinyatakan selesai hanya jika **semua** poin berikut terpenuhi:

- [ ] Memenuhi acceptance criteria dan skenario uji terkait.
- [ ] Tidak ada error TypeScript/lint yang belum disetujui secara eksplisit.
- [ ] Tersedia keadaan loading, kosong, sukses, dan error.
- [ ] Hak akses diperiksa di lapisan bisnis, bukan hanya di tampilan.
- [ ] Perubahan stok memiliki movement dan audit yang sesuai.
- [ ] Alur offline dan persistensi diuji pada browser/perangkat target.
- [ ] Tidak ada tombol mati, data palsu yang menyamar sebagai data nyata, atau angka laporan tanpa definisi.
- [ ] Dokumentasi diperbarui (termasuk `CHANGELOG.md`, bila ada perubahan perilaku atau skema).

Aturan kerja AI agent dan developer untuk mencapai DoD ini ada di `AGENTS.md`.

---

## 13. Risiko dan Mitigasi

| ID | Risiko | Dampak | Mitigasi |
| --- | --- | --- | --- |
| R-01 | Browser Android membersihkan penyimpanan lokal (data hilang) | Kehilangan transaksi dan stok | Minta penyimpanan persisten, pengingat backup, ekspor berkala, uji pada perangkat nyata |
| R-02 | Scanner atau printer tidak kompatibel dengan browser | Alur kasir terhambat | Uji perangkat nyata sejak awal; jangan mengklaim kompatibilitas sebelum diuji |
| R-03 | Kebutuhan multi-perangkat muncul mendadak | Desain data harus diubah | ID tahan bentrok (BR-07), movement bersifat event, desain sync diputuskan sebelum fitur diaktifkan |
| R-04 | Input data awal (ratusan produk) terlalu lama | Adopsi tertunda | Impor CSV, barcode internal, pengisian bertahap |
| R-05 | Kasir menolak atau salah pakai | Data tidak akurat | Layar POS minimalis, pelatihan ≤ 30 menit, pesan kesalahan yang jelas |
| R-06 | Opname jarang dilakukan | Saldo menyimpang dari fisik | Pengingat opname, opname sebagian per kategori |
| R-07 | Harga pokok tidak lengkap | Laba menyesatkan | Label "estimasi", tandai produk tanpa biaya |
| R-08 | Perangkat hilang atau rusak | Kehilangan data operasional | Backup berkala ke penyimpanan eksternal, prosedur pemulihan terdokumentasi |
| R-09 | Fitur tambahan (bon, harga grosir) menyusup tanpa desain | Kebijakan stok dan uang kacau | Semua tambahan lewat revisi PRD dan keputusan di Bagian 14 |

---

## 14. Keputusan Terbuka yang Perlu Dikonfirmasi

| ID | Pertanyaan | Default [USULAN] | Dampak jika berbeda |
| --- | --- | --- | --- |
| OQ-01 | Apakah ada barang **timbang/curah** (kg, liter) yang dijual dengan kuantitas desimal? | Ya, didukung (FR-CAT-07, BR-13) | Mengubah tipe data kuantitas di seluruh sistem |
| OQ-02 | Apakah toko menjual **kredit/kasbon** kepada pelanggan? | Tidak di MVP | Butuh modul pelanggan dan piutang |
| OQ-03 | Apakah ada **harga bertingkat** (eceran vs grosir)? | Satu harga per satuan; pack/karton punya harga sendiri | Mengubah model harga dan POS |
| OQ-04 | Perlu **pembulatan** total ke Rp100/Rp500? | Tidak aktif | Menambah aturan dan kolom selisih pembulatan |
| OQ-05 | Apakah **PPN** perlu dipakai? | Nonaktif | Mengubah perhitungan total dan struk |
| OQ-06 | Batas diskon per peran, batas hari retur, dan ketentuan void | Lihat BR-15, BR-17, BR-18 | Hanya konfigurasi |
| OQ-07 | Metode harga pokok: weighted average atau FIFO? | Weighted average | Mengubah laporan laba dan nilai persediaan |
| OQ-08 | Satu tablet atau beberapa perangkat kasir? | Satu | Jika lebih, desain sinkronisasi wajib sebelum rilis |
| OQ-09 | Model tablet, browser, scanner, dan printer thermal yang dipakai? | Belum diketahui | Menentukan pengujian dan kemungkinan Capacitor |
| OQ-10 | Pembayaran non-tunai hanya dicatat manual atau perlu integrasi? | Dicatat manual (P1) | Integrasi di luar MVP |
| OQ-11 | Apakah semua produk wajib berbarcode? Produk mana yang perlu batch/expiry? | Barcode internal untuk yang tidak punya; expiry hanya untuk yang ditandai | Mempengaruhi impor data dan beban input |
| OQ-12 | Backup lokal cukup atau perlu backup cloud sejak awal? | Lokal manual cukup | Menambah backend dan keamanan |
| OQ-13 | Nama aplikasi dan identitas toko pada struk | Nama kerja "SembakoOS" | Hanya branding |
| OQ-14 | Ambang persetujuan penyesuaian stok | Ditentukan pemilik (nilai atau kuantitas) | Hanya konfigurasi |

Keputusan yang sudah dikonfirmasi dipindahkan ke `CHANGELOG.md` sebagai catatan keputusan dan dihapus dari tabel ini.

---

## 15. Glosarium

| Istilah | Arti |
| --- | --- |
| POS | Point of Sale, layar kasir untuk menjual |
| Movement | Catatan perubahan stok (masuk atau keluar) yang tidak diubah setelah dibuat |
| Ledger | Kumpulan seluruh movement yang menjadi dasar saldo stok |
| Saldo | Jumlah stok saat ini; harus sama dengan jumlah seluruh movement |
| Snapshot | Salinan nilai (nama, harga, biaya) pada saat transaksi agar histori tidak berubah |
| Atomik | Beberapa operasi dianggap satu kesatuan; semua berhasil atau semua dibatalkan |
| Idempotency | Pengulangan permintaan yang sama tidak menghasilkan efek ganda |
| FEFO | First-Expired, First-Out, barang dengan kedaluwarsa terdekat dijual lebih dulu |
| Batch/Lot | Kelompok barang dengan tanggal kedaluwarsa yang sama |
| Void | Pembatalan seluruh transaksi |
| Retur | Pengembalian barang oleh pelanggan |
| Approval | Persetujuan Supervisor/Owner lewat PIN di tempat |
| Stok opname | Penghitungan fisik stok lalu dibandingkan dengan sistem |
| Weighted average cost | Harga pokok rata-rata tertimbang dari seluruh penerimaan |
| PWA | Progressive Web App, web app yang dapat dipasang dan berjalan offline |
| Offline-first | Data tersimpan lokal terlebih dahulu; internet hanya tambahan |
| MVP | Minimum Viable Product, versi pertama yang layak dipakai |

---

## 16. Peta Dokumen Proyek

| Dokumen | Isi | Prioritas | Sumber dari PRD v1.0 |
| --- | --- | --- | --- |
| `PRD.md` | Apa, untuk siapa, dan kapan dianggap benar (dokumen ini) | Wajib | Bagian 1–7, 12, 14, 16, 17, 20, 21 |
| `DESIGN_SYSTEM.md` | Warna, tipografi, spacing, komponen shadcn/ui, responsive, aksesibilitas, referensi visual | Wajib | Bagian 11 (Spesifikasi UI/UX) |
| `ARCHITECTURE.md` | Teknologi, struktur kode, alur data, autentikasi, offline dan sinkronisasi, integrasi perangkat | Wajib | Bagian 9, 13, 14, 15 |
| `TASKS.md` | Tahapan implementasi bertahap dengan checklist | Wajib | Bagian 18 (Prioritas Implementasi) |
| `AGENTS.md` | Aturan kerja AI agent | Wajib | Bagian 19 dan Lampiran A |
| `DATABASE.md` | Tabel, tipe data, relasi, indeks, constraint | Sangat disarankan | Bagian 8 (Model Data) |
| `TESTING.md` | Skenario dan standar pengujian | Sangat disarankan | Bagian 17 (Rencana Pengujian) |
| `CHANGELOG.md` | Riwayat perubahan dan keputusan teknis | Opsional | Baru |

**Urutan baca untuk AI agent:** `AGENTS.md` → `PRD.md` → `ARCHITECTURE.md` → `DATABASE.md` → `DESIGN_SYSTEM.md` → `TASKS.md` → `TESTING.md`.

**Keterlacakan:** setiap tugas di `TASKS.md` merujuk ke ID FR/AC, dan setiap skenario di `TESTING.md` merujuk ke ID AC. Jika sebuah FR tidak punya AC atau tugas, itu celah yang harus ditutup.

---

## 17. Riwayat Revisi

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 1.0 | — | Draft awal: ringkasan, ruang lingkup, peran, persyaratan, model data, arsitektur, UI/UX, pengujian, fase. |
| 1.1 | 24 Okt 2026 | Restrukturisasi menjadi PRD murni dan pemindahan detail teknis ke dokumen pendamping. Penambahan: pernyataan masalah, persona, matriks hak akses, ID persyaratan dan prioritas (P0–P2), alur status penjualan, pembeda void vs retur, definisi metrik, aturan bisnis diperluas (BR-13 s.d. BR-29), acceptance criteria format Given/When/Then (AC-01 s.d. AC-42), risiko, glosarium, dan keputusan terbuka (OQ-01 s.d. OQ-14), termasuk barang timbang, kasbon, dan harga bertingkat. |
