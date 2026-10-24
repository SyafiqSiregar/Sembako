import React, { useState, useEffect } from 'react';
import { X, Building2, AlertCircle, Loader2 } from 'lucide-react';
import { SupplierService } from '@/services/supplier.service';
import { type Supplier } from '@/data/db';
import { useAuthStore } from '@/features/auth/authStore';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  supplierService: SupplierService;
  onSuccess: () => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  supplier,
  supplierService,
  onSuccess,
}) => {
  const { currentUser } = useAuthStore();
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setContactName(supplier.contact_name || '');
      setPhone(supplier.phone || '');
      setAddress(supplier.address || '');
    } else {
      setName('');
      setContactName('');
      setPhone('');
      setAddress('');
    }
    setErrorMessage(null);
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Nama pemasok wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (supplier) {
        await supplierService.updateSupplier({
          id: supplier.id,
          name: cleanName,
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          updatedBy: currentUser?.id || 'system',
        });
      } else {
        await supplierService.createSupplier({
          name: cleanName,
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          createdBy: currentUser?.id || 'system',
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan data pemasok';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#14463C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold">
                {supplier ? 'Edit Data Pemasok' : 'Tambah Pemasok Baru'}
              </h2>
              <p className="text-xs text-white/80">Kelola informasi distributor & rekanan sembako</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#FBF8F3]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Nama Pemasok / Distributor *
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="Contoh: PT Sumber Pangan Makmur"
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Nama Kontak (Sales / PIC)
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contoh: Pak Joko"
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Nomor Telepon / WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 0812-3456-7890"
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Alamat Gudang / Kantor
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Contoh: Kompleks Pergudangan Daan Mogot Blok A No. 12"
              className="w-full p-3 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14463C]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-md ${
                !isSubmitting && name.trim()
                  ? 'bg-[#14463C] text-white hover:bg-[#0F352E] cursor-pointer'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan Data Pemasok...
                </>
              ) : (
                'Simpan Data Pemasok'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
