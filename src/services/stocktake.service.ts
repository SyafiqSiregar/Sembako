import {
  SembakoDatabase,
  type StocktakeSession,
  type StocktakeItem,
} from '@/data/db';
import { InventoryService } from './inventory.service';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export interface CreateStocktakeParams {
  name: string;
  scopeType: 'all' | 'category' | 'selected';
  scopeRef?: string;
  blind?: boolean;
  createdBy: string;
}

export interface StocktakeReviewItem {
  item: StocktakeItem;
  productName: string;
  sku?: string;
  baseUnitCode: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  unitCostX10k: number;
  varianceValueRupiah: number;
}

export class StocktakeService {
  constructor(
    private db: SembakoDatabase,
    private inventoryService: InventoryService,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Membuka Sesi Stok Opname Baru (T3.06, FR-INV-03, BR-19, AC-21).
   * Mengambil snapshot stok sistem saat sesi dimulai.
   */
  async createSession(params: CreateStocktakeParams): Promise<StocktakeSession> {
    const name = params.name.trim();
    if (!name) throw new Error('Nama sesi stok opname tidak boleh kosong');

    const sessionId = this.idGen.generateId();
    const now = this.clock.now();

    // 1. Ambil produk sesuai scope
    let prods = await this.db.products.where('active').equals(1).toArray();
    if (params.scopeType === 'category' && params.scopeRef) {
      prods = prods.filter((p) => p.category_id === params.scopeRef);
    }

    if (prods.length === 0) {
      throw new Error('Tidak ada produk aktif dalam cakupan stok opname yang dipilih');
    }

    // 2. Snapshot stok sistem per produk
    const stocktakeItems: StocktakeItem[] = [];
    for (const p of prods) {
      const stock = await this.inventoryService.getProductStock(p.id);
      stocktakeItems.push({
        id: this.idGen.generateId(),
        session_id: sessionId,
        product_id: p.id,
        system_qty_snapshot: stock,
        counted_qty: undefined,
        variance: undefined,
      });
    }

    const session: StocktakeSession = {
      id: sessionId,
      name,
      scope_type: params.scopeType,
      scope_ref: params.scopeRef,
      status: 'counting',
      blind: params.blind ? 1 : 0,
      created_at: now,
      created_by: params.createdBy,
      updated_at: now,
      updated_by: params.createdBy,
      row_version: 1,
    };

    await this.db.transaction('rw', [this.db.stocktake_sessions, this.db.stocktake_items], async () => {
      await this.db.stocktake_sessions.add(session);
      await this.db.stocktake_items.bulkAdd(stocktakeItems);
    });

    return session;
  }

  /**
   * Mencatat hasil hitung fisik untuk satu produk (FR-INV-03).
   */
  async recordCount(params: {
    sessionId: string;
    productId: string;
    countedQty: number;
    countedBy: string;
  }): Promise<StocktakeItem> {
    const session = await this.db.stocktake_sessions.get(params.sessionId);
    if (!session || (session.status !== 'counting' && session.status !== 'review')) {
      throw new Error('Sesi stok opname tidak sedang aktif / terbuka untuk penghitungan');
    }

    const item = await this.db.stocktake_items
      .where('[session_id+product_id]')
      .equals([params.sessionId, params.productId])
      .first();

    if (!item) {
      throw new Error('Produk tidak terdaftar dalam sesi opname ini');
    }

    const now = this.clock.now();
    const systemQty = item.system_qty_snapshot || 0;
    const variance = params.countedQty - systemQty;

    await this.db.stocktake_items.update(item.id, {
      counted_qty: params.countedQty,
      counted_at: now,
      counted_by: params.countedBy,
      variance,
    });

    return (await this.db.stocktake_items.get(item.id))!;
  }

  /**
   * Menampilkan review rekonsiliasi stok opname (T3.07, FR-INV-04, AC-22).
   */
  async getSessionReview(sessionId: string): Promise<{
    session: StocktakeSession;
    items: StocktakeReviewItem[];
    totalVarianceQty: number;
    totalVarianceRupiah: number;
    itemsCounted: number;
    totalItems: number;
  }> {
    const session = await this.db.stocktake_sessions.get(sessionId);
    if (!session) throw new Error('Sesi stok opname tidak ditemukan');

    const items = await this.db.stocktake_items.where('session_id').equals(sessionId).toArray();
    const reviewItems: StocktakeReviewItem[] = [];

    let totalVarianceQty = 0;
    let totalVarianceRupiah = 0;
    let itemsCounted = 0;

    for (const item of items) {
      const prod = await this.db.products.get(item.product_id);
      const baseUnit = await this.db.product_units.where('product_id').equals(item.product_id).first();
      const factor = baseUnit?.conversion_factor && baseUnit.conversion_factor > 0 ? baseUnit.conversion_factor : 1;
      const unitCostX10k = baseUnit?.cost_x10k || 0;

      const systemQty = item.system_qty_snapshot ?? 0;
      const isCounted = item.counted_qty !== undefined;
      if (isCounted) itemsCounted++;

      const countedQty = item.counted_qty ?? systemQty;
      const variance = isCounted ? countedQty - systemQty : 0;
      const varianceValueRupiah = factor > 0 ? Math.floor((variance * (unitCostX10k / 10000)) / factor) : 0;

      totalVarianceQty += variance;
      totalVarianceRupiah += varianceValueRupiah;

      reviewItems.push({
        item,
        productName: prod?.name || item.product_id,
        sku: prod?.sku,
        baseUnitCode: prod?.base_unit_code || 'pcs',
        systemQty,
        countedQty,
        variance,
        unitCostX10k,
        varianceValueRupiah,
      });
    }

    return {
      session,
      items: reviewItems,
      totalVarianceQty,
      totalVarianceRupiah,
      itemsCounted,
      totalItems: items.length,
    };
  }

  /**
   * Posting Hasil Stok Opname secara Atomik (T3.08, FR-INV-05, BR-20, AC-22).
   * Menghasilkan pergerakan penyesuaian otomatis untuk produk yang berselisih dan mengunci sesi.
   */
  async postSession(params: { sessionId: string; postedBy: string }): Promise<StocktakeSession> {
    const review = await this.getSessionReview(params.sessionId);
    if (review.session.status === 'posted') {
      throw new Error('Sesi stok opname sudah pernah diposting');
    }

    const itemsToAdjust = review.items.filter((it) => it.item.counted_qty !== undefined && it.variance !== 0);
    const now = this.clock.now();

    await this.db.transaction(
      'rw',
      [
        this.db.stocktake_sessions,
        this.db.stocktake_items,
        this.db.inventory_balances,
        this.db.stock_movements,
        this.db.stock_movement_items,
        this.db.products,
        this.db.audit_logs,
      ],
      async () => {
        // 1. Buat movement koreksi jika ada selisih
        if (itemsToAdjust.length > 0) {
          await this.inventoryService.recordMovement({
            type: 'STOCKTAKE_ADJUSTMENT',
            refType: 'stocktake',
            refId: params.sessionId,
            userId: params.postedBy,
            reason: `Penyesuaian hasil stok opname: ${review.session.name}`,
            items: itemsToAdjust.map((it) => ({
              productId: it.item.product_id,
              qtyDeltaBase: it.variance,
              unitCostX10k: it.unitCostX10k,
            })),
          });
        }

        // 2. Kunci sesi opname
        await this.db.stocktake_sessions.update(params.sessionId, {
          status: 'posted',
          posted_at: now,
          updated_at: now,
          updated_by: params.postedBy,
        });

        // 3. Audit log
        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: params.postedBy,
          device_id: 'local_device',
          action: 'stocktake.post',
          entity_type: 'stocktake_session',
          entity_id: params.sessionId,
          reason: `Posting stok opname ${review.session.name} (${itemsToAdjust.length} produk disesuaikan)`,
        });
      }
    );

    return (await this.db.stocktake_sessions.get(params.sessionId))!;
  }
}
