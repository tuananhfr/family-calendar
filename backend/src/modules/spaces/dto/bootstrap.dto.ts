import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsObject, IsOptional } from 'class-validator';
import { IsClientId } from '../../../common/ids';
import { RESOURCE_TYPES, type ResourceType } from '../../sync/resource-types';

export const MAX_CHUNK_RECORDS = 500;

export class BootstrapSpaceInputDto {
  @ApiProperty({ format: 'uuid', description: 'The local Space id; kept as the server id.' }) id: string;
  @ApiProperty({ enum: ['FAMILY', 'GROUP'] }) kind: 'FAMILY' | 'GROUP';
  @ApiProperty({ maxLength: 100 }) name: string;
  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' }) time_zone: string;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'SpaceSettings (camelCase, frontend schema).' })
  settings: Record<string, unknown>;
}

export class BootstrapSpaceDto {
  // Fields are checked by the service so every problem comes back in one `fields` map (space.id, space.kind…).
  @ApiProperty({ type: BootstrapSpaceInputDto })
  @IsObject()
  space: Record<string, unknown>;
}

export class BootstrapSpaceResponseDto {
  @ApiProperty({ format: 'uuid' }) space_id: string;
  @ApiProperty({ enum: ['INITIALIZING', 'SHARED'] }) state: 'INITIALIZING' | 'SHARED';
}

export class BootstrapRecordDto {
  @ApiProperty({ enum: RESOURCE_TYPES.filter((t) => t !== 'space_settings') }) resource_type: ResourceType;
  @ApiProperty({ format: 'uuid' }) resource_id: string;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Same payload as a sync create.' })
  payload: Record<string, unknown>;
}

export class BootstrapChunkDto {
  @ApiProperty({ format: 'uuid', description: 'Client UUID; resending the same chunk is a no-op.' })
  @IsClientId()
  chunk_id: string;

  @ApiProperty({ type: [BootstrapRecordDto], maxItems: MAX_CHUNK_RECORDS })
  @IsArray()
  @ArrayMaxSize(MAX_CHUNK_RECORDS)
  records: unknown[];
}

export class BootstrapChunkResponseDto {
  @ApiProperty() accepted: number;
}

export class ActivateSpaceDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Records uploaded per resource type (system roles excluded); omitted types count as 0.',
  })
  @IsObject()
  expected_counts: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'uuid', description: 'The uploaded Member that is the creator (SELF link).' })
  @IsOptional()
  @IsClientId()
  self_member_id?: string;
}

export class ActivateSpaceResponseDto {
  @ApiProperty({ enum: ['SHARED'] }) state: 'SHARED';
  @ApiProperty({ description: 'change_seq after activation; equals the snapshot watermark.' }) watermark: string;
}

export class SpaceSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['FAMILY', 'GROUP'] }) kind: 'FAMILY' | 'GROUP';
  @ApiProperty() name: string;
  @ApiProperty() timeZone: string;
  @ApiProperty({ enum: ['INITIALIZING', 'SHARED'] }) sharingState: 'INITIALIZING' | 'SHARED';
  @ApiProperty() roleKey: string;
  @ApiProperty() policyVersion: string;
}

export class SpaceListDto {
  @ApiProperty({ type: [SpaceSummaryDto] }) spaces: SpaceSummaryDto[];
}
