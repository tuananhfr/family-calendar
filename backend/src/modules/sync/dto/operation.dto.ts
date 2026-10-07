import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { RESOURCE_TYPES, SYNC_ACTIONS, type ResourceType, type SyncAction } from '../resource-types';

// Envelope fields are snake_case (sync-protocol.md); `payload` and `record` use the camelCase shape of the
// frontend zod schema of the resource type (minus syncState).

export class OperationDto {
  @ApiProperty({ format: 'uuid', description: 'Client UUID; unchanged across retries.' })
  operation_id: string;

  @ApiProperty({ enum: RESOURCE_TYPES })
  resource_type: ResourceType;

  @ApiProperty({ format: 'uuid' })
  resource_id: string;

  @ApiProperty({ enum: SYNC_ACTIONS })
  action: SyncAction;

  @ApiProperty({ type: String, nullable: true, description: 'Server revision the edit started from; null on create.' })
  base_revision: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Full record (camelCase, frontend schema) for create/update/occurrence_action; null for delete.',
  })
  payload: unknown;

  @ApiProperty({ description: 'ISO instant of the user action; informational only.' })
  client_created_at: string;

  @ApiProperty({ enum: [1] })
  schema_version: 1;
}

export class SyncOperationsRequestDto {
  @ApiProperty({ type: [OperationDto], maxItems: 50, description: 'At most 50 operations and 512 KB per request.' })
  @IsArray()
  operations: unknown[];
}

export class OperationErrorDto {
  @ApiProperty() code: string;
  @ApiProperty() message: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } }) fields?: Record<string, string>;
}

export class OperationResultDto {
  @ApiProperty({ format: 'uuid' }) operation_id: string;
  @ApiProperty({ enum: ['APPLIED', 'REJECTED'] }) status: 'APPLIED' | 'REJECTED';
  @ApiPropertyOptional({ description: 'APPLIED: new server revision.' }) revision?: string;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'APPLIED: canonical record as the caller may see it (null after delete or when no longer readable).',
  })
  record?: Record<string, unknown> | null;
  @ApiPropertyOptional({ type: OperationErrorDto }) error?: OperationErrorDto;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'REVISION_CONFLICT / FORBIDDEN: current server record if the caller may read it, else null.',
  })
  current?: Record<string, unknown> | null;
}

export class SyncOperationsResponseDto {
  @ApiProperty({ type: [OperationResultDto] }) results: OperationResultDto[];
  @ApiProperty() policy_version: string;
}
