import {
  SembakoDatabase,
  type GoodsReceipt,
  type GoodsReceiptItem,
} from '@/data/db';
import { InventoryService } from './inventory.service';
import { assertMoney } from '@/domain/money';
import { assertQuantity } from '@/domain/quantity';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export interface CreateGoodsReceiptItemInput {
  productId: string;
  productUnitId: string;
  qtyBase: number;
  unitCostX10k: number;
  discount?: number;
  batchCode?: string;
  expiryDate?: string;
}

export interface CreateGoodsReceiptInput {
  supplierId: string;
  supplierRefNo?: string;
  receivedDate: string; // YYYY-MM-DD
  note?: string;
  receivedBy: string;
  items: CreateGoodsReceiptItemInput[];
}

export class GoodsReceiptService {
  constructor(
    private db: SembakoDatabase,
    private inventoryService: InventoryService,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Menerima barang langsung dari pemasok dan memposting ke inventaris secara atomik (FR-SUP-02..05, AC-20).
   * Menghitung weighted average cost dan menambah saldo stok via InventoryService.
   */
  async createAndPostReceipt(input: CreateGoodsReceiptInput): Promise<{
    receipt: GoodsReceipt;
    items: GoodsReceiptItem[];
  }> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Penerimaan barang harus memiliki minimal satu item');
    }

    const supplier = await this.db.suppliers.get(input.supplierId);
    if (!supplier) {
      throw new Error('Pemasok tidak ditemukan');
    }

    const now = this.clock.now();
    const receiptId = this.idGen.generateId();

    // Generate Nomor Penerimaan: GR-YYYYMMDD-NNNN
    const dateStr = input.receivedDate.replace(/-/g, '');
    const counterKey = `receipt_gr_${dateStr}`;
    const counter = await this.db.counters.get(counterKey);
    const nextVal = (counter?.value || 0) + 1;
    await this.db.counters.put({ key: counterKey, value: nextVal });
    const receiptNo = `GR-${dateStr}-${nextVal.toString().padStart(4, '0')}`;

    let totalCost = 0;
    const receiptItems: GoodsReceiptItem[] = [];

    for (const item of input.items) {
      const qtyBase = assertQuantity(item.qtyBase);
      const unitCost = Math.floor(item.unitCostX10k / 10000);
      const discount = assertMoney(item.discount || 0);
      const lineCost = Math.max(0, qtyBase * unitCost - discount);
      totalCost += lineCost;

      receiptItems.push({
        id: this.idGen.generateId(),
        receipt_id: receiptId,
        product_id: item.productId,
        product_unit_id: item.productUnitId,
        qty_base: qtyBase,
        unit_cost_x10k: item.unitCostX10k,
        discount,
        batch_code: item.batchCode,
        expiry_date: item.expiryDate,
      });
    }

    const receiptHeader: GoodsReceipt = {
      id: receiptId,
      receipt_no: receiptNo,
      supplier_id: input.supplierId,
      supplier_ref_no: input.supplierRefNo?.trim(),
      received_date: input.receivedDate,
      status: 'posted',
      total_cost: totalCost,
      note: input.note?.trim(),
      posted_at: now,
      posted_by: input.receivedBy,
      created_at: now,
      created_by: input.receivedBy,
      updated_at: now,
      updated_by: input.receivedBy,
      row_version: 1,
    };

    // Validasi AC-23: Produk dengan track_expiry = 1 mewajibkan kode batch & tanggal kedaluwarsa
    for (const item of input.items) {
      const prod = await this.db.products.get(item.productId);
      if (prod && prod.track_expiry === 1) {
        if (!item.batchCode?.trim() || !item.expiryDate?.trim()) {
          throw new Error(
            `Produk '${prod.name}' memiliki pelacakan kedaluwarsa aktif sehingga wajib mencantumkan kode batch dan tanggal kedaluwarsa (AC-23)`
          );
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate.trim())) {
          throw new Error(`Format tanggal kedaluwarsa pada '${prod.name}' harus YYYY-MM-DD`);
        }
      }
    }

    // Transaksi Atomik Dexie: Simpan GR, Perbarui Moving Average Cost, Tambah Stok via InventoryService
    await this.db.transaction(
      'rw',
      [
        this.db.goods_receipts,
        this.db.goods_receipt_items,
        this.db.inventory_balances,
        this.db.stock_movements,
        this.db.stock_movement_items,
        this.db.products,
        this.db.product_units,
        this.db.product_batches,
        this.db.price_history,
        this.db.audit_logs,
      ],
      async () => {
        // Siapkan batch dan item mutasi
        const movementItems: {
          productId: string;
          batchId?: string;
          qtyDeltaBase: number;
          unitCostX10k: number;
        }[] = [];

        for (const it of input.items) {
          let batchId: string | undefined = undefined;
          if (it.batchCode?.trim() && it.expiryDate?.trim()) {
            const trimmedCode = it.batchCode.trim();
            const trimmedExpiry = it.expiryDate.trim();

            let batch = await this.db.product_batches
              .where({ product_id: it.productId, batch_code: trimmedCode })
              .first();

            if (!batch) {
              batch = {
                id: this.idGen.generateId(),
                product_id: it.productId,
                batch_code: trimmedCode,
                expiry_date: trimmedExpiry,
                active: 1,
                created_at: now,
              };
              await this.db.product_batches.add(batch);
            }
            batchId = batch.id;
          }

          movementItems.push({
            productId: it.productId,
            batchId,
            qtyDeltaBase: it.qtyBase, // Masuk = positif
            unitCostX10k: it.unitCostX10k,
          });
        }

        // 1. Tambah stok via InventoryService (delta positif)
        await this.inventoryService.recordMovement({
          type: 'RECEIPT',
          refType: 'goods_receipt',
          refId: receiptId,
          userId: input.receivedBy,
          reason: `Penerimaan barang #${receiptNo} dari ${supplier.name}${
            input.supplierRefNo ? ` (Faktur: ${input.supplierRefNo})` : ''
          }`,
          items: movementItems,
        });

        // 2. Hitung weighted average cost & update biaya produk (BR-26, FR-SUP-05)
        for (const it of input.items) {
          const unit = await this.db.product_units.get(it.productUnitId);
          if (unit) {
            const currentStock = await this.inventoryService.getProductStock(it.productId);
            // currentStock sudah termasuk penambahan stok di atas
            const oldStock = Math.max(0, currentStock - it.qtyBase);
            const oldCostX10k = unit.cost_x10k;
            const newCostX10k = it.unitCostX10k;

            // Rumus Weighted Average Cost:
            // (oldStock * oldCost + newQty * newCost) / (oldStock + newQty)
            const weightedCostX10k =
              oldStock > 0
                ? Math.floor((oldStock * oldCostX10k + it.qtyBase * newCostX10k) / (oldStock + it.qtyBase))
                : newCostX10k;

            await this.db.product_units.update(unit.id, {
              cost_x10k: weightedCostX10k,
              updated_at: now,
              updated_by: input.receivedBy,
            });

            // Catat riwayat biaya
            if (oldCostX10k !== weightedCostX10k) {
              await this.db.price_history.add({
                id: this.idGen.generateId(),
                product_unit_id: unit.id,
                old_price: Math.floor(oldCostX10k / 10000),
                new_price: Math.floor(weightedCostX10k / 10000),
                changed_at: now,
                changed_by: input.receivedBy,
                reason: `Penerimaan Barang #${receiptNo}`,
              });
            }
          }
        }

        // 3. Simpan header & items penerimaan
        await this.db.goods_receipts.add(receiptHeader);
        await this.db.goods_receipt_items.bulkAdd(receiptItems);

        // 4. Audit Log
        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: input.receivedBy,
          device_id: 'local_device',
          action: 'goods_receipt.post',
          entity_type: 'goods_receipt',
          entity_id: receiptId,
          reason: `Penerimaan barang #${receiptNo} total ${totalCost}`,
        });
      }
    );

    return { receipt: receiptHeader, items: receiptItems };
  }

  /**
   * Mengambil riwayat penerimaan barang.
   */
  async listReceipts(): Promise<GoodsReceipt[]> {
    return this.db.goods_receipts.orderBy('received_date').reverse().toArray();
  }

  /**
   * Mengambil detail penerimaan barang lengkap.
   */
  async getReceiptDetail(receiptId: string): Promise<
    | {
        receipt: GoodsReceipt;
        supplier: import('@/data/db').Supplier;
        items: (GoodsReceiptItem & { productName: string; unitCode: string })[];
      }
    | undefined
  > {
    const receipt = await this.db.goods_receipts.get(receiptId);
    if (!receipt) return undefined;

    const supplier = (await this.db.suppliers.get(receipt.supplier_id))!;
    const rawItems = await this.db.goods_receipt_items.where('receipt_id').equals(receiptId).toArray();

    const itemsWithNames = [];
    for (const ri of rawItems) {
      const prod = await this.db.products.get(ri.product_id);
      const unit = await this.db.product_units.get(ri.product_unit_id);
      itemsWithNames.push({
        ...ri,
        productName: prod?.name || ri.product_id,
        unitCode: unit?.unit_code || 'pcs',
      });
    }

    return { receipt, supplier, items: itemsWithNames };
  }
}
