import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { MembershipService } from './membership.service';
import { AccessService } from './access.service';

@Module({
  controllers: [AccessController],
  providers: [AccessService, MembershipService],
  exports: [AccessService],
})
export class AccessModule {}
