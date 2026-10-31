import {
  SembakoDatabase,
  type Sale,
  type SaleItem,
  type SaleItemBatch,
  type Payment,
} from '@/data/db';
import { InventoryService } from './inventory.service';
import { BatchService } from './batch.service';
import { assertMoney } from '@/domain/money';
import { assertQuantity } from '@/domain/quantity';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export interface CheckoutItemInput {
  productId: string;
  productUnitId: string;
  nameSnapshot: string;
  unitCodeSnapshot: string;
  factorSnapshot: number;
  barcodeSnapshot?: string;
  qtyBase: number;
  unitPriceSnapshot: number;
  unitCostX10kSnapshot: number;
  discount?: number; // diskon per baris
  batchId?: string;
}

export interface CheckoutParams {
  saleId: string; // Kunci idempotensi (AC-03, FR-POS-08)
  sessionId: string;
  cashierId: string;
  items: CheckoutItemInput[];
  discountTotal?: number; // diskon tingkat transaksi
  paymentMethod: 'cash' | 'non_cash_manual';
  amountPaid: number;
  deviceCode?: string;
  referenceNo?: string;
}

export interface CheckoutResult {
  sale: Sale;
  items: SaleItem[];
  payment: Payment;
  change: number; // Kembalian (amountPaid - total)
}

export class CheckoutService {
  private batchService: BatchService;

  constructor(
    private db: SembakoDatabase,
    private inventoryService: InventoryService,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {
    this.batchService = new BatchService(this.db, this.inventoryService, this.clock, this.idGen);
  }

  /**
   * Menjalankan Checkout Penjualan Kasir Atomik & Idempoten (BR-03, AC-02, AC-03, AC-04, AC-17).
   */
  async processCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    // 1. Cek Idempotensi (AC-03)
    const existingSale = await this.db.sales.get(params.saleId);
    if (existingSale) {
      if (existingSale.status === 'completed') {
        const items = await this.db.sale_items.where('sale_id').equals(params.saleId).toArray();
        const payment = (await this.db.payments.where('sale_id').equals(params.saleId).first())!;
        const change = Math.max(0, payment.amount - existingSale.total);
        return { sale: existingSale, items, payment, change };
      }
      throw new Error(`Transaksi '${params.saleId}' sudah ada dengan status '${existingSale.status}'`);
    }

    // 2. Validasi Sesi Kasir Terbuka (AC-41, BR-21)
    const session = await this.db.cashier_sessions.get(params.sessionId);
    if (!session || session.status !== 'open') {
      throw new Error('Penjualan hanya dapat dilakukan saat sesi kasir aktif / terbuka');
    }

    // 3. Validasi Keranjang
    if (!params.items || params.items.length === 0) {
      throw new Error('Keranjang belanja kosong');
    }

    const now = this.clock.now();
    let subtotal = 0;
    const saleItems: SaleItem[] = [];

    // 4. Hitung subtotal dan buat snapshot item (BR-14)
    params.items.forEach((item, idx) => {
      const qtyBase = assertQuantity(item.qtyBase);
      const unitPrice = assertMoney(item.unitPriceSnapshot);
      const discount = assertMoney(item.discount ?? 0);
      const factor = item.factorSnapshot > 0 ? item.factorSnapshot : 1;

      // BR-14: line_total = round_half_up(qty_base * unit_price / factor) - discount
      const rawPrice = (qtyBase * unitPrice) / factor;
      const roundedLinePrice = Math.floor((rawPrice * 2 + 1) / 2); // round half-up
      const lineTotal = Math.max(0, roundedLinePrice - discount);

      subtotal += lineTotal;

      saleItems.push({
        id: this.idGen.generateId(),
        sale_id: params.saleId,
        line_no: idx + 1,
        product_id: item.productId,
        product_unit_id: item.productUnitId,
        name_snapshot: item.nameSnapshot,
        unit_code_snapshot: item.unitCodeSnapshot,
        factor_snapshot: factor,
        barcode_snapshot: item.barcodeSnapshot,
        qty_base: qtyBase,
        unit_price_snapshot: unitPrice,
        discount,
        line_total: lineTotal,
        unit_cost_x10k_snapshot: item.unitCostX10kSnapshot,
      });
    });

    const discountTotal = assertMoney(params.discountTotal ?? 0);
    const total = Math.max(0, subtotal - discountTotal);
    const amountPaid = assertMoney(params.amountPaid);

    // AC-17: Pembayaran harus mencukupi
    if (amountPaid < total) {
      const shortage = total - amountPaid;
      throw new Error(`Uang pembayaran kurang Rp ${shortage.toLocaleString('id-ID')}`);
    }

    const change = amountPaid - total;

    // 5. Generate nomor struk unik: {KODE-PERANGKAT}-{YYYYMMDD}-{NNNN} (BR-16)
    const deviceCode = params.deviceCode || 'KASIR1';
    const dateStr = this.clock.todayDateString().replace(/-/g, '');
    const counterKey = `receipt_${dateStr}`;

    const receiptNo = await this.getNextReceiptNo(counterKey, deviceCode, dateStr);

    const saleHeader: Sale = {
      id: params.saleId,
      receipt_no: receiptNo,
      session_id: params.sessionId,
      cashier_id: params.cashierId,
      status: 'completed',
      subtotal,
      discount_total: discountTotal,
      tax_total: 0,
      rounding_adjustment: 0,
      total,
      completed_at: now,
      created_at: now,
      created_by: params.cashierId,
      updated_at: now,
      updated_by: params.cashierId,
      row_version: 1,
    };

    const paymentRecord: Payment = {
      id: this.idGen.generateId(),
      sale_id: params.saleId,
      method: params.paymentMethod,
      amount: amountPaid,
      paid_at: now,
      reference_no: params.referenceNo?.trim() || undefined,
    };

    // 6. Transaksi Atomik: Alokasikan FEFO & Kurangi stok lewat InventoryService & simpan penjualan
    // Jika stok habis, kedaluwarsa, atau penyimpanan gagal, seluruh transaksi Dexie dibatalkan (AC-04, AC-24)
    await this.db.transaction(
      'rw',
      [
        this.db.sales,
        this.db.sale_items,
        this.db.sale_item_batches,
        this.db.payments,
        this.db.inventory_balances,
        this.db.stock_movements,
        this.db.stock_movement_items,
        this.db.products,
        this.db.product_batches,
        this.db.audit_logs,
      ],
      async () => {
        // Alokasikan pergerakan stok (FEFO jika track_expiry aktif)
        const movementItems: {
          productId: string;
          batchId?: string;
          qtyDeltaBase: number;
          unitCostX10k: number;
        }[] = [];
        const saleItemBatches: SaleItemBatch[] = [];

        for (let i = 0; i < params.items.length; i++) {
          const it = params.items[i]!;
          const correspondingSaleItem = saleItems[i]!;
          const prod = await this.db.products.get(it.productId);
          if (prod && prod.track_expiry === 1) {
            if (it.batchId) {
              const batch = await this.db.product_batches.get(it.batchId);
              if (batch && batch.expiry_date < this.clock.todayDateString()) {
                throw new Error(
                  `Penjualan diblokir: Batch '${batch.batch_code}' pada produk '${prod.name}' telah kedaluwarsa (FR-EXP-04).`
                );
              }
              movementItems.push({
                productId: it.productId,
                batchId: it.batchId,
                qtyDeltaBase: -it.qtyBase,
                unitCostX10k: it.unitCostX10kSnapshot,
              });
              saleItemBatches.push({
                sale_item_id: correspondingSaleItem.id,
                batch_id: it.batchId,
                qty_base: it.qtyBase,
              });
            } else {
              // FEFO allocation otomatis (FR-EXP-03, AC-24)
              const allocations = await this.batchService.allocateFefo(it.productId, it.qtyBase);
              for (const alloc of allocations) {
                movementItems.push({
                  productId: it.productId,
                  batchId: alloc.batchId,
                  qtyDeltaBase: -alloc.qtyBase,
                  unitCostX10k: it.unitCostX10kSnapshot,
                });
                saleItemBatches.push({
                  sale_item_id: correspondingSaleItem.id,
                  batch_id: alloc.batchId,
                  qty_base: alloc.qtyBase,
                });
              }
            }
          } else {
            movementItems.push({
              productId: it.productId,
              batchId: it.batchId,
              qtyDeltaBase: -it.qtyBase, // Keluar = negatif
              unitCostX10k: it.unitCostX10kSnapshot,
            });
          }
        }

        // Kurangi stok fisik lewat InventoryService
        await this.inventoryService.recordMovement({
          type: 'SALE',
          refType: 'sale',
          refId: params.saleId,
          userId: params.cashierId,
          reason: `Penjualan kasir struk #${receiptNo}`,
          items: movementItems,
        });

        // Simpan penjualan & item
        await this.db.sales.add(saleHeader);
        await this.db.sale_items.bulkAdd(saleItems);
        if (saleItemBatches.length > 0) {
          await this.db.sale_item_batches.bulkAdd(saleItemBatches);
        }
        await this.db.payments.add(paymentRecord);
      }
    );

    return {
      sale: saleHeader,
      items: saleItems,
      payment: paymentRecord,
      change,
    };
  }

  /**
   * Melakukan Void Pembatalan Transaksi Kasir (BR-14, BR-15, BR-17, AC-07).
   * Mengembalikan stok lewat reversal movement dan menandai status voided.
   * Hanya diizinkan pada sesi kasir yang sama dan masih aktif (BR-17).
   */
  async voidSale(params: {
    saleId: string;
    voidedBy: string;
    voidReason: string;
    currentSessionId?: string;
  }): Promise<Sale> {
    const reason = params.voidReason?.trim();
    if (!reason) {
      throw new Error('Alasan pembatalan (void) wajib diisi');
    }

    const sale = await this.db.sales.get(params.saleId);
    if (!sale) {
      throw new Error('Transaksi tidak ditemukan');
    }

    if (sale.status !== 'completed') {
      throw new Error(`Transaksi tidak dapat di-void karena berstatus '${sale.status}'`);
    }

    // Validasi pembatalan hanya pada sesi kasir yang sama dan masih aktif (BR-17)
    const session = await this.db.cashier_sessions.get(sale.session_id);
    if (!session || session.status !== 'open') {
      throw new Error('Transaksi dari sesi kas yang sudah ditutup tidak dapat di-void. Gunakan fitur Retur Barang.');
    }

    if (params.currentSessionId && sale.session_id !== params.currentSessionId) {
      throw new Error('Void hanya dapat dilakukan pada sesi kasir yang sedang aktif.');
    }

    const items = await this.db.sale_items.where('sale_id').equals(params.saleId).toArray();
    const now = this.clock.now();

    await this.db.transaction(
      'rw',
      [
        this.db.sales,
        this.db.inventory_balances,
        this.db.stock_movements,
        this.db.stock_movement_items,
        this.db.products,
        this.db.audit_logs,
      ],
      async () => {
        // Kembalikan stok lewat reversal movement (delta positif)
        await this.inventoryService.recordMovement({
          type: 'SALE_VOID',
          refType: 'sale',
          refId: params.saleId,
          userId: params.voidedBy,
          reason: `Void transaksi #${sale.receipt_no}: ${reason}`,
          items: items.map((it) => ({
            productId: it.product_id,
            qtyDeltaBase: it.qty_base, // Balik ke stok = positif
            unitCostX10k: it.unit_cost_x10k_snapshot,
          })),
        });

        // Update status penjualan
        await this.db.sales.update(params.saleId, {
          status: 'voided',
          voided_at: now,
          voided_by: params.voidedBy,
          void_reason: reason,
          updated_at: now,
          updated_by: params.voidedBy,
        });

        // Audit log void
        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: params.voidedBy,
          device_id: 'local_device',
          action: 'sale.void',
          entity_type: 'sale',
          entity_id: params.saleId,
          reason,
        });
      }
    );

    return (await this.db.sales.get(params.saleId))!;
  }

  /**
   * Mengambil batas hari retur dari pengaturan toko (BR-18, FR-SET-03).
   */
  private async getReturnDaysLimit(): Promise<number> {
    const settingRec = await this.db.app_settings.get('store_settings');
    if (settingRec) {
      try {
        const parsed = JSON.parse(settingRec.value_json);
        if (typeof parsed.returnDaysLimit === 'number') {
          return parsed.returnDaysLimit;
        }
      } catch {
        // Fallback default
      }
    }
    return 7;
  }

  /**
   * Memproses Retur Barang Pelanggan (FR-POS-12, BR-16, BR-18, BR-19, AC-08, AC-28).
   * - Menambah kembali stok layak jual ke gudang/toko
   * - Barang rusak/kedaluwarsa dicatat movement tersendiri dan tidak menambah stok jual (BR-19, AC-28)
   * - Menolak retur jika melebihi batas waktu returnDaysLimit (BR-18)
   */
  async processReturn(params: {
    saleId: string;
    returnedBy: string;
    reason: string;
    items: {
      saleItemId: string;
      qtyBase: number;
      refundAmount: number;
      condition?: 'sellable' | 'damaged' | 'expired';
    }[];
  }) {
    const reason = params.reason?.trim();
    if (!reason) {
      throw new Error('Alasan retur wajib diisi');
    }
    if (!params.items || params.items.length === 0) {
      throw new Error('Tidak ada barang yang dipilih untuk diretur');
    }

    const sale = await this.db.sales.get(params.saleId);
    if (!sale) {
      throw new Error('Transaksi penjualan asal tidak ditemukan');
    }

    if (sale.status === 'voided') {
      throw new Error('Transaksi yang telah di-void tidak dapat diretur');
    }

    const now = this.clock.now();

    // Validasi batas waktu retur (BR-18)
    const returnDaysLimit = await this.getReturnDaysLimit();
    if (returnDaysLimit > 0) {
      const elapsedMs = now - sale.completed_at;
      const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
      if (elapsedDays > returnDaysLimit) {
        throw new Error(
          `Retur telah melebihi batas waktu ${returnDaysLimit} hari sejak pembelian (${elapsedDays} hari yang lalu)`
        );
      }
    }

    const saleItems = await this.db.sale_items.where('sale_id').equals(params.saleId).toArray();
    const existingReturns = await this.db.returns.where('original_sale_id').equals(params.saleId).toArray();
    const existingReturnIds = existingReturns.map((r) => r.id);
    const existingReturnItems = existingReturnIds.length > 0
      ? await this.db.return_items.where('return_id').anyOf(existingReturnIds).toArray()
      : [];

    const returnId = this.idGen.generateId();
    const returnNo = `RET-${this.clock.todayDateString().replace(/-/g, '')}-${returnId.slice(0, 4).toUpperCase()}`;

    let totalRefund = 0;
    const movementItemsToRestock: { productId: string; qtyDeltaBase: number; unitCostX10k: number }[] = [];
    const movementItemsWriteOff: { productId: string; qtyDeltaBase: number; unitCostX10k: number }[] = [];
    const returnItemRecords: {
      id: string;
      return_id: string;
      sale_item_id: string;
      qty_base: number;
      refund_amount: number;
      condition?: 'sellable' | 'damaged' | 'expired';
    }[] = [];

    // Validasi kuantitas retur tidak melebihi sisa pembelian (AC-08, BR-18)
    for (const retItem of params.items) {
      const originalItem = saleItems.find((it) => it.id === retItem.saleItemId);
      if (!originalItem) {
        throw new Error(`Item penjualan '${retItem.saleItemId}' tidak ditemukan`);
      }

      const previouslyReturned = existingReturnItems
        .filter((ri) => ri.sale_item_id === retItem.saleItemId)
        .reduce((sum, ri) => sum + ri.qty_base, 0);

      const maxReturnable = originalItem.qty_base - previouslyReturned;
      if (retItem.qtyBase <= 0 || retItem.qtyBase > maxReturnable) {
        throw new Error(
          `Kuantitas retur untuk '${originalItem.name_snapshot}' melebihi batas (maksimum: ${maxReturnable}, diminta: ${retItem.qtyBase})`
        );
      }

      const condition = retItem.condition || 'sellable';
      totalRefund += retItem.refundAmount;

      returnItemRecords.push({
        id: this.idGen.generateId(),
        return_id: returnId,
        sale_item_id: retItem.saleItemId,
        qty_base: retItem.qtyBase,
        refund_amount: retItem.refundAmount,
        condition,
      });

      if (condition === 'sellable') {
        movementItemsToRestock.push({
          productId: originalItem.product_id,
          qtyDeltaBase: retItem.qtyBase, // Balik ke stok = positif
          unitCostX10k: originalItem.unit_cost_x10k_snapshot,
        });
      } else {
        movementItemsWriteOff.push({
          productId: originalItem.product_id,
          qtyDeltaBase: retItem.qtyBase,
          unitCostX10k: originalItem.unit_cost_x10k_snapshot,
        });
      }
    }

    // Transaksi Atomik Retur
    await this.db.transaction(
      'rw',
      [
        this.db.sales,
        this.db.returns,
        this.db.return_items,
        this.db.inventory_balances,
        this.db.stock_movements,
        this.db.stock_movement_items,
        this.db.products,
        this.db.audit_logs,
      ],
      async () => {
        // 1. Tambah kembali stok layak jual ke inventaris (BR-16)
        if (movementItemsToRestock.length > 0) {
          await this.inventoryService.recordMovement({
            type: 'CUSTOMER_RETURN',
            refType: 'return',
            refId: returnId,
            userId: params.returnedBy,
            reason: `Retur barang layak jual #${returnNo} (Faktur #${sale.receipt_no}): ${reason}`,
            items: movementItemsToRestock,
          });
        }

        // 2. Untuk barang rusak / kedaluwarsa, dicatat movement tersendiri tanpa menambah stok jual (BR-19, AC-28)
        if (movementItemsWriteOff.length > 0) {
          // Mutasi A: Barang masuk dari pelanggan
          await this.inventoryService.recordMovement({
            type: 'CUSTOMER_RETURN',
            refType: 'return',
            refId: returnId,
            userId: params.returnedBy,
            reason: `Retur barang rusak/kedaluwarsa #${returnNo} (Faktur #${sale.receipt_no}): ${reason}`,
            items: movementItemsWriteOff.map((it) => ({
              productId: it.productId,
              qtyDeltaBase: it.qtyDeltaBase,
              unitCostX10k: it.unitCostX10k,
            })),
          });

          // Mutasi B: Langsung dihapusbukukan (write-off) sehingga stok jual tidak bertambah
          await this.inventoryService.recordMovement({
            type: 'RETURN_WRITE_OFF',
            refType: 'return',
            refId: returnId,
            userId: params.returnedBy,
            reason: `Penghapusan retur barang rusak/kedaluwarsa #${returnNo}: ${reason}`,
            items: movementItemsWriteOff.map((it) => ({
              productId: it.productId,
              qtyDeltaBase: -it.qtyDeltaBase,
              unitCostX10k: it.unitCostX10k,
            })),
          });
        }

        // 3. Simpan header & item retur
        await this.db.returns.add({
          id: returnId,
          return_no: returnNo,
          original_sale_id: params.saleId,
          reason,
          total_refund: totalRefund,
          created_at: now,
          created_by: params.returnedBy,
        });

        await this.db.return_items.bulkAdd(returnItemRecords);

        // 4. Update status penjualan asal
        const allItemsReturned = saleItems.every((si) => {
          const retThis = params.items.find((it) => it.saleItemId === si.id)?.qtyBase || 0;
          const prevRet = existingReturnItems
            .filter((ri) => ri.sale_item_id === si.id)
            .reduce((s, ri) => s + ri.qty_base, 0);
          return prevRet + retThis >= si.qty_base;
        });

        const newSaleStatus = allItemsReturned ? 'fully_returned' : 'partially_returned';
        await this.db.sales.update(params.saleId, {
          status: newSaleStatus,
          updated_at: now,
          updated_by: params.returnedBy,
        });

        // 5. Audit log
        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: params.returnedBy,
          device_id: 'local_device',
          action: 'sale.return',
          entity_type: 'return',
          entity_id: returnId,
          reason,
        });
      }
    );

    return { returnId, returnNo, totalRefund };
  }

  private async getNextReceiptNo(counterKey: string, deviceCode: string, dateStr: string): Promise<string> {
    const counter = await this.db.counters.get(counterKey);
    const nextVal = (counter?.value || 0) + 1;
    await this.db.counters.put({ key: counterKey, value: nextVal });

    const sequence = nextVal.toString().padStart(4, '0');
    return `${deviceCode}-${dateStr}-${sequence}`;
  }
}
