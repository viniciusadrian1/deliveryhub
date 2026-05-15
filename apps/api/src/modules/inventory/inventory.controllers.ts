import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthContext } from '../../common/auth/auth-context.js';
import {
  balanceQuerySchema,
  createIngredientSchema,
  createPurchaseSchema,
  createStockAdjustmentSchema,
  createSupplierSchema,
  listMovementsQuerySchema,
  listPurchasesQuerySchema,
  setMenuItemRecipeSchema,
  setSubRecipeSchema,
  updateIngredientSchema,
  updateSupplierSchema,
  type BalanceQuery,
  type CreateIngredientInput,
  type CreatePurchaseInput,
  type CreateStockAdjustmentInput,
  type CreateSupplierInput,
  type ListMovementsQuery,
  type ListPurchasesQuery,
  type SetMenuItemRecipeInput,
  type SetSubRecipeInput,
  type UpdateIngredientInput,
  type UpdateSupplierInput,
} from './dto/inventory.dto.js';
import { IngredientsService } from './ingredients.service.js';
import { PurchasesService } from './purchases.service.js';
import { RecipesService } from './recipes.service.js';
import { StockService } from './stock.service.js';
import { SuppliersService } from './suppliers.service.js';

// =====================================================================
// Suppliers
// =====================================================================

@Controller('inventory/suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.suppliers.list(auth, { includeArchived: includeArchived === 'true' });
  }

  @Get(':id')
  findOne(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.suppliers.findOne(auth, id);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(201)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createSupplierSchema)) body: CreateSupplierInput,
  ) {
    return this.suppliers.create(auth, body);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) body: UpdateSupplierInput,
  ) {
    return this.suppliers.update(auth, id, body);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async archive(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.suppliers.archive(auth, id);
  }
}

// =====================================================================
// Ingredients (raw + sub-recipes)
// =====================================================================

const listIngredientsQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  kind: z.enum(['raw', 'sub_recipe']).optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

@Controller('inventory/ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listIngredientsQuerySchema))
    query: z.infer<typeof listIngredientsQuerySchema>,
  ) {
    return this.ingredients.list(auth, query);
  }

  @Get(':id')
  findOne(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.ingredients.findOne(auth, id);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(201)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createIngredientSchema)) body: CreateIngredientInput,
  ) {
    return this.ingredients.create(auth, body);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateIngredientSchema)) body: UpdateIngredientInput,
  ) {
    return this.ingredients.update(auth, id, body);
  }

  @Delete(':id')
  @Roles('owner', 'manager')
  @HttpCode(204)
  async archive(@CurrentUser() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.ingredients.archive(auth, id);
  }
}

// =====================================================================
// Purchases
// =====================================================================

@Controller('inventory/purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listPurchasesQuerySchema)) query: ListPurchasesQuery,
  ) {
    return this.purchases.list(auth, query);
  }

  @Post()
  @Roles('owner', 'manager')
  @HttpCode(201)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createPurchaseSchema)) body: CreatePurchaseInput,
  ) {
    return this.purchases.create(auth, body);
  }
}

// =====================================================================
// Stock (balance + movements + manual adjustments)
// =====================================================================

@Controller('inventory/stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('balance')
  balance(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(balanceQuerySchema)) query: BalanceQuery,
  ) {
    return this.stock.balanceByIngredient(auth, query);
  }

  @Get('movements')
  movements(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(listMovementsQuerySchema)) query: ListMovementsQuery,
  ) {
    return this.stock.listMovements(auth, query);
  }

  @Post('adjustments')
  @Roles('owner', 'manager')
  @HttpCode(201)
  adjust(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createStockAdjustmentSchema))
    body: CreateStockAdjustmentInput,
  ) {
    return this.stock.createAdjustment(auth, body);
  }
}

// =====================================================================
// Recipes (assign components to MenuItem or sub-recipe)
// =====================================================================

@Controller('inventory/recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get('menu-item/:id')
  getMenuItemRecipe(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.recipes.getMenuItemRecipe(auth, id);
  }

  @Put('menu-item/:id')
  @Roles('owner', 'manager')
  setMenuItemRecipe(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setMenuItemRecipeSchema)) body: SetMenuItemRecipeInput,
  ) {
    return this.recipes.setMenuItemRecipe(auth, id, body);
  }

  @Get('sub-recipe/:id')
  getSubRecipe(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.recipes.getSubRecipe(auth, id);
  }

  @Put('sub-recipe/:id')
  @Roles('owner', 'manager')
  setSubRecipe(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setSubRecipeSchema)) body: SetSubRecipeInput,
  ) {
    return this.recipes.setSubRecipe(auth, id, body);
  }
}
