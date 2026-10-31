import { SembakoDatabase, type User, type Role } from '@/data/db';
import { hashPin, verifyPin, generatePinSalt, validatePinFormat, MIN_PIN_LENGTH } from '@/domain/auth/pin';
import { type RoleCode } from '@/domain/permissions';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 Menit

export interface CreateUserParams {
  name: string;
  pin: string;
  roleCode: RoleCode;
  createdBy: string;
}

export interface UserSessionData {
  user: User;
  roles: Role[];
  roleCodes: RoleCode[];
}

export interface ActiveUserOption {
  id: string;
  name: string;
  roleCode: RoleCode;
  roleName: string;
}

export class AuthService {
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Membuat pengguna baru beserta salt dan hash PIN.
   */
  async createUser(params: CreateUserParams): Promise<User> {
    if (!validatePinFormat(params.pin)) {
      throw new Error(`PIN harus berupa angka minimal ${MIN_PIN_LENGTH} digit`);
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
      pin_kdf: 'pbkdf2-sha256',
      pin_iterations: 100_000,
      status: 'active',
      failed_attempts: 0,
      created_at: now,
      created_by: params.createdBy,
      updated_at: now,
      updated_by: params.createdBy,
      row_version: 1,
    };

    const role = await this.db.roles.where('code').equals(params.roleCode).first();
    if (!role) {
      throw new Error(`Peran '${params.roleCode}' tidak ditemukan di sistem`);
    }

    await this.db.transaction('rw', [this.db.users, this.db.user_roles, this.db.audit_logs], async () => {
      await this.db.users.add(newUser);
      await this.db.user_roles.add({ user_id: userId, role_id: role.id });

      await this.db.audit_logs.add({
        id: this.idGen.generateId(),
        occurred_at: now,
        user_id: params.createdBy,
        device_id: 'local_device',
        action: 'user.create',
        entity_type: 'user',
        entity_id: userId,
        reason: `Membuat akun baru ${params.name} (${params.roleCode})`,
      });
    });

    return newUser;
  }

  /**
   * Mengambil data user beserta roles dan kode peran.
   */
  async getUserSessionData(userId: string): Promise<UserSessionData> {
    const user = await this.db.users.get(userId);
    if (!user) {
      throw new Error(`Pengguna dengan ID '${userId}' tidak ditemukan`);
    }

    const userRoles = await this.db.user_roles.where('user_id').equals(userId).toArray();
    const roleIds = userRoles.map((ur) => ur.role_id);
    const roles = await this.db.roles.where('id').anyOf(roleIds).toArray();
    const roleCodes = roles.map((r) => r.code as RoleCode);

    return { user, roles, roleCodes };
  }

  /**
   * Memverifikasi PIN login dengan penanganan lockout 5x.
   */
  async verifyLogin(userId: string, pin: string): Promise<UserSessionData> {
    const user = await this.db.users.get(userId);
    if (!user) {
      throw new Error('Pengguna tidak ditemukan');
    }

    if (user.status !== 'active') {
      throw new Error('Akun dinonaktifkan, hubungi pemilik toko');
    }

    const now = this.clock.now();

    // Periksa apakah akun sedang terkunci
    if (user.locked_until && user.locked_until > now) {
      const remainingSeconds = Math.ceil((user.locked_until - now) / 1000);
      throw new Error(
        `Akun terkunci sementara karena salah PIN ${MAX_FAILED_ATTEMPTS} kali. Silakan coba lagi dalam ${remainingSeconds} detik.`
      );
    }

    const isValid = await verifyPin(pin, user.pin_hash, user.pin_salt, user.pin_iterations);

    if (!isValid) {
      const newFailedAttempts = (user.failed_attempts || 0) + 1;
      const isNowLocked = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = isNowLocked ? now + LOCKOUT_DURATION_MS : undefined;

      await this.db.transaction('rw', [this.db.users, this.db.audit_logs], async () => {
        await this.db.users.update(userId, {
          failed_attempts: newFailedAttempts,
          locked_until: lockedUntil,
          updated_at: now,
        });

        if (isNowLocked) {
          await this.db.audit_logs.add({
            id: this.idGen.generateId(),
            occurred_at: now,
            user_id: userId,
            device_id: 'local_device',
            action: 'auth.lockout',
            entity_type: 'user',
            entity_id: userId,
            reason: `Akun dikunci sementara karena salah PIN ${MAX_FAILED_ATTEMPTS} kali berturut-turut`,
          });
        }
      });

      if (isNowLocked) {
        throw new Error(
          `PIN salah. Akun Anda dikunci sementara selama 5 menit karena salah ${MAX_FAILED_ATTEMPTS} kali berturut-turut.`
        );
      }

      const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedAttempts;
      throw new Error(`PIN salah. Sisa kesempatan sebelum akun terkunci: ${remainingAttempts} kali.`);
    }

    // PIN benar: Reset failed_attempts & update last_login_at
    await this.db.users.update(userId, {
      failed_attempts: 0,
      locked_until: undefined,
      last_login_at: now,
      updated_at: now,
    });

    return this.getUserSessionData(userId);
  }

  /**
   * Mengambil daftar semua pengguna berstatus aktif beserta perannya untuk fitur ganti pengguna (FR-AUTH-01).
   */
  async listActiveUsers(): Promise<ActiveUserOption[]> {
    const users = await this.db.users.where('status').equals('active').toArray();
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
        roleCode: (r?.code as RoleCode) || 'cashier',
        roleName: r?.name || 'Kasir',
      };
    });
  }
}
