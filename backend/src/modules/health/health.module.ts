import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MetaController } from './meta.controller';

@Module({ controllers: [HealthController, MetaController] })
export class HealthModule {}
