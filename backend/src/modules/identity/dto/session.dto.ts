import { ApiProperty } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty({ format: 'uuid' }) actorId: string;
  @ApiProperty({ format: 'uuid' }) deviceId: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) accountId: string | null;
  @ApiProperty({ description: 'Echo in the X-CSRF-Token header on every write request.' }) csrfToken: string;
}
