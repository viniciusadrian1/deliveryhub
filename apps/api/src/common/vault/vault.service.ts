import { Injectable, Logger } from '@nestjs/common';

import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Vault simples: armazena segredos cifrados na tabela `vault_secret`,
 * indexados por `name`. Pensado para tokens OAuth de plataformas e
 * credenciais sensíveis que não devem viver em `.env`.
 *
 * Roadmap: trocar a implementação por AWS Secrets Manager ou HashiCorp
 * Vault quando justificar — a interface se mantém.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async write(
    name: string,
    value: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const ciphertext = this.crypto.encrypt(JSON.stringify(value));
    await this.prisma.vaultSecret.upsert({
      where: { name },
      update: {
        ciphertext,
        metadata: (metadata as never) ?? undefined,
      },
      create: {
        name,
        ciphertext,
        metadata: (metadata as never) ?? undefined,
      },
    });
  }

  async read<T extends Record<string, unknown>>(name: string): Promise<T | null> {
    const secret = await this.prisma.vaultSecret.findUnique({ where: { name } });
    if (!secret) return null;
    try {
      return JSON.parse(this.crypto.decrypt(secret.ciphertext)) as T;
    } catch (err) {
      this.logger.error({ err, name }, 'vault_decrypt_failed');
      return null;
    }
  }

  async delete(name: string): Promise<void> {
    await this.prisma.vaultSecret.delete({ where: { name } }).catch(() => {
      // delete inexistente é no-op
    });
  }
}
