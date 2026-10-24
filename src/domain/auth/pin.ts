/**
 * Domain Auth: PIN Hashing & Verifikasi (PRD.md FR-AUTH-01..02, ARCHITECTURE.md §2)
 * 
 * Aturan:
 * - Menggunakan Web Crypto PBKDF2-SHA256 tanpa dependensi pihak ketiga.
 * - Salt unik per user.
 * - PIN asli tidak pernah disimpan atau dicatat.
 */

export const DEFAULT_PIN_ITERATIONS = 100_000;
export const MIN_PIN_LENGTH = 6;

/**
 * Validasi format PIN (hanya angka, panjang minimum).
 */
export function validatePinFormat(pin: string, minLength: number = MIN_PIN_LENGTH): boolean {
  if (typeof pin !== 'string') return false;
  if (pin.length < minLength) return false;
  return /^\d+$/.test(pin);
}

/**
 * Generate random salt base64 (16 bytes).
 */
export function generatePinSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

/**
 * Hash PIN menggunakan PBKDF2-SHA256.
 */
export async function hashPin(
  pin: string,
  saltBase64: string,
  iterations: number = DEFAULT_PIN_ITERATIONS
): Promise<string> {
  if (!validatePinFormat(pin)) {
    throw new Error(`PIN harus berupa angka minimal ${MIN_PIN_LENGTH} digit`);
  }

  const enc = new TextEncoder();
  const pinKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const saltBytes = base64ToBytes(saltBase64);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    pinKey,
    256 // 32 bytes
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

/**
 * Verifikasi PIN terhadap hash tersimpan.
 */
export async function verifyPin(
  pin: string,
  storedHash: string,
  saltBase64: string,
  iterations: number = DEFAULT_PIN_ITERATIONS
): Promise<boolean> {
  try {
    const computedHash = await hashPin(pin, saltBase64, iterations);
    return timingSafeEqual(computedHash, storedHash);
  } catch {
    return false;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Perbandingan konstan waktu sederhana untuk mencegah timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
