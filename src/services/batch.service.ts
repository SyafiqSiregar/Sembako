import { SembakoDatabase, type ProductBatch, type StockMovement } from '@/data/db';
import { InventoryService } from './inventory.service';
import { Clock, defaultClock, IdGenerator, defaultIdGenerator } from '@/domain/time';

export interface ExpiringBatchItem {
  batchId: string;
  batchCode: string;
  productId: string;
  productName: string;
  categoryName?: string;
  unitCode: string;
  currentStock: number;
  unitCostX10k: number;
  valuationRupiah: number;
  expiryDate: string; // YYYY-MM-DD
  daysRemaining: number;
  status: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'SAFE';
}

export interface BatchAllocation {
  batchId: string;
  qtyBase: number;
  expiryDate: string;
}

export class BatchService {
  constructor(
    private db: SembakoDatabase,
    private inventoryService: InventoryService,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Menemukan batch yang ada atau membuat baru saat penerimaan barang (FR-EXP-01).
   */
  async createOrGetBatch(
    productId: string,
    batchCode: string,
    expiryDate: string
  ): Promise<ProductBatch> {
    const trimmedCode = batchCode.trim();
    if (!trimmedCode) {
      throw new Error('Kode batch tidak boleh kosong');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      throw new Error('Format tanggal kedaluwarsa harus YYYY-MM-DD');
    }

    const existing = await this.db.product_batches
      .where({ product_id: productId, batch_code: trimmedCode })
      .first();

    if (existing) {
      return existing;
    }

    const newBatch: ProductBatch = {
      id: this.idGen.generateId(),
      product_id: productId,
      batch_code: trimmedCode,
      expiry_date: expiryDate,
      active: 1,
      created_at: this.clock.now(),
    };

    await this.db.product_batches.add(newBatch);
    return newBatch;
  }

  /**
   * Mengalokasikan stok penjualan menggunakan algoritma FEFO (First-Expired First-Out) (FR-EXP-03, AC-24).
   * Memblokir batch yang sudah kedaluwarsa dari transaksi penjualan normal (FR-EXP-04).
   */
  async allocateFefo(
    productId: string,
    requiredQtyBase: number,
    referenceDateStr?: string
  ): Promise<BatchAllocation[]> {
    if (requiredQtyBase <= 0) {
      return [];
    }

    const todayStr = referenceDateStr || this.clock.todayDateString();
    const product = await this.db.products.get(productId);
    const prodName = product ? product.name : productId;

    // Ambil seluruh batch aktif untuk produk ini
    const batches = await this.db.product_batches
      .where('product_id')
      .equals(productId)
      .and((b) => b.active === 1)
      .toArray();

    if (batches.length === 0) {
      // Jika tidak ada batch terdaftar sama sekali pada produk track_expiry, fallback ke balance tanpa batch
      const noBatchBal = await this.db.inventory_balances.get([productId, '']);
      const currentStock = noBatchBal ? noBatchBal.qty_base : 0;
      if (currentStock < requiredQtyBase) {
        throw new Error(
          `Stok tidak mencukupi untuk '${prodName}'. Tersedia: ${currentStock}, diminta: ${requiredQtyBase}`
        );
      }
      return [{ batchId: '', qtyBase: requiredQtyBase, expiryDate: '' }];
    }

    // Ambil saldo masing-masing batch
    const candidateBatchesWithStock = await Promise.all(
      batches.map(async (b) => {
        const bal = await this.db.inventory_balances.get([productId, b.id]);
        return {
          ...b,
          stock: bal ? bal.qty_base : 0,
        };
      })
    );

    // Filter hanya batch yang punya saldo > 0
    const batchesWithStock = candidateBatchesWithStock.filter((b) => b.stock > 0);

    // Cek apakah ada stok yang sudah kedaluwarsa
    const expiredBatches = batchesWithStock.filter((b) => b.expiry_date < todayStr);
    const validBatches = batchesWithStock.filter((b) => b.expiry_date >= todayStr);

    // Urutkan FEFO: expiry_date terdekat lebih dulu (ASC), lalu tanggal dibuat (ASC)
    validBatches.sort((a, b) => {
      const dateCompare = a.expiry_date.localeCompare(b.expiry_date);
      if (dateCompare !== 0) return dateCompare;
      return a.created_at - b.created_at;
    });

    const totalValidStock = validBatches.reduce((acc, b) => acc + b.stock, 0);

    if (totalValidStock < requiredQtyBase) {
      const totalExpiredStock = expiredBatches.reduce((acc, b) => acc + b.stock, 0);
      if (totalExpiredStock > 0 && totalValidStock + totalExpiredStock >= requiredQtyBase) {
        throw new Error(
          `Penjualan diblokir: Produk '${prodName}' memiliki ${totalExpiredStock} unit yang telah kedaluwarsa (FR-EXP-04). Keluarkan batch kedaluwarsa terlebih dahulu.`
        );
      }

      throw new Error(
        `Stok valid tidak mencukupi untuk '${prodName}'. Tersedia layak jual: ${totalValidStock}, diminta: ${requiredQtyBase}`
      );
    }

    // Alokasi greedy FEFO
    let remaining = requiredQtyBase;
    const allocations: BatchAllocation[] = [];

    for (const batch of validBatches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.stock);
      allocations.push({
        batchId: batch.id,
        qtyBase: take,
        expiryDate: batch.expiry_date,
      });
      remaining -= take;
    }

    return allocations;
  }

  /**
   * Mengambil daftar batch hampir kedaluwarsa atau sudah kedaluwarsa (FR-EXP-05, AC-25).
   * Status:
   * - EXPIRED: daysRemaining < 0
   * - CRITICAL: daysRemaining <= 7
   * - WARNING: daysRemaining <= daysAhead (default 30)
   * - SAFE: daysRemaining > daysAhead
   */
  async getExpiringBatches(
    referenceDateStr?: string,
    daysAhead: number = 30
  ): Promise<ExpiringBatchItem[]> {
    const todayStr = referenceDateStr || this.clock.todayDateString();
    const todayMs = new Date(todayStr).getTime();

    const allBatches = await this.db.product_batches
      .filter((b) => b.active === 1)
      .toArray();

    const results: ExpiringBatchItem[] = [];

    // Map produk dan kategori untuk efisiensi
    const products = await this.db.products.toArray();
    const productMap = new Map(products.map((p) => [p.id, p]));

    const categories = await this.db.categories.toArray();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const defaultUnits = await this.db.product_units.toArray();
    const unitMap = new Map(defaultUnits.map((u) => [`${u.product_id}_1`, u]));

    for (const batch of allBatches) {
      const bal = await this.db.inventory_balances.get([batch.product_id, batch.id]);
      const currentStock = bal ? bal.qty_base : 0;

      // Hanya tampilkan batch yang masih ada stok fisik
      if (currentStock <= 0) {
        continue;
      }

      const product = productMap.get(batch.product_id);
      if (!product || product.active === 0) {
        continue;
      }

      const expiryMs = new Date(batch.expiry_date).getTime();
      const diffDays = Math.round((expiryMs - todayMs) / (1000 * 60 * 60 * 24));

      let status: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'SAFE' = 'SAFE';
      if (diffDays < 0) {
        status = 'EXPIRED';
      } else if (diffDays <= 7) {
        status = 'CRITICAL';
      } else if (diffDays <= daysAhead) {
        status = 'WARNING';
      }

      // Hitung nilai estimasi risiko
      const unit = unitMap.get(`${batch.product_id}_1`) || (await this.db.product_units.where({ product_id: batch.product_id, is_base: 1 }).first());
      const costX10k = unit ? unit.cost_x10k : 0;
      const valuationRupiah = Math.round((currentStock * (costX10k / 10000)));

      results.push({
        batchId: batch.id,
        batchCode: batch.batch_code,
        productId: batch.product_id,
        productName: product.name,
        categoryName: categoryMap.get(product.category_id) || 'Umum',
        unitCode: product.base_unit_code,
        currentStock,
        unitCostX10k: costX10k,
        valuationRupiah,
        expiryDate: batch.expiry_date,
        daysRemaining: diffDays,
        status,
      });
    }

    // Urutkan berdasarkan sisa hari terdekat / paling awal kedaluwarsa
    results.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return results;
  }

  /**
   * Menulis-off (penghapusan) batch kedaluwarsa atau rusak (FR-EXP-06).
   * Menghasilkan pergerakan ledger DAMAGE_SPOILAGE dan audit log.
   */
  async writeOffBatch(params: {
    batchId: string;
    productId: string;
    qtyBase: number;
    userId: string;
    reason: string;
  }): Promise<StockMovement> {
    const bal = await this.db.inventory_balances.get([params.productId, params.batchId]);
    const currentStock = bal ? bal.qty_base : 0;

    if (currentStock < params.qtyBase) {
      throw new Error(
        `Kuantitas penghapusan (${params.qtyBase}) melebihi stok batch yang tersedia (${currentStock})`
      );
    }

    const product = await this.db.products.get(params.productId);
    const prodUnit = await this.db.product_units.where({ product_id: params.productId, is_base: 1 }).first();
    const unitCostX10k = prodUnit ? prodUnit.cost_x10k : 0;

    const movement = await this.inventoryService.recordMovement({
      type: 'DAMAGE_SPOILAGE',
      refType: 'batch_write_off',
      refId: params.batchId,
      userId: params.userId,
      reason: params.reason || `Pemusnahan barang kedaluwarsa: ${product?.name}`,
      items: [
        {
          productId: params.productId,
          batchId: params.batchId,
          qtyDeltaBase: -params.qtyBase,
          unitCostX10k,
        },
      ],
    });

    await this.db.audit_logs.add({
      id: this.idGen.generateId(),
      occurred_at: this.clock.now(),
      user_id: params.userId,
      device_id: 'TABLET1',
      action: 'inventory.write_off',
      entity_type: 'product_batches',
      entity_id: params.batchId,
      before_json: JSON.stringify({ stock: currentStock }),
      after_json: JSON.stringify({ stock: currentStock - params.qtyBase }),
      reason: params.reason,
    });

    return movement;
  }
}
