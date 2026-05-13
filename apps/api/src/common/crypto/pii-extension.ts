import type { CryptoService } from './crypto.service.js';

/**
 * Mapa de campos PII por model que devem ser cifrados em repouso.
 * Cifragem é aplicada via Prisma `$extends`:
 *   - escrita: transforma plaintext → ciphertext nos campos listados
 *   - leitura: transforma ciphertext → plaintext (sempre que possível)
 */
const PII_FIELDS: Record<string, readonly string[]> = {
  organization: ['document'],
  user: ['phone'],
};

const WRITE_OPS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
]);

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
]);

function encryptFields(
  obj: Record<string, unknown>,
  fields: readonly string[],
  crypto: CryptoService,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    const value = out[f];
    if (typeof value === 'string' && value.length > 0 && !crypto.isCiphertext(value)) {
      out[f] = crypto.encrypt(value);
    }
  }
  return out;
}

function decryptFields(
  obj: Record<string, unknown>,
  fields: readonly string[],
  crypto: CryptoService,
): void {
  for (const f of fields) {
    const value = obj[f];
    if (typeof value === 'string' && crypto.isCiphertext(value)) {
      try {
        obj[f] = crypto.decrypt(value);
      } catch {
        // Mantém o ciphertext em caso de chave incompatível em vez de quebrar a query.
      }
    }
  }
}

function transformWriteArgs(
  args: Record<string, unknown>,
  fields: readonly string[],
  crypto: CryptoService,
): Record<string, unknown> {
  const next = { ...args };

  const data = next.data;
  if (Array.isArray(data)) {
    next.data = data.map((row) =>
      row && typeof row === 'object'
        ? encryptFields(row as Record<string, unknown>, fields, crypto)
        : row,
    );
  } else if (data && typeof data === 'object') {
    next.data = encryptFields(data as Record<string, unknown>, fields, crypto);
  }

  const create = next.create;
  if (create && typeof create === 'object') {
    next.create = encryptFields(create as Record<string, unknown>, fields, crypto);
  }

  return next;
}

function transformResult(result: unknown, fields: readonly string[], crypto: CryptoService): void {
  if (Array.isArray(result)) {
    for (const row of result) {
      if (row && typeof row === 'object') {
        decryptFields(row as Record<string, unknown>, fields, crypto);
      }
    }
  } else if (result && typeof result === 'object') {
    decryptFields(result as Record<string, unknown>, fields, crypto);
  }
}

export function buildPiiExtensionConfig(crypto: CryptoService) {
  return Object.fromEntries(
    Object.entries(PII_FIELDS).map(([model, fields]) => [
      model,
      {
        async $allOperations({
          operation,
          args,
          query,
        }: {
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          const nextArgs = WRITE_OPS.has(operation)
            ? transformWriteArgs(args, fields, crypto)
            : args;

          const result = await query(nextArgs);

          if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
            transformResult(result, fields, crypto);
          }

          return result;
        },
      },
    ]),
  );
}
