import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@deliveryhub/db';

import { CryptoService } from '../crypto/crypto.service.js';
import { buildPiiExtensionConfig } from '../crypto/pii-extension.js';

export type EncryptedClient = ReturnType<PrismaService['buildEncryptedClient']>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly enc: EncryptedClient;

  constructor(private readonly crypto: CryptoService) {
    super();
    this.enc = this.buildEncryptedClient();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  buildEncryptedClient() {
    return this.$extends({
      name: 'pii-encryption',
      query: buildPiiExtensionConfig(this.crypto) as never,
    });
  }
}
