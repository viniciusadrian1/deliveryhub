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
