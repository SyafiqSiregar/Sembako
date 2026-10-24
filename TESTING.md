# TESTING — SembakoOS

Panduan strategi pengujian, piramida tes, dan acceptance criteria test suite untuk SembakoOS.

| Atribut | Nilai |
| --- | --- |
| Versi dokumen | 1.0 |
| Tanggal | 24 Oktober 2026 |
| Mengacu ke | `PRD.md` v1.1 (§11 AC-01 s.d. AC-42), `AGENTS.md` §6 |

---

## 1. Piramida dan Prioritas Pengujian

```
         /  E2E (Playwright)  \        <- Alur kasir, offline, backup/restore
        /  Integrasi (Dexie)   \       <- Service checkout, inventory ledger, audit
       /  Unit & Property-based \      <- Domain money, quantity, FEFO, pricing, time
```

1. **Uang dan Stok tidak boleh salah (P0)**:
   - Pengujian `domain/money` menggunakan `fast-check` untuk membuktikan tidak ada selisih sen, pembagian proporsional selalu tepat menyerap total.
   - Pengujian `InventoryService` membuktikan `saldo = sum(movements)` untuk setiap skenario.
2. **Transaksi Atomik (P0)**:
   - Pengujian rollback di `fake-indexeddb`: jika item gagal atau stok habis di tengah alur, tidak ada row yang tertinggal di `sales`, `stock_movements`, atau `payments`.
3. **Ketahanan Offline (P0)**:
   - Service worker meng-cache 100% app shell; alur jual beli berfungsi saat simulasi offline.

---

## 2. Pemetaan Acceptance Criteria (AC) ke Test Suite

| Kategori | Ref AC | File Pengujian Utama | Jenis Pengujian |
| --- | --- | --- | --- |
| Kasir & POS | AC-01 s.d. AC-06 | `tests/integration/services/checkout.test.ts`, `tests/unit/domain/pricing.test.ts` | Integrasi & Unit |
| Void & Retur | AC-07, AC-08 | `tests/integration/services/void-return.test.ts` | Integrasi |
| Diskon & Izin | AC-09, AC-10, AC-13 | `tests/unit/domain/permissions.test.ts` | Unit |
| Sesi Kas | AC-11, AC-12 | `tests/integration/services/session.test.ts` | Integrasi |
| Katalog & Barcode | AC-14 s.d. AC-17 | `tests/integration/catalog/product.test.ts` | Integrasi |
| Inventaris & Ledger | AC-18 s.d. AC-22 | `tests/integration/inventory/inventory.test.ts` | Integrasi & Invariant |
| Expiry & FEFO | AC-23 s.d. AC-25 | `tests/unit/domain/fefo.test.ts`, `tests/integration/expiry/expiry.test.ts` | Unit & Integrasi |
| Laporan & Laba | AC-26 s.d. AC-31 | `tests/unit/reports/profit.test.ts` | Unit |
| Backup & Restore | AC-32, AC-33 | `tests/integration/backup/backup.test.ts` | Integrasi |
| Audit Log | AC-34, AC-35 | `tests/integration/audit/audit.test.ts` | Integrasi |
| Offline & PWA | AC-37 s.d. AC-42 | `tests/e2e/offline.spec.ts` | Playwright E2E |

---

## 3. Perintah Eksekusi Pengujian

| Perintah | Deskripsi | Wajib Lulus |
| --- | --- | --- |
| `pnpm typecheck` | Pengecekan tipe TypeScript strict tanpa error | Ya |
| `pnpm lint` | Pengecekan ESLint tanpa error / warning yang diabaikan | Ya |
| `pnpm test` | Seluruh unit test & integrasi Vitest | Ya |
| `pnpm test:coverage` | Memastikan coverage modul uang & stok 100% | Ya |
| `pnpm check` | Rangkaian gabungan: `typecheck && lint && test` | Ya |

---

## 4. Standar Kode Pengujian

1. **Jelas dan Mandiri**: Setiap test case tidak bergantung pada state test case lain.
2. **Tidak Ada Data Dummy Terselubung**: Fixture pengujian didefinisikan secara eksplisit di `tests/fixtures/`.
3. **Clock & Generator Terkontrol**: Gunakan instance `Clock` dan `IdGenerator` mock untuk pengujian berbasis waktu dan UUID.
