import { Module } from '@nestjs/common';

import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class OrganizationsModule {}
