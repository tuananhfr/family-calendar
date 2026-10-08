import { ApiProperty } from '@nestjs/swagger';
import { IsClientId } from '../../../common/ids';
export class AssignRoleDto { @ApiProperty() @IsClientId() role_id: string; }
export class ManagedMembershipDto {
  @ApiProperty() actor_id: string;
  @ApiProperty() role_id: string;
  @ApiProperty() role_key: string;
  @ApiProperty() display_name: string;
}
export class ManagedRoleDto {
  @ApiProperty() id: string;
  @ApiProperty() role_key: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) matrix: Record<string, string>;
}
export class MembershipListDto {
  @ApiProperty({ type: [ManagedMembershipDto] }) memberships: ManagedMembershipDto[];
  @ApiProperty({ type: [ManagedRoleDto] }) roles: ManagedRoleDto[];
  @ApiProperty() can_manage: boolean;
}
export class PolicyChangedDto { @ApiProperty() policy_version: string; }
