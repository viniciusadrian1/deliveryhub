import { beforeAll, describe, expect, it } from 'vitest';

import { CryptoService } from './crypto.service.js';

describe('CryptoService', () => {
  let crypto: CryptoService;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MODE = 'api';
    process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:55432/x?schema=public';
    process.env.REDIS_URL ??= 'redis://localhost:56379';
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-32-bytes-min-aaaa';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-32-bytes-min-bbbb';
    process.env.VAULT_MASTER_KEY = 'test-vault-master-key-exactly-32-byteX';

    crypto = new CryptoService();
  });

  it('round-trips plaintext through encrypt -> decrypt', () => {
    const plain = 'CNPJ 12.345.678/0001-99';
    const ciphered = crypto.encrypt(plain);
    expect(ciphered).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(ciphered).not.toContain(plain);
    expect(crypto.decrypt(ciphered)).toBe(plain);
  });

  it('produces a different ciphertext for the same plaintext (random IV)', () => {
    const plain = 'phone-+5511999998888';
    const a = crypto.encrypt(plain);
    const b = crypto.encrypt(plain);
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe(plain);
    expect(crypto.decrypt(b)).toBe(plain);
  });

  it('rejects a tampered ciphertext with auth-tag failure', () => {
    const ciphered = crypto.encrypt('sensitive');
    const [v, iv, payload] = ciphered.split(':');
    const tampered = `${v}:${iv}:${payload!.slice(0, -2)}AA`;
    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('rejects malformed input', () => {
    expect(() => crypto.decrypt('not-a-token')).toThrow('invalid_ciphertext_format');
    expect(() => crypto.decrypt('v0:abc:def')).toThrow('invalid_ciphertext_format');
  });

  it('isCiphertext detects already-encrypted values', () => {
    expect(crypto.isCiphertext('v1:abc:def')).toBe(true);
    expect(crypto.isCiphertext('plain string')).toBe(false);
    expect(crypto.isCiphertext(null)).toBe(false);
    expect(crypto.isCiphertext(undefined)).toBe(false);
  });
});
