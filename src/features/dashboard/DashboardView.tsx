import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  ChevronRight,
  Truck,
} from 'lucide-react';
import { formatRupiah } from '@/domain/money';

export const DashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('1H');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Kolom Kiri / Utama (8 Kolom) */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        {/* Kartu Hero: Penjualan Hari Ini + Grafik Area */}
        <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                PENJUALAN HARI INI
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="font-serif font-bold text-3xl sm:text-4xl text-foreground tabular-nums">
                  {formatRupiah(2480000)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-pill bg-success text-success-text">
                  <TrendingUp className="size-3" />
                  <span>+12,4% vs kemarin</span>
                </span>
              </div>
            </div>

            {/* Switcher Rentang Waktu */}
            <div className="inline-flex p-1 bg-muted rounded-pill text-xs font-medium self-start sm:self-auto">
              {['1H', '7H', '30H', 'Bulan Ini'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-pill transition-colors ${
                    activeTab === tab
                      ? 'bg-card text-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart SVG Ilustratif Sesuai Referensi ORBIT */}
          <div className="w-full h-48 relative">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 600 160"
              preserveAspectRatio="none"
              aria-label="Grafik tren penjualan per jam"
            >
              <defs>
                <linearGradient id="orbitGreenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7DB594" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#7DB594" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Garis Grid Horizontal Tipis */}
              <line x1="0" y1="40" x2="600" y2="40" stroke="#E6E1D6" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="#E6E1D6" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="600" y2="120" stroke="#E6E1D6" strokeDasharray="3 3" />

              {/* Area gradasi */}
              <path
                d="M 0,140 Q 60,110 120,120 T 240,90 T 360,70 T 480,45 T 600,20 L 600,160 L 0,160 Z"
                fill="url(#orbitGreenGradient)"
              />

              {/* Garis utama hijau pekat */}
              <path
                d="M 0,140 Q 60,110 120,120 T 240,90 T 360,70 T 480,45 T 600,20"
                fill="none"
                stroke="#14463C"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Titik data terakhir */}
              <circle cx="600" cy="20" r="4" fill="#14463C" />
              <circle cx="600" cy="20" r="8" fill="#14463C" fillOpacity="0.2" />
            </svg>

            {/* Label Waktu Bawah */}
            <div className="flex justify-between text-[11px] text-muted-foreground mt-2 font-medium">
              <span>08:00</span>
              <span>10:00</span>
              <span>12:00</span>
              <span>14:00</span>
              <span>16:00</span>
              <span>18:00</span>
              <span>20:00</span>
            </div>
          </div>
        </div>

        {/* Baris 3 Kartu Metrik */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Kartu 1: Laba Kotor */}
          <div className="bg-card border border-border rounded-card p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span className="uppercase tracking-wider">Est. Laba Kotor</span>
              <ChevronRight className="size-4" />
            </div>
            <div className="mt-3">
              <div className="font-serif font-bold text-2xl text-foreground tabular-nums">
                {formatRupiah(620000)}
              </div>
              <div className="flex items-center gap-1 text-xs text-success-text font-medium mt-1">
                <span>+8,3% margin rata-rata</span>
              </div>
            </div>
          </div>

          {/* Kartu 2: Transaksi Kasir */}
          <div className="bg-card border border-border rounded-card p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span className="uppercase tracking-wider">Jumlah Transaksi</span>
              <ChevronRight className="size-4" />
            </div>
            <div className="mt-3">
              <div className="font-serif font-bold text-2xl text-foreground tabular-nums">
                42 struk
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-1">
                <span>Rata-rata {formatRupiah(59000)}/struk</span>
              </div>
            </div>
          </div>

          {/* Kartu 3: Stok Menipis */}
          <div className="bg-card border border-border rounded-card p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
              <span className="uppercase tracking-wider">Stok Menipis</span>
              <ChevronRight className="size-4" />
            </div>
            <div className="mt-3">
              <div className="font-serif font-bold text-2xl text-destructive-text tabular-nums">
                4 produk
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-1">
                <span>Di bawah ambang minimum</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel: Perlu Perhatian (Stok Menipis & Batch) */}
        <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif font-semibold text-lg text-foreground">
                Perlu Perhatian
              </h2>
              <p className="text-xs text-muted-foreground">
                Produk dengan stok kritis atau mendekati batas kedaluwarsa.
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1"
            >
              <span>Lihat semua produk</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3 font-semibold">Produk</th>
                  <th className="pb-3 font-semibold">Kategori</th>
                  <th className="pb-3 font-semibold text-right">Stok Fisik</th>
                  <th className="pb-3 font-semibold text-center">Status</th>
                  <th className="pb-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-accent/40 transition-colors">
                  <td className="py-3.5 font-medium text-foreground">
                    Beras Rojo Lele 5 kg
                  </td>
                  <td className="py-3.5 text-xs text-muted-foreground">Beras & Biji</td>
                  <td className="py-3.5 text-right font-semibold text-foreground tabular-nums">
                    3 sak
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-medium bg-warning text-warning-text">
                      <AlertTriangle className="size-3" />
                      <span>Menipis</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      type="button"
                      className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold rounded-pill hover:bg-accent transition-colors"
                    >
                      Pesan
                    </button>
                  </td>
                </tr>

                <tr className="hover:bg-accent/40 transition-colors">
                  <td className="py-3.5 font-medium text-foreground">
                    Minyak Goreng Sovia 2 L
                  </td>
                  <td className="py-3.5 text-xs text-muted-foreground">Minyak</td>
                  <td className="py-3.5 text-right font-semibold text-destructive-text tabular-nums">
                    0 pouch
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-medium bg-destructive text-destructive-text">
                      <AlertTriangle className="size-3" />
                      <span>Habis</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      type="button"
                      className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold rounded-pill hover:bg-accent transition-colors"
                    >
                      Pesan
                    </button>
                  </td>
                </tr>

                <tr className="hover:bg-accent/40 transition-colors">
                  <td className="py-3.5 font-medium text-foreground">
                    Gula Pasir Gulaku 1 kg
                  </td>
                  <td className="py-3.5 text-xs text-muted-foreground">Gula & Pemanis</td>
                  <td className="py-3.5 text-right font-semibold text-foreground tabular-nums">
                    8 bungkus
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-medium bg-warning text-warning-text">
                      <AlertTriangle className="size-3" />
                      <span>Menipis</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      type="button"
                      className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold rounded-pill hover:bg-accent transition-colors"
                    >
                      Pesan
                    </button>
                  </td>
                </tr>

                <tr className="hover:bg-accent/40 transition-colors">
                  <td className="py-3.5 font-medium text-foreground">
                    Telur Ayam Negeri
                  </td>
                  <td className="py-3.5 text-xs text-muted-foreground">Telur & Segar</td>
                  <td className="py-3.5 text-right font-semibold text-foreground tabular-nums">
                    35 kg
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-medium bg-success text-success-text">
                      <CheckCircle2 className="size-3" />
                      <span>Aman</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      type="button"
                      className="px-3 py-1 bg-muted text-muted-foreground text-xs font-semibold rounded-pill hover:bg-accent transition-colors"
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Kolom Kanan (4 Kolom): Donut Persediaan & Aktivitas Terbaru */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {/* Kartu: Komposisi Nilai Persediaan (Donut Chart) */}
        <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-semibold text-lg text-foreground">
              Nilai Persediaan
            </h2>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>

          {/* SVG Donut Chart Sesuai Referensi ORBIT */}
          <div className="relative flex items-center justify-center size-44 mx-auto my-2">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              {/* Segmen 1: Beras 42% */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#14463C"
                strokeWidth="14"
                strokeDasharray="100 140"
                strokeDashoffset="0"
              />
              {/* Segmen 2: Minyak 26% */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#7DB594"
                strokeWidth="14"
                strokeDasharray="62 178"
                strokeDashoffset="-100"
              />
              {/* Segmen 3: Gula 16% */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#F4B091"
                strokeWidth="14"
                strokeDasharray="38 202"
                strokeDashoffset="-162"
              />
              {/* Segmen 4: Lainnya 16% */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#D6D3C8"
                strokeWidth="14"
                strokeDasharray="38 202"
                strokeDashoffset="-200"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-serif font-bold text-xl text-foreground">
                Rp 48,5 Jt
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Total Stok
              </span>
            </div>
          </div>

          {/* Legenda Kategori */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#14463C]" />
                <span className="text-foreground font-medium">Beras & Sembako Pokok</span>
              </div>
              <span className="font-semibold text-muted-foreground">42,3%</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#7DB594]" />
                <span className="text-foreground font-medium">Minyak & Margarin</span>
              </div>
              <span className="font-semibold text-muted-foreground">26,1%</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#F4B091]" />
                <span className="text-foreground font-medium">Gula & Pemanis</span>
              </div>
              <span className="font-semibold text-muted-foreground">15,8%</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#D6D3C8]" />
                <span className="text-foreground font-medium">Bumbu & Lainnya</span>
              </div>
              <span className="font-semibold text-muted-foreground">15,8%</span>
            </div>
          </div>
        </div>

        {/* Kartu: Aktivitas Terbaru */}
        <div className="bg-card border border-border rounded-card p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-semibold text-lg text-foreground">
              Aktivitas Terbaru
            </h2>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Lihat semua
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Item 1: Penjualan Kasir */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-secondary flex items-center justify-center text-primary">
                  <ArrowDownLeft className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    Penjualan #TRX-1042
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Kasir Siti: 10:24 WIB
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-semibold text-success-text">
                  +Rp 125.000
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  3 item (Tunai)
                </span>
              </div>
            </div>

            {/* Item 2: Penerimaan Barang */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted flex items-center justify-center text-foreground">
                  <Truck className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    Penerimaan Barang
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    PT Sumber Pangan: 09:15 WIB
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-semibold text-foreground">
                  +50 sak beras
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  Faktur #SJ-998
                </span>
              </div>
            </div>

            {/* Item 3: Penjualan Kasir */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-secondary flex items-center justify-center text-primary">
                  <ArrowDownLeft className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    Penjualan #TRX-1041
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Kasir Budi: 08:48 WIB
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-semibold text-success-text">
                  +Rp 48.000
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  1 item (Tunai)
                </span>
              </div>
            </div>

            {/* Item 4: Penyesuaian Stok */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-destructive/15 flex items-center justify-center text-destructive-text">
                  <ArrowUpRight className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    Penyesuaian Rusak
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Gula Pasir kemasan bocor: 08:10 WIB
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-semibold text-destructive-text">
                  -2 bungkus
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  Koreksi stok
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
