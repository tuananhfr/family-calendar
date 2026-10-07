import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { JoinRequestsService } from './join-requests.service';
import { MeInvitationsController } from './me-invitations.controller';
import { MeInvitationsService } from './me-invitations.service';

@Module({
  imports: [AccessModule, DeliveryModule],
  controllers: [InvitesController, MeInvitationsController],
  providers: [InvitesService, JoinRequestsService, MeInvitationsService],
  exports: [InvitesService],
})
export class InvitesModule {}
