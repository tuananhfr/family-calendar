import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class PushKeysDto {
  @ApiProperty({ description: 'base64url P-256 public key from PushSubscription.getKey("p256dh").' })
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @ApiProperty({ description: 'base64url 16-byte auth secret.' }) @IsString() @MaxLength(100) auth: string;
}

export class CreatePushSubscriptionDto {
  @ApiProperty({ description: 'https URL of a push service (no IP literal, no localhost, default port).' })
  @IsString()
  @MaxLength(1000)
  endpoint: string;

  @ApiProperty({ type: PushKeysDto }) @ValidateNested() @Type(() => PushKeysDto) keys: PushKeysDto;

  @ApiPropertyOptional({
    description:
      'Show NORMAL titles on this device lock screen. Default false on create, unchanged on update; never applies to SENSITIVE.',
  })
  @IsOptional()
  @IsBoolean()
  show_details?: boolean;
}

export class PushSubscriptionCreatedDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() show_details: boolean;
}

export class PushSubscriptionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) device_id: string;
  @ApiProperty() current_device: boolean;
  @ApiProperty() show_details: boolean;
  @ApiProperty({ format: 'date-time' }) created_at: string;
}

export class PushSubscriptionListDto {
  @ApiProperty({
    type: [PushSubscriptionDto],
    description: 'The caller own subscriptions; endpoints and keys are never returned.',
  })
  subscriptions: PushSubscriptionDto[];
}
