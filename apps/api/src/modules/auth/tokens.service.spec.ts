import { JwtService } from '@nestjs/jwt';
import { beforeAll, describe, expect, it } from 'vitest';

import { TokensService } from './tokens.service.js';

describe('TokensService', () => {
  let tokens: TokensService;

  beforeAll(() => {
    // env é lido pelo loadEnv() — vitest precisa das mesmas vars que o app.
    // Setamos defaults seguros antes do construtor.
    process.env.NODE_ENV = 'test';
    process.env.MODE = 'api';
    process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:55432/x?schema=public';
    process.env.REDIS_URL ??= 'redis://localhost:56379';
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-32-bytes-min-aaaa';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-32-bytes-min-bbbb';
    process.env.VAULT_MASTER_KEY ??= 'test-vault-master-key-32-bytes-cccc';

    tokens = new TokensService(new JwtService());
  });

  it('signs and verifies an access token round trip', async () => {
    const { token, expiresAt } = await tokens.signAccessToken({
      sub: 'user-1',
      orgId: 'org-1',
      role: 'owner',
    });

    expect(token).toMatch(/^eyJ/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const decoded = await tokens.verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.orgId).toBe('org-1');
    expect(decoded.role).toBe('owner');
  });

  it('rejects a tampered access token', async () => {
    const { token } = await tokens.signAccessToken({ sub: 'u', orgId: 'o', role: 'staff' });
    const tampered = `${token.slice(0, -4)}AAAA`;
    await expect(tokens.verifyAccessToken(tampered)).rejects.toThrow();
  });

  it('issues a refresh token with deterministic hash', () => {
    const issued = tokens.issueRefreshToken();
    expect(issued.plainToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(issued.tokenHash).toHaveLength(64);
    expect(tokens.hashRefreshToken(issued.plainToken)).toBe(issued.tokenHash);
  });

  it('produces distinct refresh tokens per call', () => {
    const a = tokens.issueRefreshToken();
    const b = tokens.issueRefreshToken();
    expect(a.plainToken).not.toBe(b.plainToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});
