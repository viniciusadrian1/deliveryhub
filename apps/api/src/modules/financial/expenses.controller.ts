import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import { DreService } from './dre.service.js';
import {
  createExpenseSchema,
  dreQuerySchema,
  listExpensesQuerySchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type DreQuery,
  type ListExpensesQuery,
  type UpdateExpenseInput,
} from './dto/expense.dto.js';
import { ExpensesService } from './expenses.service.js';

@Controller('financial/expenses')
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly dre: DreService,
  ) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listExpensesQuerySchema)) query: ListExpensesQuery,
  ) {
    return this.expenses.list(auth, query);
  }

  @Get('dre')
  dreReport(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(dreQuerySchema)) query: DreQuery,
  ) {
    return this.dre.compute(auth, query);
  }

  @Post()
  @Roles('owner', 'manager', 'financial')
  @HttpCode(201)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput,
  ) {
    return this.expenses.create(auth, body);
  }

  @Patch(':id')
  @Roles('owner', 'manager', 'financial')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) body: UpdateExpenseInput,
  ) {
    return this.expenses.update(auth, id, body);
  }

  @Delete(':id')
  @Roles('owner', 'manager', 'financial')
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.expenses.remove(auth, id);
  }
}
