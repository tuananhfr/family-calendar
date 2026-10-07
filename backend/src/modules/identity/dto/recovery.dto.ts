import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { IsClientId } from '../../../common/ids';

export class RecoveryCodeDto {
  @ApiProperty({ example: 'K7QM-2X9D-…', description: '24 symbols in 6 groups of 4; shown once.' }) code: string;
}

export class RecoveryDeviceDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'If given, must be the Actor of the code.' })
  @IsOptional()
  @IsClientId()
  actor_id?: string;

  @ApiProperty({ format: 'uuid' }) @IsClientId() device_id: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100) label?: string;
}

export class RedeemRecoveryDto {
  @ApiProperty({ description: 'Case, spaces and dashes are ignored.' }) @IsString() @MaxLength(64) code: string;
  @ApiProperty({ type: RecoveryDeviceDto }) @ValidateNested() @Type(() => RecoveryDeviceDto) device: RecoveryDeviceDto;
}

export class RedeemRecoveryResponseDto {
  @ApiProperty({ format: 'uuid' }) actor_id: string;
  @ApiProperty({ format: 'uuid' }) device_id: string;
  @ApiProperty({ description: 'Replacement code (the used one is dead); shown once.' }) code: string;
}

export class MagicLinkRequestDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
}

export class MagicLinkAcceptedDto {
  @ApiProperty({ enum: [true] }) accepted: true;
}

export class MagicLinkVerifyDto {
  @ApiProperty() @IsString() @MaxLength(100) token: string;
}

export class MagicLinkVerifiedDto {
  @ApiProperty({ format: 'uuid' }) account_id: string;
  @ApiProperty() email: string;
  @ApiProperty({ format: 'uuid' }) actor_id: string;
}

export class AccountStatusDto {
  @ApiProperty() linked: boolean;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional({ format: 'uuid' }) account_id?: string;
}
