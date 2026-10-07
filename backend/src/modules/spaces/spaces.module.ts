import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { BootstrapService } from './bootstrap.service';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  imports: [AccessModule],
  controllers: [SpacesController],
  providers: [SpacesService, BootstrapService],
})
export class SpacesModule {}
