import { SembakoDatabase, type Supplier } from '@/data/db';
import { type Clock, type IdGenerator, defaultClock, defaultIdGenerator } from '@/domain/time';

export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  createdBy: string;
}

export interface UpdateSupplierInput {
  id: string;
  name?: string;
  contactName?: string;
  phone?: string;
  address?: string;
  updatedBy: string;
}

export class SupplierService {
  constructor(
    private db: SembakoDatabase,
    private clock: Clock = defaultClock,
    private idGen: IdGenerator = defaultIdGenerator
  ) {}

  /**
   * Menambah pemasok baru (FR-SUP-01).
   */
  async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Nama pemasok tidak boleh kosong');
    }

    const now = this.clock.now();
    const supplier: Supplier = {
      id: this.idGen.generateId(),
      name,
      contact_name: input.contactName?.trim(),
      phone: input.phone?.trim(),
      address: input.address?.trim(),
      active: 1,
      created_at: now,
      created_by: input.createdBy,
      updated_at: now,
      updated_by: input.createdBy,
    };

    await this.db.suppliers.add(supplier);
    return supplier;
  }

  /**
   * Mengambil daftar pemasok aktif.
   */
  async listSuppliers(activeOnly: boolean = true): Promise<Supplier[]> {
    if (activeOnly) {
      return this.db.suppliers.where('active').equals(1).toArray();
    }
    return this.db.suppliers.toArray();
  }

  /**
   * Mengambil detail pemasok berdasarkan ID.
   */
  async getSupplierById(id: string): Promise<Supplier | undefined> {
    return this.db.suppliers.get(id);
  }

  /**
   * Memperbarui informasi pemasok.
   */
  async updateSupplier(input: UpdateSupplierInput): Promise<Supplier> {
    const existing = await this.db.suppliers.get(input.id);
    if (!existing) {
      throw new Error('Pemasok tidak ditemukan');
    }

    const now = this.clock.now();
    const updateData: Partial<Supplier> = {
      updated_at: now,
      updated_by: input.updatedBy,
    };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('Nama pemasok tidak boleh kosong');
      updateData.name = name;
    }
    if (input.contactName !== undefined) updateData.contact_name = input.contactName.trim();
    if (input.phone !== undefined) updateData.phone = input.phone.trim();
    if (input.address !== undefined) updateData.address = input.address.trim();

    await this.db.suppliers.update(input.id, updateData);
    return (await this.db.suppliers.get(input.id))!;
  }

  /**
   * Mengarsipkan pemasok (FR-SUP-01: pemasok tidak dihapus fisik).
   */
  async archiveSupplier(id: string, updatedBy: string): Promise<void> {
    const existing = await this.db.suppliers.get(id);
    if (!existing) {
      throw new Error('Pemasok tidak ditemukan');
    }

    const now = this.clock.now();
    await this.db.suppliers.update(id, {
      active: 0,
      updated_at: now,
      updated_by: updatedBy,
    });
  }
}
