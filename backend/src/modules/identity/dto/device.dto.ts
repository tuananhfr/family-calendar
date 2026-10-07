import { ApiProperty } from '@nestjs/swagger';

export class DeviceDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, nullable: true }) label: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] }) status: 'ACTIVE' | 'REVOKED';
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) revokedAt: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastSeenAt: string | null;
  @ApiProperty({ description: 'True for the device making this request.' }) current: boolean;
}

export class DeviceListDto {
  @ApiProperty({ type: [DeviceDto] }) devices: DeviceDto[];
}
