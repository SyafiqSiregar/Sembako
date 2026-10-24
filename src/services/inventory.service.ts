import {
  SembakoDatabase,
  type StockMovement,
  type StockMovementItem,
} from '@/data/db';
import { assertQuantity } from '@/domain/quantity';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export type MovementType =
  | 'RECEIPT'
  | 'SALE'
  | 'SALE_VOID'
  | 'CUSTOMER_RETURN'
  | 'DAMAGE_SPOILAGE'
  | 'INTERNAL_USE'
  | 'COUNT_ADJUSTMENT'
  | 'INITIAL_BALANCE'
  | 'STOCKTAKE_ADJUSTMENT'
  | 'REVERSAL';

export interface MovementItemInput {
  productId: string;
  batchId?: string;
  qtyDeltaBase: number; // Positif = masuk, Negatif = keluar
  unitCostX10k: number;
}

export interface RecordMovementParams {
  type: MovementType;
  refType?: string;
  refId?: string;
  userId: string;
  reason?: string;
  items: MovementItemInput[];
  allowNegativeStock?: boolean;
}

export class InventoryService {
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Satu pintu untuk SEMUA mutasi stok di SembakoOS (AGENTS.md §4.2, DATABASE.md §6).
   * Menghasilkan record immutable di stock_movements & stock_movement_items,
   * dan memperbarui inventory_balances dalam transaksi database yang sama.
   */
  async recordMovement(params: RecordMovementParams): Promise<StockMovement> {
    if (!params.items || params.items.length === 0) {
      throw new Error('Mutasi stok harus memiliki minimal satu item');
    }

    const now = this.clock.now();
    const movementId = this.idGen.generateId();

    const movementHeader: StockMovement = {
      id: movementId,
      type: params.type,
      occurred_at: now,
      ref_type: params.refType,
      ref_id: params.refId,
      user_id: params.userId,
      reason: params.reason,
    };

    const movementItems: StockMovementItem[] = [];

    // Baca dan ubah saldo di dalam transaksi Dexie yang sama (AP-04)
    await this.db.transaction(
      'rw',
      [
        this.db.products,
        this.db.inventory_balances,
        this.db.stock_movements,
        this.db.stock_movement_items,
      ],
      async () => {
        for (const item of params.items) {
          const delta = assertQuantity(item.qtyDeltaBase);
          if (delta === 0) {
            throw new Error(`Delta kuantitas tidak boleh 0 pada produk '${item.productId}'`);
          }

          const batchIdKey = item.batchId || '';

          // 1. Ambil saldo saat ini
          const currentBalanceRecord = await this.db.inventory_balances.get([
            item.productId,
            batchIdKey,
          ]);

          const currentStock = currentBalanceRecord ? currentBalanceRecord.qty_base : 0;
          const newStock = currentStock + delta;

          // 2. Cegah stok negatif jika kebijakan melarang (BR-10, AC-18)
          if (newStock < 0 && !params.allowNegativeStock) {
            const product = await this.db.products.get(item.productId);
            const prodName = product ? product.name : item.productId;
            throw new Error(
              `Stok tidak mencukupi untuk produk '${prodName}'. Stok tersedia: ${currentStock}, diminta: ${Math.abs(
                delta
              )}`
            );
          }

          // 3. Simpan item mutasi
          movementItems.push({
            id: this.idGen.generateId(),
            movement_id: movementId,
            product_id: item.productId,
            batch_id: item.batchId,
            qty_delta_base: delta,
            unit_cost_x10k: item.unitCostX10k,
            occurred_at: now,
          });

          // 4. Update saldo inventaris
          await this.db.inventory_balances.put({
            product_id: item.productId,
            batch_id: batchIdKey,
            qty_base: newStock,
            last_movement_at: now,
          });
        }

        // Simpan header & items mutasi secara permanen (append-only)
        await this.db.stock_movements.add(movementHeader);
        await this.db.stock_movement_items.bulkAdd(movementItems);
      }
    );

    return movementHeader;
  }

  /**
   * Mengambil total saldo stok fisik produk dari seluruh batch.
   */
  async getProductStock(productId: string): Promise<number> {
    const balances = await this.db.inventory_balances.where('product_id').equals(productId).toArray();
    return balances.reduce((sum, b) => sum + b.qty_base, 0);
  }

  /**
   * Rekonsiliasi ledger vs saldo (Invarian INV-01, AC-24).
   * Membuktikan bahwa saldo fisik = jumlah seluruh delta movement.
   */
  async reconcileStockLedger(productId: string): Promise<{
    ledgerTotal: number;
    currentBalance: number;
    isConsistent: boolean;
  }> {
    const movementItems = await this.db.stock_movement_items
      .where('product_id')
      .equals(productId)
      .toArray();

    const ledgerTotal = movementItems.reduce((sum, m) => sum + m.qty_delta_base, 0);
    const currentBalance = await this.getProductStock(productId);

    return {
      ledgerTotal,
      currentBalance,
      isConsistent: ledgerTotal === currentBalance,
    };
  }
}
