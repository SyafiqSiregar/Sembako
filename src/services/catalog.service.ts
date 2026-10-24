import {
  SembakoDatabase,
  type Product,
  type ProductUnit,
  type ProductBarcode,
  type Category,
  type PriceHistory,
} from '@/data/db';

export type { Category };
import { assertMoney } from '@/domain/money';
import { assertQuantity, type BaseUnitKind } from '@/domain/quantity';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

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
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

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
        this.db.audit_logs,
      ],
      async () => {
        await this.db.products.add(product);
        await this.db.product_units.bulkAdd(productUnits);
        if (productBarcodes.length > 0) {
          await this.db.product_barcodes.bulkAdd(productBarcodes);
        }

        // Saldo stok awal 0
        await this.db.inventory_balances.add({
          product_id: productId,
          batch_id: '',
          qty_base: 0,
          last_movement_at: now,
        });

        await this.db.audit_logs.add({
          id: this.idGen.generateId(),
          occurred_at: now,
          user_id: params.createdBy,
          device_id: 'local_device',
          action: 'catalog.product_create',
          entity_type: 'product',
          entity_id: productId,
          reason: `Menambah produk baru: ${product.name}`,
        });
      }
    );

    const category = await this.db.categories.get(params.categoryId);

    return {
      product,
      category,
      units: productUnits,
      barcodes: productBarcodes,
      totalStockBase: 0,
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

    await this.db.transaction(
      'rw',
      [this.db.products, this.db.product_units, this.db.price_history, this.db.audit_logs],
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

        // Update units jika disediakan
        if (params.units) {
          for (const u of params.units) {
            const matched = existing.units.find((ou) => ou.unit_code === u.unitCode);
            if (matched) {
              await this.db.product_units.update(matched.id, {
                price: assertMoney(u.price),
                cost_x10k: u.costX10k,
                updated_at: now,
                updated_by: params.updatedBy,
              });
            }
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
}
