/**
 * Meloloskan karakter khusus HTML. Wajib dipakai untuk setiap teks pengguna
 * (nama barang, alamat toko, catatan) yang disisipkan ke dokumen cetak/ekspor,
 * karena dokumen tersebut dibangun sebagai string HTML.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

