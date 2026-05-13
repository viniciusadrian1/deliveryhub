import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { loadEnv } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const VERSION = 'v1';

/**
 * Cifragem simétrica AES-256-GCM para PII em repouso.
 *
 * Formato do ciphertext: `v1:<iv-base64url>:<ciphertext+tag-base64url>`
 * - prefixo `v1:` permite migração de algoritmo no futuro
 * - GCM inclui auth tag concatenada ao ciphertext
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const env = loadEnv();
    const decoded = Buffer.from(env.VAULT_MASTER_KEY, 'base64');
    // Aceita master key em base64 (32 bytes) ou plain UTF-8 (>=32 bytes).
    this.key =
      decoded.length === 32 ? decoded : Buffer.from(env.VAULT_MASTER_KEY, 'utf-8').subarray(0, 32);

    if (this.key.length < 32) {
      throw new Error('VAULT_MASTER_KEY must decode to at least 32 bytes');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([ciphertext, authTag]);
    return `${VERSION}:${iv.toString('base64url')}:${payload.toString('base64url')}`;
  }

  decrypt(token: string): string {
    const [version, ivB64, payloadB64] = token.split(':');
    if (version !== VERSION || !ivB64 || !payloadB64) {
      throw new Error('invalid_ciphertext_format');
    }
    const iv = Buffer.from(ivB64, 'base64url');
    const payload = Buffer.from(payloadB64, 'base64url');
    if (payload.length < AUTH_TAG_BYTES) {
      throw new Error('invalid_ciphertext_payload');
    }
    const authTag = payload.subarray(payload.length - AUTH_TAG_BYTES);
    const ciphertext = payload.subarray(0, payload.length - AUTH_TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
  }

  /**
   * Detecta valores já cifrados (idempotência ao reaplicar a extensão).
   */
  isCiphertext(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(`${VERSION}:`);
  }
}
