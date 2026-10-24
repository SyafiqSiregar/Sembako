import { SembakoDatabase, type HeldCart } from '@/data/db';
import { type CartLine } from '@/features/pos/posStore';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export interface HoldCartParams {
  userId: string;
  sessionId: string;
  note?: string;
  items: CartLine[];
  discountTotal: number;
}

export class HeldCartService {
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Menyimpan keranjang belanja sementara ke tabel held_carts (FR-POS-09, AC-05)
   */
  async holdCart(params: HoldCartParams): Promise<HeldCart> {
    if (!params.items || params.items.length === 0) {
      throw new Error('Tidak dapat menahan keranjang yang kosong');
    }

    const now = this.clock.now();
    const heldCart: HeldCart = {
      id: this.idGen.generateId(),
      user_id: params.userId,
      session_id: params.sessionId,
      name: params.note?.trim() || `Keranjang ${new Date(now).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
      payload_json: JSON.stringify({
        items: params.items,
        discountTotal: params.discountTotal,
      }),
      created_at: now,
      updated_at: now,
    };

    await this.db.held_carts.add(heldCart);
    return heldCart;
  }

  /**
   * Mengambil semua keranjang tertahan yang aktif
   */
  async getHeldCarts(): Promise<HeldCart[]> {
    return this.db.held_carts.orderBy('updated_at').reverse().toArray();
  }

  /**
   * Menghapus keranjang tertahan setelah dipulihkan atau dibatalkan
   */
  async deleteHeldCart(id: string): Promise<void> {
    await this.db.held_carts.delete(id);
  }
}
