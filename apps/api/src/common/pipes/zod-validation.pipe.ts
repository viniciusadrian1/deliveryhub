import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType, infer as ZodInfer } from 'zod';

@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): ZodInfer<TSchema> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'validation_error',
        issues: result.error.flatten().fieldErrors,
      });
    }

    return result.data;
  }
}
