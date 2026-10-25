/**
 * Domain Money — Operasi Keuangan SembakoOS
 * 
 * Aturan (AGENTS.md §4.1, DATABASE.md §1.1):
 * - Uang adalah INTEGER Rupiah bulat.
 * - Dilarang menggunakan float/desimal untuk nominal uang.
 * - Pembagian dan persen menggunakan pembulatan half-up atau metode sisa terbesar (split).
 */

export type Money = number; // Integer Rupiah

/**
 * Memastikan nilai adalah integer Rupiah yang valid.
 */
export function assertMoney(value: number): Money {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Nilai uang harus berupa integer aman, diterima: ${value}`);
  }
  return value;
}

/**
 * Menjumlahkan beberapa nominal uang.
 */
export function addMoney(...amounts: Money[]): Money {
  let total = 0;
  for (const amt of amounts) {
    total += assertMoney(amt);
  }
  return total;
}

/**
 * Mengurangkan nominal uang (a - b).
 */
export function subtractMoney(a: Money, b: Money): Money {
  return assertMoney(a) - assertMoney(b);
}

/**
 * Menghitung diskon atau persentase dengan basis points (1% = 100 bps).
 * Contoh: 10% = 1000 bps.
 * Menggunakan pembulatan half-up: Math.floor((value + divisor/2) / divisor)
 */
export function percentageBps(amount: Money, bps: number): Money {
  assertMoney(amount);
  if (!Number.isInteger(bps) || bps < 0) {
    throw new TypeError(`BPS harus integer positif, diterima: ${bps}`);
  }
  // Formula half-up: floor((amount * bps + 5000) / 10000)
  const product = amount * bps;
  return Math.floor((product + 5000) / 10000);
}

/**
 * Membagi total uang ke dalam rasio atau bagian secara proporsional.
 * Menggunakan metode Hare-Niemeyer / Largest Remainder.
 * Menjamin total hasil pembagian PERSIS SAMA dengan total input (selisih nol).
 */
export function splitMoney(total: Money, ratios: number[]): Money[] {
  assertMoney(total);
  if (ratios.length === 0) return [];
  const sumRatio = ratios.reduce((acc, r) => acc + r, 0);
  if (sumRatio <= 0) {
    throw new Error('Total rasio harus lebih besar dari 0');
  }

  const exactShares = ratios.map((r) => (total * r) / sumRatio);
  const baseShares = exactShares.map((s) => Math.floor(s));
  const remainders = exactShares.map((s, idx) => ({
    index: idx,
    remainder: s - Math.floor(s),
  }));

  const currentSum = baseShares.reduce((acc, s) => acc + s, 0);
  let difference = total - currentSum;

  // Urutkan sisa desimal terbesar ke terkecil
  remainders.sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < difference; i++) {
    const targetIdx = remainders[i % remainders.length]!.index;
    baseShares[targetIdx]! += 1;
  }

  return baseShares;
}

/**
 * Format tampilan ke mata uang Rupiah Indonesia (Intl id-ID).
 * Contoh: 12500 -> "Rp 12.500"
 */
export function formatRupiah(amount: Money): string {
  assertMoney(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount);
  return `Rp ${formatted}`;
}

/**
 * Parse string nominal (mis. "Rp 12.500" atau "12500") menjadi integer Rupiah.
 */
export function parseRupiah(input: string): Money {
  const clean = input.replace(/[^\d-]/g, '');
  if (!clean) return 0;
  const parsed = parseInt(clean, 10);
  if (isNaN(parsed)) return 0;
  return assertMoney(parsed);
}

/**
 * Format ringkas untuk grafik atau badge ruang sempit (misal Donut Chart).
 * Contoh: 38935000 -> "Rp 38,9 Jt", 1250000000 -> "Rp 1,3 M", 250000 -> "Rp 250 Rb"
 */
export function formatRupiahCompact(amount: Money): string {
  assertMoney(amount);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(1).replace('.', ',');
    return `${sign}Rp ${val.endsWith(',0') ? val.slice(0, -2) : val} M`;
  }
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1).replace('.', ',');
    return `${sign}Rp ${val.endsWith(',0') ? val.slice(0, -2) : val} Jt`;
  }
  if (abs >= 100_000) {
    const val = (abs / 1_000).toFixed(0);
    return `${sign}Rp ${val} Rb`;
  }
  return formatRupiah(amount);
}

