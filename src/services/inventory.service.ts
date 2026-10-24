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
   * Mengambil Kartu Stok (Stock Card) kronologis per produk (FR-INV-07, AC-18).
   * Menampilkan kronologi mutasi: waktu, jenis, referensi, masuk, keluar, dan saldo berjalan.
   */
  async getStockCard(productId: string): Promise<StockCardEntry[]> {
    const movementItems = await this.db.stock_movement_items
      .where('product_id')
      .equals(productId)
      .toArray();

    // Urutkan kronologis berdasarkan occurred_at
    movementItems.sort((a, b) => a.occurred_at - b.occurred_at);

    // Ambil header movements & users
    const movementIds = Array.from(new Set(movementItems.map((mi) => mi.movement_id)));
    const movements = movementIds.length > 0
      ? await this.db.stock_movements.where('id').anyOf(movementIds).toArray()
      : [];
    const movementMap = new Map(movements.map((m) => [m.id, m]));

    const userIds = Array.from(new Set(movements.map((m) => m.user_id)));
    const users = userIds.length > 0
      ? await this.db.users.where('id').anyOf(userIds).toArray()
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    let runningBalance = 0;
    const entries: StockCardEntry[] = [];

    for (const item of movementItems) {
      const header = movementMap.get(item.movement_id);
      const userName = header ? userMap.get(header.user_id) || header.user_id : 'System';

      const delta = item.qty_delta_base;
      const qtyIn = delta > 0 ? delta : 0;
      const qtyOut = delta < 0 ? Math.abs(delta) : 0;
      runningBalance += delta;

      entries.push({
        movementId: item.movement_id,
        type: header?.type || 'COUNT_ADJUSTMENT',
        occurredAt: item.occurred_at,
        refType: header?.ref_type,
        refId: header?.ref_id,
        userName,
        reason: header?.reason,
        qtyIn,
        qtyOut,
        runningBalance,
        unitCostX10k: item.unit_cost_x10k,
      });
    }

    return entries;
  }

  /**
   * Penyesuaian Stok Manual (FR-INV-04, BR-18, AC-19).
   * Mengkoreksi stok ke angka fisik baru, mewajibkan alasan, dan menghasilkan movement koreksi.
   */
  async adjustStock(params: AdjustStockParams): Promise<StockMovement> {
    const reason = params.reason?.trim();
    if (!reason) {
      throw new Error('Alasan penyesuaian stok wajib diisi');
    }

    const currentStock = await this.getProductStock(params.productId);
    const delta = params.newQtyBase - currentStock;

    if (delta === 0) {
      throw new Error('Kuantitas fisik baru sama dengan stok saat ini di sistem');
    }

    let movementType: MovementType = 'COUNT_ADJUSTMENT';
    if (params.reasonType === 'DAMAGE_SPOILAGE') {
      movementType = 'DAMAGE_SPOILAGE';
    } else if (params.reasonType === 'INTERNAL_USE') {
      movementType = 'INTERNAL_USE';
    }

    // Ambil unit cost produk
    const product = await this.db.products.get(params.productId);
    if (!product) throw new Error('Produk tidak ditemukan');

    const baseUnit = await this.db.product_units
      .where('product_id')
      .equals(params.productId)
      .first();
    const unitCostX10k = baseUnit?.cost_x10k || 0;

    const movement = await this.recordMovement({
      type: movementType,
      refType: 'adjustment',
      userId: params.userId,
      reason: `[${params.reasonType}] ${reason}`,
      allowNegativeStock: false,
      items: [
        {
          productId: params.productId,
          batchId: params.batchId,
          qtyDeltaBase: delta,
          unitCostX10k,
        },
      ],
    });

    // Audit log penyesuaian stok
    await this.db.audit_logs.add({
      id: this.idGen.generateId(),
      occurred_at: this.clock.now(),
      user_id: params.userId,
      device_id: 'local_device',
      action: 'inventory.adjust',
      entity_type: 'product',
      entity_id: params.productId,
      before_json: JSON.stringify({ stock_base: currentStock }),
      after_json: JSON.stringify({ stock_base: params.newQtyBase, delta }),
      reason,
    });

    return movement;
  }

  /**
   * Mengambil ringkasan saldo inventaris seluruh produk untuk tabel inventaris (FR-INV-03).
   */
  async listProductStockSummaries(categoryId?: string): Promise<ProductStockSummary[]> {
    let prods = await this.db.products.where('active').equals(1).toArray();
    if (categoryId && categoryId !== 'all') {
      prods = prods.filter((p) => p.category_id === categoryId);
    }

    const categories = await this.db.categories.toArray();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const summaries: ProductStockSummary[] = [];

    for (const p of prods) {
      const currentStock = await this.getProductStock(p.id);
      const baseUnit = await this.db.product_units.where('product_id').equals(p.id).first();
      const unitCostX10k = baseUnit?.cost_x10k || 0;
      const estimatedValue = Math.floor((currentStock * (unitCostX10k / 10000)));

      let status: 'safe' | 'low' | 'out_of_stock' = 'safe';
      if (currentStock <= 0) {
        status = 'out_of_stock';
      } else if (currentStock <= p.min_stock_base) {
        status = 'low';
      }

      summaries.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        categoryName: categoryMap.get(p.category_id) || 'Umum',
        baseUnitCode: p.base_unit_code,
        currentStock,
        minStock: p.min_stock_base,
        unitCostX10k,
        estimatedValue,
        status,
      });
    }

    return summaries;
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

export interface StockCardEntry {
  movementId: string;
  type: MovementType;
  occurredAt: number;
  refType?: string;
  refId?: string;
  userName: string;
  reason?: string;
  qtyIn: number;
  qtyOut: number;
  runningBalance: number;
  unitCostX10k: number;
}

export type AdjustmentReasonType =
  | 'DAMAGE_SPOILAGE'
  | 'EXPIRED'
  | 'LOST'
  | 'COUNT_CORRECTION'
  | 'INTERNAL_USE'
  | 'OTHER';

export interface AdjustStockParams {
  productId: string;
  newQtyBase: number;
  reasonType: AdjustmentReasonType;
  reason: string;
  userId: string;
  batchId?: string;
}

export interface ProductStockSummary {
  productId: string;
  sku?: string;
  name: string;
  categoryName: string;
  baseUnitCode: string;
  currentStock: number;
  minStock: number;
  unitCostX10k: number;
  estimatedValue: number;
  status: 'safe' | 'low' | 'out_of_stock';
}

