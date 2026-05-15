import { Module } from '@nestjs/common';

import { BankImportService } from './bank-import.service.js';
import { DreService } from './dre.service.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';
import { FinancialController } from './financial.controller.js';
import { FinancialDashboardService } from './financial-dashboard.service.js';
import { PayoutsService } from './payouts.service.js';
import { ReconciliationService } from './reconciliation.service.js';

@Module({
  controllers: [FinancialController, ExpensesController],
  providers: [
    FinancialDashboardService,
    BankImportService,
    PayoutsService,
    ReconciliationService,
    ExpensesService,
    DreService,
  ],
  exports: [PayoutsService, ExpensesService, DreService],
})
export class FinancialModule {}
