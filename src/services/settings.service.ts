import { SembakoDatabase, type User, type Role } from '@/data/db';
import { hashPin, generatePinSalt } from '@/domain/auth/pin';
import { Clock, defaultClock, IdGenerator, defaultIdGenerator } from '@/domain/time';

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
  maxDiscountPercent: number;
  autoLockMinutes: number;
  expiryWarningDays: number;
}

export interface UserItem {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  roleCode: string;
  roleName: string;
  failedAttempts: number;
  lastLoginAt?: number;
  createdAt: number;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'Toko Sembako Berkah',
  storeAddress: 'Jl. Pasar Baru No. 12, Jakarta',
  storePhone: '0812-3456-7890',
  receiptFooter: 'Terima kasih atas kunjungan Anda!',
  maxDiscountPercent: 5,
  autoLockMinutes: 15,
  expiryWarningDays: 30,
};

export class SettingsService {
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Mengambil pengaturan toko dari tabel app_settings (FR-SET-01..03, AC-36).
   */
  async getStoreSettings(): Promise<StoreSettings> {
    const settingRec = await this.db.app_settings.get('store_settings');
    if (!settingRec) {
      return DEFAULT_STORE_SETTINGS;
    }
    try {
      return { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(settingRec.value_json) };
    } catch {
      return DEFAULT_STORE_SETTINGS;
    }
  }

  /**
   * Memperbarui pengaturan toko dengan pencatatan audit log (FR-SET-01..03).
   */
  async updateStoreSettings(newSettings: Partial<StoreSettings>, actorId: string): Promise<void> {
    const current = await this.getStoreSettings();
    const updated = { ...current, ...newSettings };
    const now = this.clock.now();

    await this.db.app_settings.put({
      key: 'store_settings',
      value_json: JSON.stringify(updated),
      updated_at: now,
      updated_by: actorId,
    });

    await this.db.audit_logs.add({
      id: this.idGen.generateId(),
      occurred_at: now,
      user_id: actorId,
      device_id: 'TABLET1',
      action: 'settings.update',
      entity_type: 'app_settings',
      entity_id: 'store_settings',
      before_json: JSON.stringify(current),
      after_json: JSON.stringify(updated),
      reason: 'Pembaruan pengaturan identitas toko dan kebijakan sistem',
    });
  }

  /**
   * Mengambil daftar seluruh pengguna dan peran mereka (FR-SET-04).
   */
  async listUsers(): Promise<UserItem[]> {
    const users = await this.db.users.toArray();
    const roles = await this.db.roles.toArray();
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    const userRoles = await this.db.user_roles.toArray();
    const userRoleMap = new Map<string, Role>();

    for (const ur of userRoles) {
      const r = roleMap.get(ur.role_id);
      if (r) {
        userRoleMap.set(ur.user_id, r);
      }
    }

    return users.map((u) => {
      const r = userRoleMap.get(u.id);
      return {
        id: u.id,
        name: u.name,
        status: u.status,
        roleCode: r?.code || 'cashier',
        roleName: r?.name || 'Kasir',
        failedAttempts: u.failed_attempts,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
      };
    });
  }

  /**
   * Membuat pengguna baru dengan PIN terenkripsi PBKDF2 (FR-SET-04, AC-36).
   */
  async createUser(params: {
    name: string;
    pin: string;
    roleCode: 'owner' | 'supervisor' | 'cashier' | 'stock_clerk';
    actorId: string;
  }): Promise<UserItem> {
    if (!params.name.trim()) {
      throw new Error('Nama pengguna tidak boleh kosong');
    }
    if (!/^\d{6}$/.test(params.pin)) {
      throw new Error('PIN harus terdiri dari tepat 6 digit angka');
    }

    const role = await this.db.roles.where('code').equals(params.roleCode).first();
    if (!role) {
      throw new Error(`Peran '${params.roleCode}' tidak ditemukan`);
    }

    const salt = generatePinSalt();
    const pinHash = await hashPin(params.pin, salt);
    const userId = this.idGen.generateId();
    const now = this.clock.now();

    const newUser: User = {
      id: userId,
      name: params.name.trim(),
      pin_hash: pinHash,
      pin_salt: salt,
      pin_kdf: 'pbkdf2',
      pin_iterations: 100000,
      status: 'active',
      failed_attempts: 0,
      created_at: now,
      created_by: params.actorId,
      updated_at: now,
      updated_by: params.actorId,
      row_version: 1,
    };

    await this.db.transaction('rw', [this.db.users, this.db.user_roles, this.db.audit_logs], async () => {
      await this.db.users.add(newUser);
      await this.db.user_roles.add({
        user_id: userId,
        role_id: role.id,
      });

      await this.db.audit_logs.add({
        id: this.idGen.generateId(),
        occurred_at: now,
        user_id: params.actorId,
        device_id: 'TABLET1',
        action: 'user.create',
        entity_type: 'users',
        entity_id: userId,
        after_json: JSON.stringify({ name: newUser.name, role: role.code }),
        reason: `Penambahan pengguna baru: ${newUser.name}`,
      });
    });

    return {
      id: userId,
      name: newUser.name,
      status: newUser.status,
      roleCode: role.code,
      roleName: role.name,
      failedAttempts: 0,
      createdAt: now,
    };
  }

  /**
   * Reset PIN pengguna (FR-SET-04).
   */
  async resetUserPin(userId: string, newPin: string, actorId: string): Promise<void> {
    if (!/^\d{6}$/.test(newPin)) {
      throw new Error('PIN baru harus terdiri dari 6 digit angka');
    }

    const user = await this.db.users.get(userId);
    if (!user) {
      throw new Error('Pengguna tidak ditemukan');
    }

    const salt = generatePinSalt();
    const pinHash = await hashPin(newPin, salt);
    const now = this.clock.now();

    await this.db.users.update(userId, {
      pin_hash: pinHash,
      pin_salt: salt,
      failed_attempts: 0,
      locked_until: undefined,
      updated_at: now,
      updated_by: actorId,
    });

    await this.db.audit_logs.add({
      id: this.idGen.generateId(),
      occurred_at: now,
      user_id: actorId,
      device_id: 'TABLET1',
      action: 'user.reset_pin',
      entity_type: 'users',
      entity_id: userId,
      reason: `Reset PIN untuk pengguna: ${user.name}`,
    });
  }

  /**
   * Mengubah status aktif / nonaktif pengguna (FR-SET-04).
   */
  async toggleUserStatus(userId: string, actorId: string): Promise<'active' | 'disabled'> {
    const user = await this.db.users.get(userId);
    if (!user) {
      throw new Error('Pengguna tidak ditemukan');
    }

    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    const now = this.clock.now();

    await this.db.users.update(userId, {
      status: newStatus,
      updated_at: now,
      updated_by: actorId,
    });

    await this.db.audit_logs.add({
      id: this.idGen.generateId(),
      occurred_at: now,
      user_id: actorId,
      device_id: 'TABLET1',
      action: 'user.status_toggle',
      entity_type: 'users',
      entity_id: userId,
      before_json: JSON.stringify({ status: user.status }),
      after_json: JSON.stringify({ status: newStatus }),
      reason: `Mengubah status pengguna ${user.name} menjadi ${newStatus}`,
    });

    return newStatus;
  }
}
