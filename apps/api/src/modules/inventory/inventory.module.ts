import { Module } from '@nestjs/common';

import {
  IngredientsController,
  PurchasesController,
  RecipesController,
  StockController,
  SuppliersController,
} from './inventory.controllers.js';
import { IngredientsService } from './ingredients.service.js';
import { PurchasesService } from './purchases.service.js';
import { RecipeCostService } from './recipe-cost.service.js';
import { RecipesService } from './recipes.service.js';
import { StockConsumptionService } from './stock-consumption.service.js';
import { StockService } from './stock.service.js';
import { SuppliersService } from './suppliers.service.js';

/**
 * Inventory: insumos, sub-receitas, fornecedores, compras, estoque.
 *
 * `StockConsumptionService` e `RecipeCostService` são exportados pra outros
 * módulos (OrdersService usa o primeiro pra dar baixa quando pedido vai
 * pra delivered; menu/pricing podem usar o segundo).
 *
 * Notas sobre forwardRef:
 *   - IngredientsService -> RecipeCostService (update de custo dispara cascata)
 *   - PurchasesService   -> RecipeCostService (compra que mexe no custo médio
 *                          também cascateia)
 *   Ambos importam RecipeCostService via forwardRef pra evitar ciclo na
 *   resolução de DI (RecipeCostService só precisa do PrismaService).
 */
@Module({
  controllers: [
    SuppliersController,
    IngredientsController,
    PurchasesController,
    StockController,
    RecipesController,
  ],
  providers: [
    SuppliersService,
    IngredientsService,
    PurchasesService,
    StockService,
    RecipesService,
    RecipeCostService,
    StockConsumptionService,
  ],
  exports: [StockConsumptionService, RecipeCostService],
})
export class InventoryModule {}
