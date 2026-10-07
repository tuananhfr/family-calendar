import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CLIENT_ID_PATTERN, IsClientId } from '../../../common/ids';
import { EMERGENCY_LIFECYCLES, type EmergencyLifecycle } from '../entities/emergency-event.entity';
import { LOCATION_PROVENANCES, type LocationProvenance } from '../entities/emergency-location.entity';
import { EMERGENCY_RESPONSE_KINDS, type EmergencyResponseKind } from '../entities/emergency-response.entity';

const CLOSED_LIFECYCLES = ['CLOSED_SAFE', 'CLOSED_ENDED'] as const;

export class CreateEmergencyDto {
  @ApiProperty({ format: 'uuid', description: 'Client-generated; the idempotency key of this SOS.' })
  @IsClientId()
  id: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the user triggered it on the device (not trusted for access).',
  })
  @IsISO8601({ strict: true })
  client_triggered_at: string;

  @ApiProperty({
    enum: EMERGENCY_LIFECYCLES,
    description: 'Latest local state; a terminal state here stores the event without alerting anyone.',
  })
  @IsIn(EMERGENCY_LIFECYCLES)
  lifecycle: EmergencyLifecycle;

  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601({ strict: true }) closed_at?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200) reason?: string;

  @ApiProperty({ format: 'uuid' }) @IsClientId() operation_id: string;
}

export class CloseEmergencyDto {
  @ApiProperty({ format: 'uuid' }) @IsClientId() operation_id: string;
  @ApiProperty({ enum: CLOSED_LIFECYCLES }) @IsIn(CLOSED_LIFECYCLES) lifecycle: 'CLOSED_SAFE' | 'CLOSED_ENDED';
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200) reason?: string;
  @ApiPropertyOptional({ format: 'date-time', description: 'Local close time when it was closed offline.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  closed_at?: string;
}

export class EmergencyResponseDto {
  @ApiProperty({ format: 'uuid' }) @IsClientId() operation_id: string;
  @ApiProperty({ enum: EMERGENCY_RESPONSE_KINDS }) @IsIn(EMERGENCY_RESPONSE_KINDS) kind: EmergencyResponseKind;
}

export class EmergencyLocationDto {
  @ApiProperty({ minimum: -90, maximum: 90 }) @IsNumber() @Min(-90) @Max(90) lat: number;
  @ApiProperty({ minimum: -180, maximum: 180 }) @IsNumber() @Min(-180) @Max(180) lng: number;
  @ApiProperty({ minimum: 0, maximum: 100000, description: 'Metres.' })
  @IsNumber()
  @Min(0)
  @Max(100000)
  accuracy: number;
  @ApiProperty({ format: 'date-time', description: 'Timestamp of the position itself, not of the callback.' })
  @IsISO8601({ strict: true })
  captured_at: string;
  @ApiProperty({ enum: LOCATION_PROVENANCES }) @IsIn(LOCATION_PROVENANCES) provenance: LocationProvenance;
}

export class EmergencyRecipientsDto {
  @ApiProperty({ type: [String], description: 'Member ids of this Family; empty = default recipients.' })
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(CLIENT_ID_PATTERN, { each: true })
  member_ids: string[];
}

export class EmergencyRecipientsViewDto {
  @ApiProperty({
    type: [String],
    description: 'Effective recipients (configured, or the default when not configured).',
  })
  member_ids: string[];
  @ApiProperty({ description: 'False: nobody configured a list; the default (other OWNER/ADULT members) applies.' })
  configured: boolean;
}

export class EmergencyAcceptedDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: EMERGENCY_LIFECYCLES }) lifecycle: EmergencyLifecycle;
  @ApiProperty({ format: 'date-time' }) client_triggered_at: string;
  @ApiProperty({ format: 'date-time' }) server_received_at: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) closed_at: string | null;
  @ApiProperty({ description: 'Decimal string.' }) revision: string;
  @ApiProperty({ enum: ['SERVER_ACCEPTED'], description: 'Stored on the server; says nothing about anyone seeing it.' })
  delivery: 'SERVER_ACCEPTED';
}

export class EmergencyRecipientStateDto {
  @ApiProperty({ format: 'uuid' }) member_id: string;
  @ApiProperty({ enum: ['NONE', ...EMERGENCY_RESPONSE_KINDS] }) response: 'NONE' | EmergencyResponseKind;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) responded_at: string | null;
}

export class EmergencyLocationViewDto {
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty() accuracy: number;
  @ApiProperty({ format: 'date-time' }) captured_at: string;
  @ApiProperty({ format: 'date-time' }) received_at: string;
  @ApiProperty({ enum: LOCATION_PROVENANCES }) provenance: LocationProvenance;
}

export class EmergencyViewDto extends EmergencyAcceptedDto {
  @ApiProperty({ format: 'uuid' }) created_by_actor_id: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String, description: 'SELF Member of the creator, if any.' })
  created_by_member_id: string | null;
  @ApiProperty({ nullable: true, type: String }) reason: string | null;
  @ApiProperty({ type: [EmergencyRecipientStateDto], description: 'Current recipients only.' })
  recipients: EmergencyRecipientStateDto[];
  @ApiProperty({ description: 'Push requests accepted by a push service; not proof that anyone saw them.' })
  push_submitted: number;
  @ApiProperty({ type: EmergencyLocationViewDto, nullable: true }) last_location: EmergencyLocationViewDto | null;
}

export class EmergencyListDto {
  @ApiProperty({ type: [EmergencyViewDto], description: 'ACTIVE ones plus those closed in the last 24 hours.' })
  emergencies: EmergencyViewDto[];
}

export class LocationAcceptedDto {
  @ApiProperty() id: string;
  @ApiProperty({ format: 'date-time' }) received_at: string;
}
