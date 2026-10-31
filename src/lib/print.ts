/** Batas pengaman: iframe cetak dibuang walau browser tidak mengirim `afterprint` (umum di Android). */
const CLEANUP_TIMEOUT_MS = 60_000;

/**
 * Mencetak satu dokumen HTML utuh lewat iframe tersembunyi.
 *
 * Mengapa iframe: `window.print()` pada halaman aplikasi mencetak seluruh antarmuka
 * (sidebar, tombol, modal). Dokumen terisolasi hanya memuat isi struk/label dengan
 * `@page` miliknya sendiri, sehingga ukuran kertas thermal dihormati.
 *
 * Promise selesai saat dialog cetak dipicu, bukan saat kertas keluar: browser tidak
 * memberi tahu hasil cetak yang sebenarnya.
 */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.title = 'Dokumen cetak';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('Jendela cetak tidak dapat dibuka.'));
        return;
      }
      win.addEventListener('afterprint', cleanup, { once: true });
      window.setTimeout(cleanup, CLEANUP_TIMEOUT_MS);
      try {
        win.focus();
        win.print();
        resolve();
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('Gagal membuka dialog cetak.'));
      }
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}

