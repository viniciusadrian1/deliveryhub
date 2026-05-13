import { Global, Module } from '@nestjs/common';

import { VaultService } from './vault.service.js';

@Global()
@Module({
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
