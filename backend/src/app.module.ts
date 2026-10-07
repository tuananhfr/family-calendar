import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { INFRA_IMPORTS } from './app.imports';
import { CsrfGuard } from './common/http/csrf.guard';
import { OriginGuard } from './common/http/origin.guard';
import { RateLimitGuard, RateLimitService } from './common/http/rate-limit';
import { SessionGuard } from './common/http/session.guard';
import { AccessModule } from './modules/access/access.module';
import { AiModule } from './modules/ai/ai.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { HealthModule } from './modules/health/health.module';
import { IcsModule } from './modules/ics/ics.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InvitesModule } from './modules/invites/invites.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { StorageModule } from './modules/storage/storage.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ...INFRA_IMPORTS,
    HealthModule,
    IdentityModule,
    AccessModule,
    SyncModule,
    SpacesModule,
    InvitesModule,
    StorageModule,
    JobsModule,
    RemindersModule,
    NotificationsModule,
    EmergencyModule,
    AiModule,
    IcsModule,
  ],
  providers: [
    RateLimitService,
    // Order matters: Origin before any DB work, session before CSRF (CSRF is bound to it), limits last.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
