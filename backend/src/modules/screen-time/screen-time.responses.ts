import { ApiProperty } from '@nestjs/swagger';
import { ScreenAppUsageDto } from './screen-time.dto';

export class ScreenGoalResponse {
  @ApiProperty() limit_minutes: number;
  @ApiProperty() reminders_enabled: boolean;
  @ApiProperty() version: number;
  @ApiProperty({ format: 'date-time' }) updated_at: string;
}
export class ScreenDeviceResponse {
  @ApiProperty() id: string;
  @ApiProperty() label: string;
  @ApiProperty({ enum: ['UNLINKED', 'PENDING_PERMISSION', 'ACTIVE', 'STALE', 'PERMISSION_REVOKED', 'DISCONNECTED'] })
  state: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) last_seen_at: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) consent_at: string | null;
}
export class ScreenDayResponse {
  @ApiProperty({ format: 'date' }) date: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'null means missing data; 0 is an observed zero. Sum of device totals, without cross-device overlap removal.',
  })
  total_seconds: number | null;
  @ApiProperty({ enum: ['UNKNOWN', 'PARTIAL', 'COMPLETE'] }) coverage: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) updated_at: string | null;
  @ApiProperty({ type: [ScreenAppUsageDto] }) apps: ScreenAppUsageDto[];
  @ApiProperty() device_count: number;
}
export class ScreenSummaryResponse {
  @ApiProperty() member_id: string;
  @ApiProperty() time_zone: string;
  @ApiProperty() can_manage: boolean;
  @ApiProperty({ enum: ['ANDROID_USAGE_EVENTS'] }) source: string;
  @ApiProperty({ enum: ['android-events-v1'] }) algorithm_version: string;
  @ApiProperty({ type: ScreenGoalResponse, nullable: true }) goal: ScreenGoalResponse | null;
  @ApiProperty({ type: [ScreenDeviceResponse] }) devices: ScreenDeviceResponse[];
  @ApiProperty({ type: [ScreenDayResponse] }) days: ScreenDayResponse[];
}
export class ScreenPairingResponse {
  @ApiProperty() device_id: string;
  @ApiProperty({ example: 'AB12CD34EF56', description: 'Only returned when creating the pairing; 10-minute expiry.' })
  code: string;
  @ApiProperty({ format: 'date-time' }) expires_at: string;
  @ApiProperty() time_zone: string;
}
export class ScreenLinkResponse {
  @ApiProperty() device_id: string;
  @ApiProperty({ description: 'Device-scoped bearer token. Only returned once; never authenticates a web session.' })
  token: string;
  @ApiProperty() time_zone: string;
  @ApiProperty({ format: 'date-time' }) consent_at: string;
  @ApiProperty({ enum: ['PENDING_PERMISSION'] }) state: string;
}
export class ScreenMemberResponse {
  @ApiProperty() id: string;
  @ApiProperty() display_name: string;
  @ApiProperty() profile: string;
  @ApiProperty() can_manage: boolean;
}
export class ScreenMembersResponse {
  @ApiProperty({ type: [ScreenMemberResponse] }) members: ScreenMemberResponse[];
}
