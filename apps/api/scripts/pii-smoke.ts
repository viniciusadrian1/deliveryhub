import 'dotenv/config';

import { PrismaClient } from '@deliveryhub/db';

import { CryptoService } from '../src/common/crypto/crypto.service.js';
import { buildPiiExtensionConfig } from '../src/common/crypto/pii-extension.js';

async function main() {
  const crypto = new CryptoService();
  const raw = new PrismaClient();
  const enc = raw.$extends({
    name: 'pii-smoke',
    query: buildPiiExtensionConfig(crypto) as never,
  });

  const email = `pii-smoke-${Date.now()}@local.io`;

  console.warn('\n=== via enc: create user with phone ===');
  const created = await enc.user.create({
    data: {
      email,
      passwordHash: 'placeholder',
      name: 'PII Test',
      phone: '+5511999998888',
    },
  });
  console.warn('returned phone (should be plaintext):', created.phone);

  console.warn('\n=== via raw: SELECT phone (should be ciphertext) ===');
  const raw_row = await raw.$queryRawUnsafe<{ phone: string | null }[]>(
    `SELECT phone FROM "user" WHERE email = '${email}'`,
  );
  console.warn('raw stored phone:', raw_row[0]?.phone);

  console.warn('\n=== via enc: findUnique (should decrypt back) ===');
  const fetched = await enc.user.findUnique({ where: { email } });
  console.warn('decrypted phone:', fetched?.phone);

  console.warn('\n=== cleanup ===');
  await enc.user.delete({ where: { email } });
  console.warn('deleted');

  await raw.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
