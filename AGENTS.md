# AGENTS — Aturan Kerja AI Agent untuk SembakoOS

File ini adalah instruksi **wajib** bagi setiap AI agent (dan developer) yang mengubah proyek ini. Baca seluruhnya sebelum menulis kode.

| Atribut | Nilai |
| --- | --- |
| Versi dokumen | 1.0 |
| Tanggal | 24 Oktober 2026 |
| Berlaku untuk | Semua perubahan kode, skema, konfigurasi, dan dokumentasi |

---

## 1. Proyek dalam Satu Paragraf

SembakoOS adalah aplikasi kasir dan manajemen stok untuk **satu toko sembako**, berupa web app/PWA React + TypeScript + Tailwind + shadcn/ui yang **offline-first** di tablet Android. Data bisnis disimpan lokal (IndexedDB/Dexie). Toko depan dan gudang adalah **satu inventaris gabungan**. Prioritas: **akurasi uang dan stok**, kemudahan kasir, keterlacakan (audit), dan pemulihan data.

---

## 2. Urutan Baca dan Sumber Kebenaran

Baca dalam urutan ini sebelum mengerjakan tugas:

| # | Dokumen | Kapan dipakai |
| --- | --- | --- |
| 1 | `AGENTS.md` (ini) | Selalu |
| 2 | `PRD.md` | **Sumber kebenaran kebutuhan.** Apa yang dibangun, aturan bisnis, acceptance criteria |
| 3 | `ARCHITECTURE.md` | Struktur, lapisan, alur data, keamanan, offline |
| 4 | `DATABASE.md` | Skema, invarian, unit transaksi atomik |
| 5 | `DESIGN_SYSTEM.md` | Setiap pekerjaan UI |
| 6 | `TASKS.md` | Tugas apa yang dikerjakan sekarang dan kapan selesai |
| 7 | `TESTING.md` | Tes yang harus ditulis dan dijalankan |
| 8 | `CHANGELOG.md` | Riwayat dan keputusan teknis |

**Hierarki bila bertentangan:** `PRD.md` (kebutuhan) > `DATABASE.md` & `ARCHITECTURE.md` (teknis) > `DESIGN_SYSTEM.md` (tampilan) > kode yang sudah ada. Jangan "memperbaiki" PRD diam-diam dengan mengubah kode. Jika menemukan pertentangan atau kekurangan, **berhenti dan laporkan** (lihat §9).

---

## 3. Aturan Emas (tidak boleh dilanggar)

1. **Jangan mengarang aturan bisnis.** Bila PRD tidak menjelaskan atau ada tanda `[USULAN]`/`OQ-xx`, pakai default yang tertulis, buat agar mudah diubah (konfigurasi), catat sebagai asumsi di `TASKS.md` → Pertanyaan Terbuka, dan beri tahu pemilik. Jangan memutuskan sendiri.
2. **Jangan mengubah fitur yang sudah berjalan tanpa alasan.** Setiap perubahan perilaku yang sudah ada harus: (a) berasal dari tugas/PRD, (b) diperiksa dependensinya, (c) dilindungi tes regresi, (d) dicatat di `CHANGELOG.md`.
3. **Jangan membuat data dummy untuk menggantikan integrasi nyata.** Tidak ada angka, produk, transaksi, atau status palsu di jalur produksi. Data demo hanya lewat `pnpm seed:demo`, berlabel jelas, dan tidak ikut build produksi.
4. **Jangan membuat tombol, menu, atau layar palsu.** Fitur yang belum ada disembunyikan, atau tampil nonaktif dengan label "Segera hadir". Tombol yang tampak aktif harus berfungsi.
5. **Gunakan yang sudah ada sebelum membuat yang baru.** Urutan: komponen `ui/` shadcn → komposisi di `shared/` → komponen baru (butuh alasan tertulis). Berlaku juga untuk fungsi domain dan helper.
6. **Jangan menghapus file, tabel, atau data, dan jangan mengubah skema secara destruktif, tanpa persetujuan eksplisit pemilik proyek** (lihat §7).
7. **Jangan menandai tugas selesai sebelum benar-benar diuji.** `[x]` hanya bila semua syarat "Selesai bila" terpenuhi dan `pnpm check` hijau dengan bukti (lihat §6).
8. **Uang dan stok tidak boleh salah.** Lihat aturan kode wajib di §4.
9. **Jangan melemahkan kontrol demi kecepatan:** jangan melewati `authorize()`, jangan menulis saldo stok langsung, jangan menonaktifkan tes, lint, atau aturan batas lapisan agar build lolos.
10. **Kerjakan bertahap.** Satu tugas dari `TASKS.md` pada satu waktu, berurutan per fase. Jangan membangun "sekalian" modul lain.

---

## 4. Aturan Kode Wajib

### 4.1 Uang, kuantitas, waktu
- Uang = **integer Rupiah**. Dilarang `float`, `toFixed`, `parseFloat` untuk uang. Operasi lewat `domain/money`.
- Kuantitas = **integer satuan dasar** (`qty_base`). Konversi hanya lewat `domain/quantity`.
- Biaya per satuan dasar memakai skala `_x10k` (lihat `DATABASE.md`).
- Waktu: simpan epoch ms UTC; tanggal kedaluwarsa = string `YYYY-MM-DD`. Batas hari mengikuti **zona waktu toko** lewat `domain/time`. Domain tidak memanggil `Date.now()` atau `crypto.randomUUID()` langsung; gunakan `Clock` dan `IdGenerator` yang disuntikkan.
- Format tampilan hanya lewat `lib/format` (`Intl` id-ID).

### 4.2 Stok dan transaksi
- **Semua perubahan stok lewat `InventoryService`** (satu pintu) dan menghasilkan movement. Dilarang menulis `inventory_balances` dari tempat lain atau mengedit saldo langsung.
- Operasi bisnis = **satu transaksi atomik** (`DATABASE.md` §6). Baca-ubah-tulis saldo dilakukan **di dalam** transaksi yang sama.
- Di dalam transaksi Dexie **jangan** `await` hal non-IndexedDB (jaringan, timer, `fetch`, dialog).
- Galat bisnis dari dalam transaksi harus **membatalkan** transaksi (pola `Abort`), bukan sekadar mengembalikan `Result.err`.
- Efek samping non-data (cetak, bunyi, notifikasi) **setelah** commit berhasil.
- Tabel append-only (`stock_movements`, `audit_logs`, dst.) tidak punya `update/delete` di repository.
- Dokumen yang sudah diposting tidak diedit; koreksi lewat reversal/penyesuaian terlacak.
- Jangan hapus fisik data yang sudah dirujuk; gunakan arsip/nonaktif.

### 4.3 Izin dan keamanan
- Setiap service yang mengubah/membaca data sensitif memanggil `authorize(actor, permission)` di awal. Menyembunyikan tombol di UI **bukan** kontrol.
- Aksi sensitif membuat `audit_logs` (aktor, waktu, aksi, entitas, sebelum/sesudah, alasan) **dalam transaksi yang sama**.
- Jangan menyimpan atau mencatat (log, audit, error) PIN, hash, atau data pembayaran sensitif.
- Jangan menambah skrip pihak ketiga, analitik, atau panggilan jaringan keluar tanpa persetujuan.
- Jangan memakai `localStorage`/`sessionStorage` untuk data bisnis.
- Jangan menggunakan `dangerouslySetInnerHTML` dengan data pengguna.

### 4.4 Gaya dan struktur
- TypeScript `strict`; **dilarang `any`** dan `// @ts-ignore` tanpa komentar alasan + persetujuan; hindari `as` yang memaksa tipe.
- Ikuti aturan dependensi lapisan (`ARCHITECTURE.md` §5). `domain/` murni (tanpa React/Dexie). UI tidak mengakses Dexie langsung.
- Validasi input di batas dengan **Zod**; skema dipakai ulang antara form dan service.
- Berkas > 300 baris dipecah; satu komponen utama per berkas; hindari komponen raksasa.
- Teks antarmuka dari `lib/copy`; istilah baku (Kasir, Bayar, Void, Retur, Stok opname, dll.).
- Komentar menjelaskan **mengapa**, bukan **apa**. Hapus kode mati; jangan meninggalkan `TODO` tanpa tautan ke tugas di `TASKS.md`.
- Jangan menambah dependensi baru tanpa alasan tertulis (ukuran, lisensi, pemeliharaan) dan persetujuan. Cek lisensi dan ukuran bundel.

### 4.5 UI
- Warna, ukuran, radius **hanya lewat token** (`DESIGN_SYSTEM.md`). Dilarang heksadesimal/`px` ad hoc/`style={{}}` untuk tampilan.
- Tangani lima keadaan: memuat, kosong, galat, sukses, parsial.
- Target sentuh ≥ 44 px (POS 56 px), fokus terlihat, dapat dioperasikan keyboard, status bukan hanya warna.
- Font dan aset **dikemas lokal** (aplikasi harus berjalan offline). Dilarang memuat dari CDN.
- Jangan mengedit `src/components/ui/` kecuali menambah varian yang tercatat di `DESIGN_SYSTEM.md`.

---

## 5. Alur Kerja per Tugas

1. **Pilih tugas.** Ambil tugas `[ ]` berikutnya di `TASKS.md` pada fase aktif. Ubah ke `[~]`. Jangan melompati fase.
2. **Pahami.** Baca Ref (FR/BR/AC) di `PRD.md`, bagian relevan di `ARCHITECTURE.md`, `DATABASE.md`, `DESIGN_SYSTEM.md`.
3. **Periksa kondisi sekarang.** Cari kode, komponen, dan tes yang sudah ada. Jalankan `pnpm check` dulu untuk mengetahui garis dasar. Jangan menimpa pekerjaan yang ada.
4. **Rencanakan kecil.** Tulis rencana singkat: berkas yang berubah, tabel yang tersentuh, tes yang akan ditambah, risiko regresi.
5. **Tes dahulu bila memungkinkan** (logika domain). Tulis tes dari acceptance criteria.
6. **Implementasikan** dengan perubahan sekecil yang cukup. Satu tugas = satu perubahan yang dapat ditinjau.
7. **Verifikasi** (lihat §6). Perbaiki penyebab, bukan gejala.
8. **Perbarui dokumen:** status di `TASKS.md` + catatan kemajuan; `CHANGELOG.md` bila ada perubahan perilaku, skema, atau keputusan; dokumentasi lain yang terdampak.
9. **Laporkan** dengan format di §10.

---

## 6. Verifikasi dan Definisi "Selesai"

Sebelum menyatakan tugas selesai, **jalankan dan lampirkan hasil**:

| Perintah | Wajib |
| --- | --- |
| `pnpm typecheck` | Ya |
| `pnpm lint` | Ya |
| `pnpm test` | Ya (termasuk tes baru) |
| `pnpm test:e2e` | Bila tugas menyentuh alur pengguna, offline, atau layar |
| `pnpm build` | Bila menyentuh PWA, dependensi, atau konfigurasi build |
| `pnpm db:check` | Bila menyentuh stok, skema, atau migrasi |

Tugas dinyatakan selesai hanya bila:
- [ ] Semua "Selesai bila" di `TASKS.md` terpenuhi dan acceptance criteria terkait lulus.
- [ ] `pnpm check` hijau; tidak ada tes dinonaktifkan/dilewati tanpa persetujuan.
- [ ] Keadaan memuat/kosong/galat/sukses tersedia (bila UI).
- [ ] Izin diperiksa di lapisan service; audit tercatat untuk aksi sensitif.
- [ ] Perubahan stok memiliki movement dan melewati `InventoryService`.
- [ ] Alur offline dan persistensi diuji bila relevan.
- [ ] Tidak ada tombol mati, data palsu, atau angka tanpa definisi.
- [ ] Dokumen dan `CHANGELOG.md` diperbarui.

**Jujur tentang hasil:** bila sebuah tes gagal, tes tidak dapat dijalankan (mis. tidak ada perangkat), atau sebagian pekerjaan belum selesai, **katakan apa adanya**. Dilarang menulis "berhasil/teruji" untuk sesuatu yang tidak dijalankan. Bagian yang hanya dapat diuji di perangkat nyata (scanner, printer) dinyatakan "belum teruji di perangkat".

---

## 7. Tindakan yang Membutuhkan Persetujuan Eksplisit

**Berhenti dan minta persetujuan tertulis** sebelum:

| Tindakan | Alasan |
| --- | --- |
| Menghapus file/folder yang bukan buatan Anda pada tugas ini | Risiko kehilangan pekerjaan |
| Migrasi skema destruktif (hapus tabel/kolom, ubah makna data), reset database, atau menghapus data | Kehilangan data |
| Mengubah aturan bisnis di `PRD.md` atau invarian di `DATABASE.md` | Mengubah kebutuhan |
| Menambah/mengganti/menghapus dependensi utama (UI, state, database, build) | Dampak jangka panjang |
| Mengubah token desain atau varian komponen yang sudah dibekukan | Konsistensi UI |
| Menonaktifkan, melonggarkan, atau menghapus tes/lint/aturan lapisan | Integritas kualitas |
| Menambah panggilan jaringan keluar, telemetri, atau layanan pihak ketiga | Privasi dan offline |
| Mengaktifkan fitur di luar MVP (sinkronisasi, multi-device, kasbon, dsb.) | Memerlukan keputusan produk |
| Operasi git destruktif (force push, reset keras, menimpa riwayat) | Kehilangan riwayat |

Jika tidak bisa meminta persetujuan saat itu, **jangan lakukan**; pilih jalur non-destruktif (mis. tambahkan, jangan hapus; tandai usang, jangan buang) dan catat sebagai pertanyaan terbuka.

---

## 8. Yang Harus Dihindari (anti-pola)

| Anti-pola | Mengapa berbahaya | Lakukan ini |
| --- | --- | --- |
| Mengurangi stok dari komponen UI atau repository langsung | Melewati ledger dan validasi | Panggil service → `InventoryService` |
| Menyimpan total/kembalian hanya di state UI | Salah jika UI gagal | Hitung di domain, simpan dalam transaksi |
| `try { … } catch {}` yang menelan galat | Transaksi gagal tampak sukses | Tangani dan tampilkan galat; jangan menelan |
| "Optimistic UI" untuk pembayaran | Menampilkan sukses sebelum tersimpan | Tampilkan sukses setelah commit |
| Menambah kolom saldo baru tanpa movement | Saldo tidak dapat diaudit | Turunkan dari ledger |
| `Math.round` pada uang pecahan | Pembulatan tidak konsisten | `domain/money` (setengah ke atas) |
| `localStorage` untuk keranjang/transaksi | Hilang/tidak atomik | Zustand + `held_carts` + Dexie |
| Menyembunyikan tombol sebagai satu-satunya izin | Mudah dilewati | `authorize()` di service |
| Menyalin warna/ukuran dari screenshot ke komponen | Tidak konsisten | Pakai token |
| Menambah komponen mirip yang sudah ada | Duplikasi | Perluas/komposisikan yang ada |
| Menghapus tes yang gagal | Menyembunyikan bug | Perbaiki penyebab |
| Perbaikan besar "sekalian" di luar tugas | Regresi tak terduga | Catat sebagai tugas baru |
| Memuat font/skrip dari CDN | Gagal offline | Kemas lokal |
| Mengisi data contoh agar dashboard "terlihat bagus" | Data palsu di produksi | Keadaan kosong yang jelas |

---

## 9. Kapan Berhenti dan Bertanya

Berhenti dan ajukan pertanyaan (tulis di `TASKS.md` → Pertanyaan Terbuka, dan sampaikan ke pemilik) bila:

- PRD ambigu atau bertentangan dengan dokumen lain, atau tugas membutuhkan keputusan produk baru.
- Acceptance criteria tidak dapat dipenuhi bersamaan (mis. dua aturan saling bertentangan).
- Perubahan akan menyentuh data yang sudah ada atau perilaku yang sudah berjalan secara tak terduga.
- Tes yang ada gagal sebelum Anda mengubah apa pun (kemungkinan masalah sebelumnya; laporkan, jangan sembunyikan).
- Anda ingin menyimpang dari arsitektur atau desain sistem.
- Anda perlu perangkat/akses yang tidak tersedia (mis. printer thermal) untuk membuktikan syarat selesai.

Saat bertanya: jelaskan konteks, opsi yang Anda lihat, dampak tiap opsi, dan **rekomendasi** Anda; lalu lanjutkan pada bagian tugas yang tidak terblokir, bila ada.

---

## 10. Format Laporan Setelah Setiap Tugas

```
Tugas: T2.04 CheckoutService atomik & idempoten
Status: Selesai | Sebagian | Terblokir

Yang dikerjakan:
- (ringkas, 3–6 poin)

Berkas utama yang berubah:
- src/services/checkout.ts, src/domain/sales/…, tests/…

Bukti verifikasi:
- pnpm typecheck: lulus
- pnpm lint: lulus
- pnpm test: 214 lulus / 0 gagal (tes baru: S-01..S-04, AC-02..AC-05)
- pnpm test:e2e: lulus (alur penjualan offline) | tidak dijalankan karena …
- Belum teruji di perangkat: printer thermal

Dampak ke fitur lain:
- (apa yang disentuh, tes regresi apa yang melindungi)

Dokumen yang diperbarui:
- TASKS.md (T2.04 → [x]), CHANGELOG.md (entri …)

Asumsi / pertanyaan terbuka:
- (jika ada; sudah dicatat di TASKS.md)

Berikutnya:
- T2.05 Layar POS
```

---

## 11. Konvensi Git dan Perubahan

- Satu cabang per tugas (`t2-04-checkout-service`); PR kecil dan terfokus.
- Pesan commit: `T2.04: ringkas perubahan` (bahasa Indonesia atau Inggris, konsisten).
- Jangan mencampur perubahan fitur dengan perapian format besar-besaran.
- Jangan commit rahasia, berkas backup berisi data nyata, atau data pelanggan.
- Setiap PR menyebut: tugas, Ref FR/AC, tes yang ditambah, dampak ke fitur lain, tangkapan layar (bila UI).

---

## 12. Prompt Awal untuk Agent Baru

Salin prompt ini saat memulai sesi agent baru di proyek:

> Anda bekerja pada proyek **SembakoOS**. Baca berurutan: `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DESIGN_SYSTEM.md`, `TASKS.md`, `TESTING.md`, `CHANGELOG.md`. Kerjakan **hanya** tugas aktif berikutnya di `TASKS.md` pada fase yang sedang berjalan. Stack: React + TypeScript (strict) + Tailwind + shadcn/ui, web app/PWA offline-first untuk tablet Android dengan IndexedDB/Dexie. Toko dan gudang adalah **satu inventaris gabungan**; jangan membuat lokasi stok terpisah. Terapkan logika domain terpisah dari UI, checkout atomik dan idempoten, ledger stock movements sebagai satu-satunya jalur perubahan stok, snapshot harga transaksi, otorisasi berbasis peran di lapisan service, audit log, uang integer, dan FEFO bila batch aktif. Jangan membuat tombol palsu atau data dummy sebagai data produksi. Tulis tes untuk setiap aturan kritis dan acceptance criteria terkait. Setelah selesai jalankan `pnpm check` (plus e2e/build bila relevan), perbarui `TASKS.md` dan `CHANGELOG.md`, lalu laporkan dengan format di `AGENTS.md` §10. Jika ada keputusan yang belum jelas, catat sebagai asumsi dan **tanyakan**, jangan mengarang aturan bisnis. Jangan melakukan tindakan destruktif tanpa persetujuan.

**Prompt untuk tugas tunggal:**

> Kerjakan tugas **T{x.xx}** di `TASKS.md`. Ikuti `AGENTS.md` §5. Hanya ubah berkas yang diperlukan, tulis tes dari AC terkait, jalankan verifikasi §6, dan laporkan dengan format §10.

**Prompt untuk peninjauan:**

> Tinjau perubahan terakhir terhadap `AGENTS.md` §3, §4, dan §8, serta `PRD.md` AC terkait. Daftar pelanggaran, risiko regresi, dan tes yang kurang. Jangan mengubah kode; hanya laporkan.

---

## 13. Pengingat Singkat (cheat sheet)

```
BACA PRD dulu  →  tugas kecil  →  tes dulu  →  satu pintu stok  →  transaksi atomik
UANG & STOK = integer   |   izin di SERVICE   |   audit untuk aksi sensitif
TIDAK ADA data palsu / tombol palsu / CDN / localStorage bisnis
TIDAK menghapus / migrasi destruktif tanpa izin
TIDAK menandai selesai sebelum diuji   |   JUJUR soal yang belum teruji
Ragu? BERHENTI dan TANYA (jangan mengarang aturan bisnis)
```
