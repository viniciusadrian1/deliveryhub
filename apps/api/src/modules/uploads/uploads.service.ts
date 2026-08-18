import { randomUUID } from 'node:crypto';

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnv, type Env } from '../../config/env.js';

/**
 * Storage abstraction. Hoje suporta S3-compat (R2, S3, Supabase Storage,
 * MinIO). Quando as env vars `STORAGE_*` estão todas preenchidas, o
 * upload vai pro bucket. Caso contrário, levanta 503 com mensagem clara.
 *
 * Como configurar Cloudflare R2:
 *   1. https://dash.cloudflare.com/?to=/:account/r2 → Create bucket
 *      (nome ex.: "deliveryhub-uploads")
 *   2. "Settings" → "Public access" → habilita o `pub-<id>.r2.dev` ou
 *      conecta domínio próprio
 *   3. R2 → "Manage R2 API Tokens" → "Create API token" → escopo
 *      "Object Read & Write" no bucket
 *   4. Preencha no .env:
 *        STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
 *        STORAGE_BUCKET=deliveryhub-uploads
 *        STORAGE_ACCESS_KEY_ID=<token-access-key>
 *        STORAGE_SECRET_ACCESS_KEY=<token-secret>
 *        STORAGE_PUBLIC_URL=https://pub-<id>.r2.dev
 *
 * S3 AWS: igual, mas STORAGE_ENDPOINT pode ser omitido (SDK usa default
 * por região); STORAGE_REGION precisa ser a region do bucket.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly env: Env;
  private readonly client: S3Client | null;

  constructor() {
    this.env = loadEnv();
    if (this.isConfigured()) {
      this.client = new S3Client({
        region: this.env.STORAGE_REGION,
        endpoint: this.env.STORAGE_ENDPOINT,
        credentials: {
          accessKeyId: this.env.STORAGE_ACCESS_KEY_ID!,
          secretAccessKey: this.env.STORAGE_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true, // R2 + MinIO funcionam melhor com path-style
      });
      this.logger.log(`Storage configured: bucket=${this.env.STORAGE_BUCKET}`);
    } else {
      this.client = null;
      this.logger.warn(
        'Storage NOT configured — uploads will return 503. Set STORAGE_* envs.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.env.STORAGE_ENDPOINT &&
        this.env.STORAGE_BUCKET &&
        this.env.STORAGE_ACCESS_KEY_ID &&
        this.env.STORAGE_SECRET_ACCESS_KEY &&
        this.env.STORAGE_PUBLIC_URL,
    );
  }

  /**
   * Upload de imagem. Devolve URL pública.
   *
   * @param organizationId Usado pra namespacing (`org/<id>/...`) — isola
   *                       uploads de tenants diferentes mesmo no mesmo bucket.
   * @param entity         Pasta lógica (`menu-item`, `modifier`, `ingredient`).
   * @param buffer         Bytes do arquivo.
   * @param mimeType       MIME tipo (validado pelo controller).
   * @param originalName   Nome original — usado só pra extrair extensão.
   */
  async uploadImage(
    organizationId: string,
    entity: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string,
  ): Promise<{ url: string; key: string; bytes: number }> {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'storage_not_configured',
        message:
          'Storage não configurado. Preencha STORAGE_* no .env e reinicie a API.',
      });
    }

    // Extensao derivada do mimeType (ja validado por magic-byte no controller), NAO do
    // nome do arquivo do cliente — fecha o vetor de injecao de extensao no object-key.
    const ext =
      { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[
        mimeType
      ] ?? 'bin';
    const key = `org/${organizationId}/${entity}/${randomUUID()}.${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.env.STORAGE_BUCKET!,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          // CacheControl longo — uploads são imutáveis (UUID na key).
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      this.logger.error({ err, key }, 'storage_upload_failed');
      throw new ServiceUnavailableException({
        code: 'storage_upload_failed',
        message: 'Não foi possível enviar o arquivo. Tente de novo.',
      });
    }

    const publicBase = this.env.STORAGE_PUBLIC_URL!.replace(/\/$/, '');
    const url = `${publicBase}/${key}`;
    return { url, key, bytes: buffer.length };
  }
}
