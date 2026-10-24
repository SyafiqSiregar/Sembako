import { describe, it, expect, beforeEach } from 'vitest';
import { SembakoDatabase } from '@/data/db';

describe('Data: Dexie SembakoDatabase Schema v1', () => {
  let testDb: SembakoDatabase;

  beforeEach(async () => {
    testDb = new SembakoDatabase(`test_db_${Date.now()}_${Math.random()}`);
    await testDb.open();
  });

  it('berhasil menginisialisasi seluruh 17+ tabel Dexie', () => {
    expect(testDb.users).toBeDefined();
    expect(testDb.products).toBeDefined();
    expect(testDb.inventory_balances).toBeDefined();
    expect(testDb.stock_movements).toBeDefined();
    expect(testDb.sales).toBeDefined();
    expect(testDb.sale_items).toBeDefined();
    expect(testDb.payments).toBeDefined();
    expect(testDb.goods_receipts).toBeDefined();
    expect(testDb.stocktake_sessions).toBeDefined();
    expect(testDb.audit_logs).toBeDefined();
    expect(testDb.app_settings).toBeDefined();
  });

  it('mengisi data seed peran (roles) dan pengaturan bawaan', async () => {
    const roles = await testDb.roles.toArray();
    expect(roles.length).toBe(4);
    const roleCodes = roles.map((r) => r.code);
    expect(roleCodes).toContain('owner');
    expect(roleCodes).toContain('supervisor');
    expect(roleCodes).toContain('cashier');
    expect(roleCodes).toContain('stock_clerk');

    const storeProfile = await testDb.app_settings.get('store.profile');
    expect(storeProfile).toBeDefined();
    const profile = JSON.parse(storeProfile!.value_json);
    expect(profile.name).toBe('Toko Sembako Berkah');
  });
});
