import React, { useEffect, useState } from 'react';
import { X, Clock, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { HeldCartService } from '@/services/held-cart.service';
import { type HeldCart } from '@/data/db';
import { formatRupiah } from '@/domain/money';
import { type CartLine, usePosStore } from './posStore';

interface HeldCartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldCartService: HeldCartService;
  onCartRestored: () => void;
}

export const HeldCartsModal: React.FC<HeldCartsModalProps> = ({
  isOpen,
  onClose,
  heldCartService,
  onCartRestored,
}) => {
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCarts = async () => {
    setLoading(true);
    try {
      const carts = await heldCartService.getHeldCarts();
      setHeldCarts(carts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCarts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (cart: HeldCart) => {
    try {
      const payload = JSON.parse(cart.payload_json) as {
        items: CartLine[];
        discountTotal: number;
      };

      // Set ke pos store
      usePosStore.setState({
        activeSaleId: cart.id, // atau generate baru
        items: payload.items || [],
        discountTotal: payload.discountTotal || 0,
        selectedItemIndex: null,
      });

      // Hapus dari held carts setelah dipulihkan
      await heldCartService.deleteHeldCart(cart.id);
      onCartRestored();
      onClose();
    } catch (e) {
      console.error('Gagal memulihkan keranjang:', e);
    }
  };

  const handleDelete = async (id: string) => {
    await heldCartService.deleteHeldCart(id);
    await loadCarts();
    onCartRestored(); // refresh badge count
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold">Keranjang Tertahan</h2>
              <p className="text-xs text-white/80">{heldCarts.length} transaksi yang sedang diparkir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#FBF8F3] space-y-3">
          {loading ? (
            <div className="text-center py-10 text-stone-500 text-xs">Memuat data keranjang...</div>
          ) : heldCarts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-stone-200 p-6">
              <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-stone-700">Tidak ada keranjang yang ditahan</p>
              <p className="text-xs text-stone-500 mt-1">
                Gunakan tombol "Tahan" di kasir saat pembeli ingin mengambil barang lain.
              </p>
            </div>
          ) : (
            heldCarts.map((cart) => {
              let parsed: { items: CartLine[]; discountTotal: number } = { items: [], discountTotal: 0 };
              try {
                parsed = JSON.parse(cart.payload_json);
              } catch {
                // ignore
              }

              const itemCount = parsed.items.reduce((s, it) => s + it.qty, 0);
              const totalEst = parsed.items.reduce((s, it) => s + Math.max(0, it.qty * it.price - it.discount), 0) - (parsed.discountTotal || 0);

              const timeStr = new Date(cart.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={cart.id}
                  className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center justify-between gap-4 hover:border-emerald-300 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm truncate">{cart.name}</span>
                      <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-mono">
                        {timeStr}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 mt-1 flex items-center gap-2">
                      <span>{itemCount} barang</span>
                      <span>•</span>
                      <span className="font-semibold text-stone-800">{formatRupiah(totalEst)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDelete(cart.id)}
                      className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="Hapus keranjang tertahan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRestore(cart)}
                      className="py-2 px-3 bg-[#14463C] text-white rounded-lg text-xs font-bold hover:bg-[#0F352E] flex items-center gap-1.5 transition shadow-sm"
                    >
                      Pulihkan
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
