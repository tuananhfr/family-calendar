import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { BlobController } from './blob.controller';
import { BlobService } from './blob.service';
import { LocalDiskStorage } from './local-disk.storage';

@Module({
  imports: [AccessModule],
  controllers: [BlobController],
  providers: [BlobService, LocalDiskStorage],
})
export class StorageModule {}
