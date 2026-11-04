import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PairScreenDeviceDto {
  @ApiProperty({ example: 'Điện thoại của con' }) @IsString() @MaxLength(100) @Matches(/\S/) label: string;
  @ApiProperty({ description: 'Người liên kết xác nhận được phép chia sẻ dữ liệu của thành viên này.' })
  @Equals(true)
  consent: boolean;
}

export class RedeemScreenPairingDto {
  @ApiProperty({ description: 'Mã liên kết dùng một lần, có hiệu lực 10 phút.' })
  @IsString()
  @Matches(/^[A-F0-9]{12}$/)
  code: string;
  @ApiProperty({ description: 'Người dùng thiết bị đã đọc và đồng ý chia sẻ thời gian sử dụng.' })
  @Equals(true)
  consent: boolean;
}

export class ScreenAppUsageDto {
  @ApiProperty({ example: 'com.google.android.youtube' })
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/)
  package_name: string;
  @ApiProperty({ example: 'YouTube' }) @IsString() @MaxLength(100) @Matches(/\S/) label: string;
  @ApiProperty({ description: 'Foreground seconds; overlapping apps may exceed device total.' })
  @IsInt()
  @Min(0)
  @Max(90000)
  seconds: number;
}

export class ScreenDayUsageDto {
  @ApiProperty({ example: '2026-11-03' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) local_date: string;
  @ApiProperty() @IsISO8601({ strict: true }) captured_at: string;
  @ApiProperty({ description: 'Start of the actual observation window, UTC.' })
  @IsISO8601({ strict: true })
  observed_from: string;
  @ApiProperty({ description: 'Union of foreground intervals while the screen is interactive.' })
  @IsInt()
  @Min(0)
  @Max(90000)
  total_seconds: number;
  @ApiProperty({ enum: ['COMPLETE', 'PARTIAL'] }) @IsIn(['COMPLETE', 'PARTIAL']) coverage: 'COMPLETE' | 'PARTIAL';
  @ApiProperty({ type: [ScreenAppUsageDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ScreenAppUsageDto)
  apps: ScreenAppUsageDto[];
}

export class ScreenBatchDto {
  @ApiProperty() @IsUUID() batch_id: string;
  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' }) @IsString() @MaxLength(80) time_zone: string;
  @ApiProperty({ example: 'android-events-v1' }) @Equals('android-events-v1') algorithm_version: string;
  @ApiProperty({ type: [ScreenDayUsageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScreenDayUsageDto)
  days: ScreenDayUsageDto[];
}

export class ScreenSummaryQueryDto {
  @ApiProperty({ example: '2026-11-01' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) from: string;
  @ApiProperty({ example: '2026-11-07' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) to: string;
}

export class SaveScreenGoalDto {
  @ApiProperty({ minimum: 1, maximum: 1440 }) @IsInt() @Min(1) @Max(1440) limit_minutes: number;
  @ApiProperty() @IsBoolean() reminders_enabled: boolean;
  @ApiProperty({ description: '0 to create; current version to update.' }) @IsInt() @Min(0) version: number;
}

export class ScreenCollectorStateDto {
  @ApiProperty({ enum: ['ACTIVE', 'PENDING_PERMISSION', 'PERMISSION_REVOKED'] })
  @IsIn(['ACTIVE', 'PENDING_PERMISSION', 'PERMISSION_REVOKED'])
  state: 'ACTIVE' | 'PENDING_PERMISSION' | 'PERMISSION_REVOKED';
}

export class DeleteScreenDataDto {
  @ApiProperty() @Equals(true) confirm: boolean;
}

export class ScreenExportQueryDto extends ScreenSummaryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['json']) format?: string;
}
