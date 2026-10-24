import Dexie, { type Table } from 'dexie';

/**
 * Tipe Data Entitas SembakoOS (DATABASE.md §3)
 */

export interface User {
  id: string;
  name: string;
  pin_hash: string;
  pin_salt: string;
  pin_kdf: string;
  pin_iterations: number;
  status: 'active' | 'disabled';
  failed_attempts: number;
  locked_until?: number;
  last_login_at?: number;
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
  row_version: number;
}

export interface Role {
  id: string;
  code: 'owner' | 'supervisor' | 'cashier' | 'stock_clerk';
  name: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
}

export interface Category {
  id: string;
  name: string;
  parent_id?: string;
  active: number; // 0 | 1
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
  row_version: number;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
}

export interface Product {
  id: string;
  sku?: string;
  name: string;
  category_id: string;
  base_unit_kind: 'count' | 'weight' | 'volume';
  base_unit_code: string;
  track_expiry: number; // 0 | 1
  min_stock_base: number;
  active: number; // 0 | 1
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
  row_version: number;
}

export interface ProductUnit {
  id: string;
  product_id: string;
  unit_code: string;
  name: string;
  conversion_factor: number; // qty_base per unit
  price: number; // Integer Rupiah
  cost_x10k: number;
  is_base: number; // 0 | 1
  active: number; // 0 | 1
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
}

export interface ProductBarcode {
  id: string;
  product_id: string;
  product_unit_id: string;
  barcode: string;
  created_at: number;
}

export interface PriceHistory {
  id: string;
  product_unit_id: string;
  old_price: number;
  new_price: number;
  changed_at: number;
  changed_by: string;
  reason?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  active: number;
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
}

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_code: string;
  expiry_date: string; // YYYY-MM-DD
  active: number;
  created_at: number;
}

export interface InventoryBalance {
  product_id: string;
  batch_id: string; // '' jika tanpa batch
  qty_base: number; // Saldo stok
  last_movement_at: number;
}

export interface StockMovement {
  id: string;
  type: 'RECEIPT' | 'SALE' | 'SALE_VOID' | 'CUSTOMER_RETURN' | 'DAMAGE_SPOILAGE' | 'INTERNAL_USE' | 'COUNT_ADJUSTMENT' | 'INITIAL_BALANCE' | 'STOCKTAKE_ADJUSTMENT' | 'REVERSAL';
  occurred_at: number;
  ref_type?: string;
  ref_id?: string;
  user_id: string;
  reason?: string;
}

export interface StockMovementItem {
  id: string;
  movement_id: string;
  product_id: string;
  batch_id?: string;
  qty_delta_base: number; // positif = masuk, negatif = keluar
  unit_cost_x10k: number;
  occurred_at: number;
}

export interface CashierSession {
  id: string;
  user_id: string;
  opening_cash: number;
  closing_cash?: number;
  status: 'open' | 'closed';
  opened_at: number;
  closed_at?: number;
  discrepancy?: number;
  notes?: string;
}

export interface Sale {
  id: string;
  receipt_no: string;
  session_id: string;
  cashier_id: string;
  status: 'completed' | 'voided' | 'partially_returned' | 'fully_returned';
  subtotal: number;
  discount_total: number;
  tax_total: number;
  rounding_adjustment: number;
  total: number;
  completed_at: number;
  voided_at?: number;
  voided_by?: string;
  void_reason?: string;
  approval_id?: string;
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
  row_version: number;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  line_no: number;
  product_id: string;
  product_unit_id: string;
  name_snapshot: string;
  unit_code_snapshot: string;
  factor_snapshot: number;
  barcode_snapshot?: string;
  qty_base: number;
  unit_price_snapshot: number;
  discount: number;
  line_total: number;
  unit_cost_x10k_snapshot: number;
}

export interface SaleItemBatch {
  sale_item_id: string;
  batch_id: string;
  qty_base: number;
}

export interface Payment {
  id: string;
  sale_id: string;
  method: 'cash' | 'non_cash_manual';
  amount: number;
  paid_at: number;
  reference_no?: string;
}

export interface Return {
  id: string;
  return_no: string;
  original_sale_id: string;
  reason: string;
  total_refund: number;
  created_at: number;
  created_by: string;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  qty_base: number;
  refund_amount: number;
}

export interface GoodsReceipt {
  id: string;
  receipt_no: string;
  supplier_id: string;
  supplier_ref_no?: string;
  received_date: string;
  status: 'draft' | 'posted' | 'reversed';
  total_cost: number;
  note?: string;
  posted_at?: number;
  posted_by?: string;
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
  row_version: number;
}

export interface GoodsReceiptItem {
  id: string;
  receipt_id: string;
  product_id: string;
  product_unit_id: string;
  qty_base: number;
  unit_cost_x10k: number;
  discount: number;
  batch_code?: string;
  expiry_date?: string;
  batch_id?: string;
}

export interface StocktakeSession {
  id: string;
  name: string;
  scope_type: 'all' | 'category' | 'selected';
  scope_ref?: string;
  status: 'counting' | 'review' | 'posted' | 'cancelled';
  blind: number;
  reviewed_by?: string;
  posted_at?: number;
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
  row_version: number;
}

export interface StocktakeItem {
  id: string;
  session_id: string;
  product_id: string;
  batch_id?: string;
  system_qty_snapshot?: number;
  counted_qty?: number;
  counted_at?: number;
  counted_by?: string;
  variance?: number;
  approved?: number;
  note?: string;
}

export interface AuditLog {
  id: string;
  occurred_at: number;
  user_id: string;
  device_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  before_json?: string;
  after_json?: string;
  reason?: string;
  ref?: string;
}

export interface AppSetting {
  key: string;
  value_json: string;
  updated_at: number;
  updated_by: string;
}

export interface BackupHistory {
  id: string;
  file_name: string;
  created_at: number;
  status: 'success' | 'failed';
  checksum_sha256?: string;
  size_bytes?: number;
  schema_version: number;
  app_version: string;
  error?: string;
}

export interface Counter {
  key: string;
  value: number;
}

export interface Approval {
  id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  authorized_by: string;
  reason?: string;
  created_at: number;
}

export interface HeldCart {
  id: string;
  user_id: string;
  session_id: string;
  name?: string;
  payload_json: string;
  created_at: number;
  updated_at: number;
}

/**
 * Kelas Database SembakoOS
 */
export class SembakoDatabase extends Dexie {
  users!: Table<User, string>;
  roles!: Table<Role, string>;
  user_roles!: Table<UserRole, [string, string]>;
  approvals!: Table<Approval, string>;

  categories!: Table<Category, string>;
  units!: Table<Unit, string>;
  products!: Table<Product, string>;
  product_units!: Table<ProductUnit, string>;
  product_barcodes!: Table<ProductBarcode, string>;
  price_history!: Table<PriceHistory, string>;

  suppliers!: Table<Supplier, string>;
  product_batches!: Table<ProductBatch, string>;

  inventory_balances!: Table<InventoryBalance, [string, string]>;
  stock_movements!: Table<StockMovement, string>;
  stock_movement_items!: Table<StockMovementItem, string>;

  sales!: Table<Sale, string>;
  sale_items!: Table<SaleItem, string>;
  sale_item_batches!: Table<SaleItemBatch, [string, string]>;
  payments!: Table<Payment, string>;
  returns!: Table<Return, string>;
  return_items!: Table<ReturnItem, string>;
  cashier_sessions!: Table<CashierSession, string>;
  held_carts!: Table<HeldCart, string>;

  goods_receipts!: Table<GoodsReceipt, string>;
  goods_receipt_items!: Table<GoodsReceiptItem, string>;
  stocktake_sessions!: Table<StocktakeSession, string>;
  stocktake_items!: Table<StocktakeItem, string>;

  audit_logs!: Table<AuditLog, string>;
  app_settings!: Table<AppSetting, string>;
  backup_history!: Table<BackupHistory, string>;
  counters!: Table<Counter, string>;

  constructor(dbName: string = 'sembako_os_db') {
    super(dbName);

    // DATABASE.md §4: Deklarasi Schema Version 1
    this.version(1).stores({
      users: 'id, status',
      roles: 'id, &code',
      user_roles: '[user_id+role_id], user_id, role_id',
      approvals: 'id, entity_type, entity_id, created_at',

      categories: 'id, name, parent_id, active',
      units: 'id, &code',
      products: 'id, name, &sku, category_id, active, track_expiry',
      product_units: 'id, product_id, &[product_id+unit_code]',
      product_barcodes: 'id, &barcode, product_id, product_unit_id',
      price_history: 'id, product_unit_id, changed_at',

      suppliers: 'id, name, active',
      product_batches: 'id, product_id, expiry_date, [product_id+expiry_date], active',

      inventory_balances: '[product_id+batch_id], product_id',
      stock_movements: 'id, type, occurred_at, [ref_type+ref_id], user_id',
      stock_movement_items: 'id, movement_id, product_id, [product_id+occurred_at]',

      sales: 'id, &receipt_no, session_id, cashier_id, status, completed_at',
      sale_items: 'id, sale_id, product_id',
      sale_item_batches: '[sale_item_id+batch_id], batch_id',
      payments: 'id, sale_id, method',
      returns: 'id, &return_no, original_sale_id, created_at',
      return_items: 'id, return_id, sale_item_id',
      cashier_sessions: 'id, user_id, status, opened_at',
      held_carts: 'id, user_id, updated_at',

      goods_receipts: 'id, &receipt_no, supplier_id, status, received_date',
      goods_receipt_items: 'id, receipt_id, product_id',
      stocktake_sessions: 'id, status, created_at',
      stocktake_items: 'id, session_id, [session_id+product_id]',

      audit_logs: 'id, occurred_at, user_id, action, [entity_type+entity_id]',
      app_settings: 'key',
      backup_history: 'id, created_at',
      counters: 'key',
    });

    // Populate data bawaan (Roles & Default Settings)
    this.on('populate', () => {
      this.roles.bulkAdd([
        { id: 'role-owner', code: 'owner', name: 'Pemilik Toko' },
        { id: 'role-supervisor', code: 'supervisor', name: 'Supervisor / Kasir Senior' },
        { id: 'role-cashier', code: 'cashier', name: 'Kasir' },
        { id: 'role-stock_clerk', code: 'stock_clerk', name: 'Petugas Stok' },
      ]);

      const now = Date.now();
      this.app_settings.bulkAdd([
        {
          key: 'store.profile',
          value_json: JSON.stringify({ name: 'Toko Sembako Berkah', address: 'Jl. Pasar Tradisional No. 12', phone: '08123456789' }),
          updated_at: now,
          updated_by: 'system',
        },
        {
          key: 'policy.negative_stock',
          value_json: JSON.stringify(false),
          updated_at: now,
          updated_by: 'system',
        },
        {
          key: 'policy.discount_limits',
          value_json: JSON.stringify({ cashier_max_percent: 5, supervisor_max_percent: 15 }),
          updated_at: now,
          updated_by: 'system',
        },
        {
          key: 'locale.timezone',
          value_json: JSON.stringify('Asia/Jakarta'),
          updated_at: now,
          updated_by: 'system',
        },
      ]);
    });
  }
}

export const db = new SembakoDatabase();
