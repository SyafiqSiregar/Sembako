import {
  SembakoDatabase,
  type Product,
  type ProductUnit,
  type ProductBarcode,
  type Category,
  type PriceHistory,
} from '@/data/db';
import { InventoryService } from './inventory.service';
import {
  detectDuplicateCandidates,
  type ProductCatalogItem,
  type DuplicateGroup,
} from '@/domain/catalog/duplicate-detector';

export type { Category };
import { assertMoney } from '@/domain/money';
import { assertQuantity, type BaseUnitKind } from '@/domain/quantity';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';
import { authorize, type RoleCode } from '@/domain/permissions';
import { buildInternalEan13, isInternalBarcode } from '@/domain/barcode/ean13';

export interface AssignInternalBarcodeInput {
  actor: {
    id: string;
    name?: string;
    role?: RoleCode;
    roles?: RoleCode[];
  };
  productId: string;
  productUnitId: string;
}

export interface CreateProductUnitInput {
  unitCode: string;
  name: string;
  conversionFactor: number;
  price: number;
  costX10k: number;
  isBase?: boolean;
}

export interface CreateProductBarcodeInput {
  barcode: string;
  unitCode: string;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  categoryId: string;
  baseUnitKind: BaseUnitKind;
  baseUnitCode: string;
  trackExpiry?: boolean;
  minStockBase?: number;
  createdBy: string;
  units: CreateProductUnitInput[];
  barcodes?: CreateProductBarcodeInput[];
  initialStockBase?: number;
  initialExpiryDate?: string; // YYYY-MM-DD
  initialBatchCode?: string;
}

export interface UpdateProductInput {
  id: string;
  name?: string;
  sku?: string;
  categoryId?: string;
  minStockBase?: number;
  trackExpiry?: boolean;
  active?: number;
  updatedBy: string;
  units?: CreateProductUnitInput[];
  barcodes?: CreateProductBarcodeInput[];
  priceChangeReason?: string;
}

export interface ProductDetail {
  product: Product;
  category?: Category;
  units: ProductUnit[];
  barcodes: ProductBarcode[];
  totalStockBase: number;
}

export class CatalogService {
  private inventoryService: InventoryService;

  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator,
    inventoryService?: InventoryService
  ) {
    this.inventoryService = inventoryService || new InventoryService(db, clock, idGen);
  }

  // ----------------------------------------------------
  // KATEGORI
  // ----------------------------------------------------

  async createCategory(params: { name: string; parentId?: string; createdBy: string }): Promise<Category> {
    const name = params.name.trim();
    if (!name) throw new Error('Nama kategori tidak boleh kosong');

    const id = this.idGen.generateId();
    const now = this.clock.now();

    const category: Category = {
      id,
      name,
      parent_id: params.parentId,
      active: 1,
      created_at: now,
      created_by: params.createdBy,
      updated_at: now,
      updated_by: params.createdBy,
      row_version: 1,
    };

    await this.db.categories.add(category);
    return category;
  }

  async listCategories(activeOnly: boolean = true): Promise<Category[]> {
    if (activeOnly) {
      return this.db.categories.where('active').equals(1).toArray();
    }
    return this.db.categories.toArray();
  }

  async archiveCategory(id: string, updatedBy: string): Promise<void> {
    const now = this.clock.now();
    await this.db.categories.update(id, {
      active: 0,
      updated_at: now,
      updated_by: updatedBy,
    });
  }

  // ----------------------------------------------------
  // PRODUK
  // ----------------------------------------------------

  /**
   * Membuat produk baru beserta satuan jual, barcode unik, dan saldo inventaris awal.
   */
  async createProduct(params: CreateProductInput): Promise<ProductDetail> {
    const name = params.name.trim();
    if (!name) throw new Error('Nama produk tidak boleh kosong');

    if (!params.units || params.units.length === 0) {
      throw new Error('Produk harus memiliki minimal satu satuan jual');
    }

    // Pastikan ada satuan dasar
    const baseUnitInput = params.units.find((u) => u.isBase || u.conversionFactor === 1);
    if (!baseUnitInput) {
      throw new Error('Produk harus memiliki satu satuan dasar dengan faktor konversi 1');
    }

    // Validasi keunikan barcode (AC-38: sebutkan nama produk pemilik barcode yang sama)
    if (params.barcodes && params.barcodes.length > 0) {
      for (const b of params.barcodes) {
        const cleanCode = b.barcode.trim();
        if (!cleanCode) continue;

        const existingBarcode = await this.db.product_barcodes.where('barcode').equals(cleanCode).first();
        if (existingBarcode) {
          const ownerProduct = await this.db.products.get(existingBarcode.product_id);
          const ownerName = ownerProduct ? ownerProduct.name : 'produk lain';
          throw new Error(
            `Barcode '${cleanCode}' sudah dipakai oleh produk '${ownerName}'`
          );
        }
      }
    }

    const productId = this.idGen.generateId();
    const now = this.clock.now();
    const minStock = assertQuantity(params.minStockBase ?? 0);

    const product: Product = {
      id: productId,
      sku: params.sku?.trim() || undefined,
      name,
      category_id: params.categoryId,
      base_unit_kind: params.baseUnitKind,
      base_unit_code: params.baseUnitCode,
      track_expiry: params.trackExpiry ? 1 : 0,
      min_stock_base: minStock,
      active: 1,
      created_at: now,
      created_by: params.createdBy,
      updated_at: now,
      updated_by: params.createdBy,
      row_version: 1,
    };

    const productUnits: ProductUnit[] = [];
    const productBarcodes: ProductBarcode[] = [];

    for (const u of params.units) {
      const unitId = this.idGen.generateId();
      const unit: ProductUnit = {
        id: unitId,
        product_id: productId,
        unit_code: u.unitCode.trim(),
        name: u.name.trim(),
        conversion_factor: u.conversionFactor,
        price: assertMoney(u.price),
        cost_x10k: u.costX10k,
        is_base: u.isBase || u.conversionFactor === 1 ? 1 : 0,
        active: 1,
        created_at: now,
        created_by: params.createdBy,
        updated_at: now,
        updated_by: params.createdBy,
      };
      productUnits.push(unit);

      // Barcode yang diasosiasikan dengan unitCode ini
      if (params.barcodes) {
        const matchingBarcodes = params.barcodes.filter((b) => b.unitCode === u.unitCode);
        for (const mb of matchingBarcodes) {
          productBarcodes.push({
            id: this.idGen.generateId(),
            product_id: productId,
            product_unit_id: unitId,
            barcode: mb.barcode.trim(),
            created_at: now,
          });
        }
      }
    }

    await this.db.transaction(
      'rw',
      [
        this.db.products,
        this.db.product_units,
        this.db.product_barcodes,
        this.db.inventory_balances,
        this.db.product_batches,
        this.db.stock_movements,
        this.db.stock_movement_items,
        this.db.audit_logs,
      ],
      async () => {
        await this.db.products.add(product);
        await this.db.product_units.bulkAdd(productUnits);
        if (productBarcodes.length > 0) {
          await this.db.product_barcodes.bulkAdd(productBarcodes);
        }

        const initialStock = params.initialStockBase && params.initialStockBase > 0
          ? assertQuantity(params.initialStockBase)
          : 0;

        if (initialStock > 0) {
          const movementId = this.idGen.generateId();
          let batchId: string = '';

          if (params.trackExpiry) {
            if (!params.initialExpiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.initialExpiryDate)) {
              throw new Error('Tanggal kedaluwarsa wajib diisi dengan format YYYY-MM-DD jika stok awal diisi');
            }
            batchId = this.idGen.generateId();
            const batchCode = params.initialBatchCode?.trim() || `BTH-${params.initialExpiryDate.replace(/-/g, '')}`;

            await this.db.product_batches.add({
              id: batchId,
              product_id: productId,
              batch_code: batchCode,
              expiry_date: params.initialExpiryDate,
              active: 1,
              created_at: now,
            });
          }

          // Catat saldo stok awal
          await this.db.inventory_balances.add({
            product_id: productId,
            batch_id: batchId,
            qty_base: initialStock,
            last_movement_at: now,
          });

          // Catat mutasi stok INITIAL_BALANCE di ledger
          await this.db.stock_movements.add({
            id: movementId,
            type: 'INITIAL_BALANCE',
            ref_type: 'opening_stock',
            ref_id: productId,
            user_id: params.createdBy,
            occurred_at: now,
            reason: `Saldo awal saat pendaftaran produk: ${product.name}`,
          });

          await this.db.stock_movement_items.add({
            id: this.idGen.generateId(),
            movement_id: movementId,
            product_id: productId,
            batch_id: batchId || undefined,
            qty_delta_base: initialStock,
            unit_cost_x10k: baseUnitInput.costX10k,
            occurred_at: now,
          });
        } else {
          // Saldo stok awal 0
          await this.db.inventory_balances.add({
            product_id: productId,
            batch_id: '',
            qty_base: 0,
            last_movement_at: now,
          });
        }

        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: params.createdBy,
          device_id: 'local_device',
          action: 'catalog.product_create',
          entity_type: 'product',
          entity_id: productId,
          reason: `Menambah produk baru: ${product.name}${initialStock > 0 ? ` (stok awal: ${initialStock})` : ''}`,
        });
      }
    );

    const category = await this.db.categories.get(params.categoryId);

    const initialStock = params.initialStockBase && params.initialStockBase > 0
      ? assertQuantity(params.initialStockBase)
      : 0;

    return {
      product,
      category,
      units: productUnits,
      barcodes: productBarcodes,
      totalStockBase: initialStock,
    };
  }

  /**
   * Mengubah data produk. Perubahan harga jual mencatat price_history (FR-CAT-09, AC-10).
   */
  async updateProduct(params: UpdateProductInput): Promise<ProductDetail> {
    const existing = await this.getProductById(params.id);
    if (!existing) {
      throw new Error(`Produk dengan ID '${params.id}' tidak ditemukan`);
    }

    const now = this.clock.now();
    const priceHistories: PriceHistory[] = [];

    // Jika ada pembaruan satuan/harga, periksa perubahan harga
    if (params.units) {
      for (const updatedUnit of params.units) {
        const oldUnit = existing.units.find((u) => u.unit_code === updatedUnit.unitCode);
        if (oldUnit && oldUnit.price !== updatedUnit.price) {
          priceHistories.push({
            id: this.idGen.generateId(),
            product_unit_id: oldUnit.id,
            old_price: oldUnit.price,
            new_price: assertMoney(updatedUnit.price),
            changed_at: now,
            changed_by: params.updatedBy,
            reason: params.priceChangeReason || 'Penyesuaian harga jual master',
          });
        }
      }
    }

    // Validasi keunikan barcode baru jika disediakan (tidak boleh dipakai produk lain)
    if (params.barcodes && params.barcodes.length > 0) {
      for (const b of params.barcodes) {
        const cleanCode = b.barcode.trim();
        if (!cleanCode) continue;

        const existingBarcode = await this.db.product_barcodes.where('barcode').equals(cleanCode).first();
        if (existingBarcode && existingBarcode.product_id !== params.id) {
          const ownerProduct = await this.db.products.get(existingBarcode.product_id);
          const ownerName = ownerProduct ? ownerProduct.name : 'produk lain';
          throw new Error(`Barcode '${cleanCode}' sudah dipakai oleh produk '${ownerName}'`);
        }
      }
    }

    await this.db.transaction(
      'rw',
      [
        this.db.products,
        this.db.product_units,
        this.db.product_barcodes,
        this.db.price_history,
        this.db.audit_logs,
      ],
      async () => {
        const updateData: Partial<Product> = {
          updated_at: now,
          updated_by: params.updatedBy,
          row_version: existing.product.row_version + 1,
        };
        if (params.name) updateData.name = params.name.trim();
        if (params.sku !== undefined) updateData.sku = params.sku.trim() || undefined;
        if (params.categoryId) updateData.category_id = params.categoryId;
        if (params.minStockBase !== undefined) updateData.min_stock_base = params.minStockBase;
        if (params.trackExpiry !== undefined) updateData.track_expiry = params.trackExpiry ? 1 : 0;
        if (params.active !== undefined) updateData.active = params.active;

        await this.db.products.update(params.id, updateData);

        // Peta unit_code -> unitId untuk asosiasi barcode
        const unitIdMap = new Map<string, string>();
        for (const u of existing.units) {
          unitIdMap.set(u.unit_code, u.id);
        }

        // Update units yang ada dan tambah units baru jika disediakan
        if (params.units) {
          for (const u of params.units) {
            const matched = existing.units.find((ou) => ou.unit_code === u.unitCode);
            if (matched) {
              await this.db.product_units.update(matched.id, {
                name: u.name.trim(),
                conversion_factor: u.conversionFactor,
                price: assertMoney(u.price),
                cost_x10k: u.costX10k,
                updated_at: now,
                updated_by: params.updatedBy,
              });
              unitIdMap.set(u.unitCode, matched.id);
            } else {
              // Satuan kemasan baru (misal: tambah Dus pada produk yang sudah ada)
              const newUnitId = this.idGen.generateId();
              const newUnit: ProductUnit = {
                id: newUnitId,
                product_id: params.id,
                unit_code: u.unitCode.trim(),
                name: u.name.trim(),
                conversion_factor: u.conversionFactor,
                price: assertMoney(u.price),
                cost_x10k: u.costX10k,
                is_base: u.isBase || u.conversionFactor === 1 ? 1 : 0,
                active: 1,
                created_at: now,
                created_by: params.updatedBy,
                updated_at: now,
                updated_by: params.updatedBy,
              };
              await this.db.product_units.add(newUnit);
              unitIdMap.set(u.unitCode, newUnitId);
            }
          }
        }

        // Sinkronisasi barcode jika disediakan
        if (params.barcodes !== undefined) {
          // Hapus barcode lama milik produk ini
          await this.db.product_barcodes.where('product_id').equals(params.id).delete();

          // Masukkan barcode yang aktif dan kaitkan dengan product_unit_id yang tepat
          for (const b of params.barcodes) {
            const cleanCode = b.barcode.trim();
            if (!cleanCode) continue;

            const unitId = unitIdMap.get(b.unitCode) || existing.units[0]?.id;
            if (!unitId) continue;

            await this.db.product_barcodes.add({
              id: this.idGen.generateId(),
              product_id: params.id,
              product_unit_id: unitId,
              barcode: cleanCode,
              created_at: now,
            });
          }
        }

        // Catat riwayat perubahan harga
        if (priceHistories.length > 0) {
          await this.db.price_history.bulkAdd(priceHistories);
        }

        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: params.updatedBy,
          device_id: 'local_device',
          action: 'catalog.product_update',
          entity_type: 'product',
          entity_id: params.id,
          reason: `Memperbarui produk ${existing.product.name}`,
        });
      }
    );

    return (await this.getProductById(params.id))!;
  }

  /**
   * Mengarsipkan produk (AC-39: produk tidak dihapus permanen jika sudah ada histori).
   */
  async archiveProduct(id: string, updatedBy: string): Promise<void> {
    const product = await this.db.products.get(id);
    if (!product) throw new Error('Produk tidak ditemukan');

    const now = this.clock.now();
    await this.db.products.update(id, {
      active: 0,
      updated_at: now,
      updated_by: updatedBy,
    });
  }

  /**
   * Mengambil detail produk lengkap (product, units, barcodes, stock).
   */
  async getProductById(id: string): Promise<ProductDetail | undefined> {
    const product = await this.db.products.get(id);
    if (!product) return undefined;

    const category = await this.db.categories.get(product.category_id);
    const units = await this.db.product_units.where('product_id').equals(id).toArray();
    const barcodes = await this.db.product_barcodes.where('product_id').equals(id).toArray();

    const balances = await this.db.inventory_balances.where('product_id').equals(id).toArray();
    const totalStockBase = balances.reduce((sum, b) => sum + b.qty_base, 0);

    return {
      product,
      category,
      units,
      barcodes,
      totalStockBase,
    };
  }

  /**
   * Pencarian instan berdasarkan barcode (FR-CAT-04, FR-POS-01, AC-01).
   */
  async getProductByBarcode(barcode: string): Promise<
    | {
        product: Product;
        unit: ProductUnit;
        barcode: string;
        stockBase: number;
      }
    | undefined
  > {
    const barcodeRecord = await this.db.product_barcodes.where('barcode').equals(barcode.trim()).first();
    if (!barcodeRecord) return undefined;

    const product = await this.db.products.get(barcodeRecord.product_id);
    if (!product || product.active === 0) return undefined;

    const unit = await this.db.product_units.get(barcodeRecord.product_unit_id);
    if (!unit) return undefined;

    const balances = await this.db.inventory_balances.where('product_id').equals(product.id).toArray();
    const stockBase = balances.reduce((sum, b) => sum + b.qty_base, 0);

    return {
      product,
      unit,
      barcode: barcodeRecord.barcode,
      stockBase,
    };
  }

  /**
   * Mengambil daftar produk lengkap untuk tabel katalog.
   */
  async listProducts(filters?: { categoryId?: string; activeOnly?: boolean }): Promise<ProductDetail[]> {
    let collection = this.db.products.toCollection();

    if (filters?.activeOnly !== false) {
      collection = this.db.products.where('active').equals(1);
    }

    let products = await collection.toArray();

    if (filters?.categoryId) {
      products = products.filter((p) => p.category_id === filters.categoryId);
    }

    const details: ProductDetail[] = [];
    for (const p of products) {
      const detail = await this.getProductById(p.id);
      if (detail) details.push(detail);
    }

    return details;
  }

  /**
   * Membuat dan mengaitkan barcode internal (EAN-13 awalan 20) secara atomik (FR-CAT-11, BL-01..BL-06).
   * Memeriksa otorisasi 'catalog.manage', memastikan keunikan sequence, dan mencatat audit log.
   */
  async assignInternalBarcode(params: AssignInternalBarcodeInput): Promise<{ barcode: string }> {
    // 1. Otorisasi sebelum membuka transaksi
    const roles = params.actor.roles && params.actor.roles.length > 0
      ? params.actor.roles
      : params.actor.role
      ? [params.actor.role]
      : [];
    authorize(roles, 'catalog.manage', params.actor.name || params.actor.id);

    const now = this.clock.now();
    let assignedBarcode = '';

    await this.db.transaction(
      'rw',
      [
        this.db.products,
        this.db.product_units,
        this.db.product_barcodes,
        this.db.counters,
        this.db.audit_logs,
      ],
      async () => {
        // 2. Validasi produk & satuan
        const product = await this.db.products.get(params.productId);
        if (!product || product.active === 0) {
          throw new Error('Produk tidak ditemukan atau sudah dinonaktifkan');
        }

        const unit = await this.db.product_units.get(params.productUnitId);
        if (!unit || unit.product_id !== params.productId || unit.active === 0) {
          throw new Error('Satuan produk tidak valid atau sudah dinonaktifkan');
        }

        // 3. Pastikan satuan belum memiliki barcode internal (awalan 20-29)
        const existingBarcodes = await this.db.product_barcodes
          .where('product_unit_id')
          .equals(params.productUnitId)
          .toArray();

        const hasInternal = existingBarcodes.some((b) => isInternalBarcode(b.barcode));
        if (hasInternal) {
          throw new Error('Satuan ini sudah memiliki barcode internal');
        }

        // 4. Baca sequence counter internal_barcode_seq (default: 0)
        const counterRecord = await this.db.counters.get('internal_barcode_seq');
        let currentSeq = counterRecord ? counterRecord.value : 0;

        // 5. Cari sequence berikutnya yang unik (maksimal 50 percobaan)
        let candidate = '';
        let attempts = 0;
        while (attempts < 50) {
          attempts++;
          currentSeq++;
          const testCode = buildInternalEan13(currentSeq);
          const duplicate = await this.db.product_barcodes.where('barcode').equals(testCode).first();
          if (!duplicate) {
            candidate = testCode;
            break;
          }
        }

        if (!candidate) {
          throw new Error('Gagal menghasilkan barcode internal yang unik setelah 50 percobaan');
        }

        // 6. Simpan counter teranyar
        await this.db.counters.put({
          key: 'internal_barcode_seq',
          value: currentSeq,
        });

        // 7. Simpan baris barcode baru
        const barcodeId = this.idGen.generateId();
        await this.db.product_barcodes.add({
          id: barcodeId,
          product_id: params.productId,
          product_unit_id: params.productUnitId,
          barcode: candidate,
          created_at: now,
        });

        // 8. Catat audit log dalam transaksi yang sama
        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: params.actor.id,
          device_id: 'TABLET1',
          action: 'catalog.barcode_internal_create',
          entity_type: 'product_barcodes',
          entity_id: barcodeId,
          after_json: JSON.stringify({
            productId: params.productId,
            productName: product.name,
            productUnitId: params.productUnitId,
            unitCode: unit.unit_code,
            barcode: candidate,
          }),
          reason: `Pembuatan barcode internal untuk ${product.name} (${unit.name})`,
        });

        assignedBarcode = candidate;
      }
    );

    return { barcode: assignedBarcode };
  }

  /**
   * Pindai katalog produk aktif untuk menemukan potensi duplikat (FR-CAT-01).
   */
  async scanDuplicates(ignoredPairIds: Set<string> = new Set()): Promise<DuplicateGroup[]> {
    const products = await this.db.products.where('active').equals(1).toArray();
    const categories = await this.db.categories.toArray();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const allUnits = await this.db.product_units.toArray();
    const unitsByProd = new Map<string, typeof allUnits>();
    for (const u of allUnits) {
      const list = unitsByProd.get(u.product_id) || [];
      list.push(u);
      unitsByProd.set(u.product_id, list);
    }

    const allBarcodes = await this.db.product_barcodes.toArray();
    const barcodesByProd = new Map<string, string[]>();
    for (const b of allBarcodes) {
      const list = barcodesByProd.get(b.product_id) || [];
      list.push(b.barcode);
      barcodesByProd.set(b.product_id, list);
    }

    const allBalances = await this.db.inventory_balances.toArray();
    const stockByProd = new Map<string, number>();
    for (const bal of allBalances) {
      stockByProd.set(bal.product_id, (stockByProd.get(bal.product_id) || 0) + bal.qty_base);
    }

    // Ambil histori struk per produk
    const allSaleItems = await this.db.sale_items.toArray();
    const txCountByProd = new Map<string, number>();
    for (const item of allSaleItems) {
      txCountByProd.set(item.product_id, (txCountByProd.get(item.product_id) || 0) + 1);
    }

    const catalogItems: ProductCatalogItem[] = products.map((p) => {
      const pUnits = unitsByProd.get(p.id) || [];
      const baseUnit = pUnits.find((u) => u.is_base === 1) || pUnits[0];

      return {
        id: p.id,
        name: p.name,
        category_id: p.category_id,
        category_name: catMap.get(p.category_id) || 'Tanpa Kategori',
        base_unit_name: baseUnit?.name || 'Pcs',
        base_unit_code: baseUnit?.unit_code || 'pcs',
        barcodes: barcodesByProd.get(p.id) || [],
        stock: stockByProd.get(p.id) || 0,
        price: baseUnit?.price || 0,
        cost: baseUnit?.cost_x10k ? Math.round(baseUnit.cost_x10k / 10000) : 0,
        tx_count: txCountByProd.get(p.id) || 0,
      };
    });

    return detectDuplicateCandidates(catalogItems, ignoredPairIds);
  }

  /**
   * Gabungkan stok dari produk keliru ke produk utama dan arsipkan produk keliru (AC-39, BR-18).
   */
  async mergeDuplicateProduct(params: {
    primaryProductId: string;
    duplicateProductId: string;
    actor: { id: string; role?: RoleCode; roles?: RoleCode[] };
  }): Promise<{
    transferredStock: number;
    primaryName: string;
    duplicateName: string;
  }> {
    const roles = params.actor.roles || (params.actor.role ? [params.actor.role] : []);
    authorize(roles, 'catalog.manage', params.actor.id);

    const primaryProduct = await this.db.products.get(params.primaryProductId);
    if (!primaryProduct) throw new Error('Produk utama tidak ditemukan');

    const duplicateProduct = await this.db.products.get(params.duplicateProductId);
    if (!duplicateProduct) throw new Error('Produk duplikat tidak ditemukan');

    if (params.primaryProductId === params.duplicateProductId) {
      throw new Error('Produk utama dan produk duplikat tidak boleh sama');
    }

    // Ambil saldo stok produk duplikat
    const balances = await this.db.inventory_balances
      .where('product_id')
      .equals(params.duplicateProductId)
      .toArray();
    const transferQty = balances.reduce((sum, b) => sum + b.qty_base, 0);

    const dupUnits = await this.db.product_units
      .where('product_id')
      .equals(params.duplicateProductId)
      .toArray();
    const dupBaseUnit = dupUnits.find((u) => u.is_base === 1) || dupUnits[0];

    const primUnits = await this.db.product_units
      .where('product_id')
      .equals(params.primaryProductId)
      .toArray();
    const primBaseUnit = primUnits.find((u) => u.is_base === 1) || primUnits[0];

    const now = this.clock.now();

    // 1. Pindahkan stok fisik jika > 0 via InventoryService (ledger resmi)
    if (transferQty > 0) {
      await this.inventoryService.recordMovement({
        type: 'COUNT_ADJUSTMENT',
        refType: 'adjustment',
        userId: params.actor.id,
        reason: `[MERGE_DUPLICATE] Pemindahan ${transferQty} stok fisik dari '${duplicateProduct.name}' ke '${primaryProduct.name}'`,
        allowNegativeStock: false,
        items: [
          {
            productId: params.duplicateProductId,
            qtyDeltaBase: -transferQty,
            unitCostX10k: dupBaseUnit?.cost_x10k || 0,
          },
          {
            productId: params.primaryProductId,
            qtyDeltaBase: transferQty,
            unitCostX10k: primBaseUnit?.cost_x10k || 0,
          },
        ],
      });
    }

    // 2. Arsipkan produk duplikat & catat audit log dalam transaksi Dexie
    await this.db.transaction('rw', [this.db.products, this.db.audit_logs], async () => {
      await this.db.products.update(params.duplicateProductId, {
        active: 0,
        updated_at: now,
        updated_by: params.actor.id,
      });

      await this.db.audit_logs.add({
        id: this.idGen.generateId(),
        occurred_at: now,
        user_id: params.actor.id,
        device_id: 'TABLET1',
        action: 'catalog.product_merge_duplicate',
        entity_type: 'products',
        entity_id: params.duplicateProductId,
        before_json: JSON.stringify({
          name: duplicateProduct.name,
          active: duplicateProduct.active,
          stock: transferQty,
        }),
        after_json: JSON.stringify({
          active: 0,
          merged_into: params.primaryProductId,
          transferred_stock: transferQty,
        }),
        reason: `Penggabungan barang duplikat: memindahkan ${transferQty} stok ke '${primaryProduct.name}' dan mengarsipkan '${duplicateProduct.name}'`,
      });
    });

    return {
      transferredStock: transferQty,
      primaryName: primaryProduct.name,
      duplicateName: duplicateProduct.name,
    };
  }
}
