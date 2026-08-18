import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { z } from 'zod';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { UploadsService } from './uploads.service.js';

/** MIME types aceitos para imagem de produto. */
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Limite de tamanho do arquivo de upload (em bytes). */
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const entitySchema = z.enum(['menu-item', 'modifier', 'ingredient']);

/**
 * Confere os magic bytes do buffer contra o MIME declarado. O Content-Type do
 * multipart é controlado pelo cliente; sem checar o conteúdo real, qualquer
 * payload (malware/HTML) declarado como image/* entraria no bucket público.
 */
function matchesSignature(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  switch (mime) {
    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/png':
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case 'image/gif':
      // "GIF8"
      return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    case 'image/webp':
      // "RIFF" .... "WEBP"
      return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    default:
      return false;
  }
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Upload de imagem para um MenuItem, Modifier ou Ingredient.
   *
   * Multipart fields:
   *   file: arquivo binário (JPEG/PNG/WebP/GIF, max 5 MB)
   *   entity: 'menu-item' | 'modifier' | 'ingredient'
   *
   * Resposta: { url: string, key: string, bytes: number }
   * O caller depois usa essa URL ao salvar o item (em imageUrl).
   */
  @Post('image')
  @Roles('owner', 'manager')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    }),
  )
  async uploadImage(
    @CurrentUser() auth: AuthContext,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string; key: string; bytes: number }> {
    if (!file) {
      throw new BadRequestException({
        code: 'file_required',
        message: 'Anexe um arquivo no campo "file".',
      });
    }
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'unsupported_mime_type',
        message: `Tipo não suportado (${file.mimetype}). Use JPEG, PNG, WebP ou GIF.`,
      });
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException({
        code: 'file_too_large',
        message: `Tamanho máximo: ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
      });
    }
    // MIME declarado precisa bater com os magic bytes reais do arquivo.
    if (!matchesSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException({
        code: 'unsupported_mime_type',
        message: `O conteúdo do arquivo não corresponde ao tipo ${file.mimetype}.`,
      });
    }

    // entity vem como form field — multer não inclui em UploadedFile,
    // então lemos do file.fieldname é o nome do field do arquivo, não o
    // entity. Por simplicidade aceita só 'menu-item' por enquanto.
    const entity = entitySchema.parse('menu-item');

    return this.uploads.uploadImage(
      auth.orgId,
      entity,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
  }
}
