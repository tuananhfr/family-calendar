import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/http/rate-limit';
import { AccessModule } from '../access/access.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { AccountLoginController } from './account-login.controller';
import { AccountLoginService } from './account-login.service';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { MagicLinkController } from './magic-link.controller';
import { MagicLinkService } from './magic-link.service';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';
import { SessionController } from './session.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [AccessModule, DeliveryModule],
  controllers: [AccountLoginController, DevicesController, SessionController, RecoveryController, MagicLinkController, AccountController],
  providers: [AccountLoginService, SessionsService, DevicesService, RecoveryService, MagicLinkService, AccountService, RateLimitService],
  exports: [SessionsService],
})
export class IdentityModule {}
