import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RESOURCE_TYPES, type ResourceType } from '../resource-types';

export class ChangeDto {
  @ApiProperty({ description: 'change_seq of the entry, as a string.' }) seq: string;
  @ApiProperty({ enum: RESOURCE_TYPES }) resource_type: ResourceType;
  @ApiProperty({ format: 'uuid' }) resource_id: string;
  @ApiProperty({ enum: ['UPSERT', 'DELETE'] }) op: 'UPSERT' | 'DELETE';
  @ApiProperty({ description: 'UPSERT: revision of `record`; DELETE: revision of the delete.' }) revision: string;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'UPSERT only: current record (camelCase, frontend schema) as the caller may see it.',
  })
  record?: Record<string, unknown>;
}

export class ChangesResponseDto {
  @ApiProperty({ type: [ChangeDto], description: 'Only entries the caller may read now, latest per record.' })
  changes: ChangeDto[];
  @ApiProperty({ description: 'Pass as `cursor` next time; advances past hidden entries too.' }) next_cursor: string;
  @ApiProperty() has_more: boolean;
  @ApiProperty({ description: 'Differs from the cached value: reload the snapshot and drop records missing from it.' })
  policy_version: string;
}

export class MembershipDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) actorId: string;
  @ApiProperty({ format: 'uuid' }) roleId: string;
}

export class SnapshotAccessDto {
  @ApiProperty({ format: 'uuid' }) actorId: string;
  @ApiProperty() roleKey: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string', enum: ['NONE', 'VIEW', 'EDIT'] } })
  matrix: Record<string, string>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) restrictions: Record<string, string>;
  @ApiProperty({ type: [String] }) representedMemberIds: string[];
  @ApiProperty({ type: [String] }) guardianOfMemberIds: string[];
}

export class SnapshotResponseDto {
  @ApiProperty({ description: 'change_seq the snapshot reflects; pull changes from here.' }) watermark: string;
  @ApiProperty() policy_version: string;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'The space_settings record.' })
  space: Record<string, unknown>;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'object', additionalProperties: true } },
    description: 'Every live record the caller may read, keyed by resource type (space_settings excluded).',
  })
  records: Record<string, Array<Record<string, unknown>>>;
  @ApiProperty({ type: [MembershipDto], description: 'ACTIVE memberships of the Space.' }) memberships: MembershipDto[];
  @ApiProperty({ type: SnapshotAccessDto }) access: SnapshotAccessDto;
}
