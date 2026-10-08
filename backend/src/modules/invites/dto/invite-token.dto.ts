import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CreateJoinRequestDto } from './invite.dto';
export class InviteTokenDto {
  @ApiProperty() @IsString() @MinLength(20) @MaxLength(100) token: string;
}
export class JoinByTokenDto extends CreateJoinRequestDto {
  @ApiProperty() @IsString() @MinLength(20) @MaxLength(100) token: string;
}
