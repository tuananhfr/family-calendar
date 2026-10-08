import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { BlobController } from './blob.controller';
import { BlobService } from './blob.service';
import { LocalDiskStorage } from './local-disk.storage';

@Module({
  imports: [AccessModule],
  controllers: [BlobController, MediaController],
  providers: [BlobService, LocalDiskStorage, MediaService],
})
export class StorageModule {}
