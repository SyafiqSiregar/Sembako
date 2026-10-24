import { describe, it, expect } from 'vitest';
import {
  hashPin,
  verifyPin,
  generatePinSalt,
  validatePinFormat,
} from '@/domain/auth/pin';

describe('Domain: PIN Hashing & Verifikasi', () => {
  it('memvalidasi format PIN (hanya angka, minimal 6 digit)', () => {
    expect(validatePinFormat('123456')).toBe(true);
    expect(validatePinFormat('000000')).toBe(true);
    expect(validatePinFormat('12345')).toBe(false); // < 6
    expect(validatePinFormat('12345a')).toBe(false); // ada huruf
    expect(validatePinFormat('')).toBe(false);
  });

  it('menghasilkan salt unik setiap dipanggil', () => {
    const salt1 = generatePinSalt();
    const salt2 = generatePinSalt();
    expect(salt1).not.toBe(salt2);
    expect(salt1.length).toBeGreaterThan(10);
  });

  it('menghasilkan hash deterministik dan memverifikasi dengan tepat', async () => {
    const pin = '241026';
    const salt = generatePinSalt();
    const hash = await hashPin(pin, salt, 1000); // 1000 iterasi untuk kecepatan tes

    const isValid = await verifyPin(pin, hash, salt, 1000);
    expect(isValid).toBe(true);

    const isWrong = await verifyPin('111111', hash, salt, 1000);
    expect(isWrong).toBe(false);
  });
});
