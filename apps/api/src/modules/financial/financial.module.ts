import { Module } from '@nestjs/common';

import { BankImportService } from './bank-import.service.js';
import { FinancialController } from './financial.controller.js';
import { FinancialDashboardService } from './financial-dashboard.service.js';
import { PayoutsService } from './payouts.service.js';
import { ReconciliationService } from './reconciliation.service.js';

@Module({
  controllers: [FinancialController],
  providers: [
    FinancialDashboardService,
    BankImportService,
    PayoutsService,
    ReconciliationService,
  ],
  exports: [PayoutsService],
})
export class FinancialModule {}
