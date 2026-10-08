import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsClientId } from '../../../common/ids';
export class LoginTokenDto {
  @ApiProperty() @IsString() @MinLength(20) @MaxLength(100) token: string;
}
export class LoginActorDto {
  @ApiProperty() actor_id: string;
  @ApiProperty() label: string;
}
export class LoginPreviewDto {
  @ApiProperty({ type: [LoginActorDto] }) actors: LoginActorDto[];
}
export class LoginVerifyDto extends LoginTokenDto {
  @ApiProperty() @IsClientId() actor_id: string;
  @ApiProperty() @IsClientId() device_id: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) label?: string;
}
export class LoginCompletedDto {
  @ApiProperty() actor_id: string;
  @ApiProperty() device_id: string;
}
export class IdentityOptionsDto {
  @ApiProperty() email_configured: boolean;
}
