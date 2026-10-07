import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ChangesController } from './changes.controller';
import { ChangesService } from './changes.service';
import { OperationApplier } from './operation-applier';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { SnapshotService } from './snapshot.service';

@Module({
  imports: [AccessModule],
  controllers: [OperationsController, ChangesController],
  providers: [OperationApplier, OperationsService, ChangesService, SnapshotService],
  // Server-side writers (automations) go through the same idempotent, access-checked path as clients.
  exports: [OperationsService],
})
export class SyncModule {}
