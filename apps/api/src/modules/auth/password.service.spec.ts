import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password to an argon2id phc string', async () => {
    const result = await service.hash('s3nha-super-segura');
    expect(result).toMatch(/^\$argon2id\$/);
  });

  it('verifies a correct password', async () => {
    const hashed = await service.hash('s3nha-super-segura');
    await expect(service.verify(hashed, 's3nha-super-segura')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hashed = await service.hash('s3nha-super-segura');
    await expect(service.verify(hashed, 'errada')).resolves.toBe(false);
  });

  it('produces a distinct hash for the same plaintext (random salt)', async () => {
    const a = await service.hash('mesma-senha');
    const b = await service.hash('mesma-senha');
    expect(a).not.toBe(b);
  });
});
