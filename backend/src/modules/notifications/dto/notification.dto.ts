import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { CLIENT_ID_PATTERN } from '../../../common/ids';
import { NOTIFICATION_TYPES, type NotificationType } from '../entities/notification.entity';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'next_cursor of the previous page.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) space_id: string;
  @ApiProperty({ enum: NOTIFICATION_TYPES }) type: NotificationType;
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: 'References only (e.g. item_id, occurrence_key); open the record to read it.',
  })
  resource_ref: Record<string, unknown> | null;
  @ApiProperty({ description: 'Already privacy-filtered: generic text for PRIVATE/SENSITIVE records.' })
  title_safe: string;
  @ApiProperty({ format: 'date-time' }) created_at: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) read_at: string | null;
}

export class NotificationListDto {
  @ApiProperty({ type: [NotificationDto], description: 'Newest first.' }) notifications: NotificationDto[];
  @ApiProperty({ nullable: true, type: String }) next_cursor: string | null;
  @ApiProperty() unread_count: number;
}

export class MarkNotificationsReadDto {
  @ApiPropertyOptional({ type: [String], maxItems: 200, description: 'Exactly one of ids / all.' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @Matches(CLIENT_ID_PATTERN, { each: true })
  ids?: string[];

  @ApiPropertyOptional({ enum: [true] }) @IsOptional() @Equals(true) all?: true;
}

export class UnreadCountDto {
  @ApiProperty() unread_count: number;
}
