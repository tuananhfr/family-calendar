import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsClientId } from '../../../common/ids';
import { PROFILES, RELATIONSHIPS } from '../../sync/domain-enums';

const ROLE_KEY = /^[A-Z][A-Z0-9_]{1,39}$/;

export class CreateInviteDto {
  @ApiProperty({ minimum: 1, maximum: 20 }) @IsInt() @Min(1) @Max(20) max_uses: number;
  @ApiProperty({ minimum: 1, maximum: 168 }) @IsInt() @Min(1) @Max(168) expires_in_hours: number;
  @ApiProperty({ enum: ['APPROVAL_REQUIRED'] }) @IsIn(['APPROVAL_REQUIRED']) approval_policy: 'APPROVAL_REQUIRED';
  @ApiPropertyOptional({ description: 'Role key suggested to the approver (not OWNER/ORGANIZER).' })
  @IsOptional()
  @Matches(ROLE_KEY)
  proposed_role?: string;
  @ApiPropertyOptional({ description: 'Addressee; the invite then shows in their GET /me/invitations.' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class CreateInviteResponseDto {
  @ApiPropertyOptional({ enum: ["SENT", "NOT_CONFIGURED", "FAILED"] }) email_delivery?: string;
  @ApiProperty({ format: 'uuid' }) invite_id: string;
  @ApiProperty({ description: 'Shown once; only its hash is stored.' }) token: string;
  @ApiProperty({ example: '/tham-gia/?token=…' }) url: string;
  @ApiProperty() expires_at: string;
}

export class InviteSummaryDto {
  @ApiProperty({ format: 'uuid' }) invite_id: string;
  @ApiProperty({ enum: ['ACTIVE', 'EXPIRED', 'USED_UP', 'REVOKED'] }) status: string;
  @ApiProperty() max_uses: number;
  @ApiProperty() uses: number;
  @ApiProperty() expires_at: string;
  @ApiProperty({ type: String, nullable: true }) proposed_role: string | null;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty() created_at: string;
}

export class InviteListDto {
  @ApiProperty({ type: [InviteSummaryDto] }) invites: InviteSummaryDto[];
}

export class InvitePreviewDto {
  @ApiProperty() space_name: string;
  @ApiProperty({ enum: ['FAMILY', 'GROUP'] }) space_kind: 'FAMILY' | 'GROUP';
  @ApiProperty() inviter_display_name: string;
  @ApiProperty() expires_at: string;
}

export class CreateJoinRequestDto {
  @ApiProperty({ maxLength: 50 }) @IsString() @Length(1, 50) display_name: string;
  @ApiPropertyOptional({ enum: PROFILES }) @IsOptional() @IsIn(PROFILES) proposed_profile?: (typeof PROFILES)[number];
  @ApiPropertyOptional({ format: 'uuid', description: 'Existing Member the requester says they are.' })
  @IsOptional()
  @IsClientId()
  member_id?: string;
}

export class JoinRequestCreatedDto {
  @ApiProperty({ format: 'uuid' }) request_id: string;
  @ApiProperty({ enum: ['PENDING', 'PENDING_GUARDIAN', 'APPROVED', 'REJECTED', 'EXPIRED'] }) status: string;
}

export class JoinRequestStatusDto {
  @ApiProperty({ enum: ['PENDING', 'PENDING_GUARDIAN', 'APPROVED', 'REJECTED', 'EXPIRED'] }) status: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Only once APPROVED.' }) space_id?: string;
}

export class JoinRequestSummaryDto {
  @ApiProperty({ format: 'uuid' }) request_id: string;
  @ApiProperty({ format: 'uuid' }) invite_id: string;
  @ApiProperty() display_name: string;
  @ApiProperty({ type: String, nullable: true }) proposed_profile: string | null;
  @ApiProperty({ type: String, nullable: true }) member_id: string | null;
  @ApiProperty({ type: String, nullable: true }) proposed_role: string | null;
  @ApiProperty({ type: String, nullable: true }) device_label: string | null;
  @ApiProperty({ enum: ['PENDING', 'PENDING_GUARDIAN', 'APPROVED', 'REJECTED', 'EXPIRED'] }) status: string;
  @ApiProperty() created_at: string;
}

export class JoinRequestListDto {
  @ApiProperty({ type: [JoinRequestSummaryDto] }) requests: JoinRequestSummaryDto[];
}

export class NewMemberDto {
  @ApiProperty({ maxLength: 50 }) @IsString() @Length(1, 50) display_name: string;
  @ApiProperty({ enum: RELATIONSHIPS }) @IsIn(RELATIONSHIPS) relationship: (typeof RELATIONSHIPS)[number];
  @ApiProperty({ enum: PROFILES }) @IsIn(PROFILES) profile: (typeof PROFILES)[number];
}

export class ApproveJoinRequestDto {
  @ApiProperty() @Matches(ROLE_KEY) role_key: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Link to this existing Member (exclusive with new_member).' })
  @IsOptional()
  @IsClientId()
  member_id?: string;
  @ApiPropertyOptional({
    type: NewMemberDto,
    description: 'Create a Member for the requester (exclusive with member_id).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewMemberDto)
  new_member?: NewMemberDto;
}

export class JoinRequestDecisionDto {
  @ApiProperty({ format: 'uuid' }) request_id: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] }) status: string;
  @ApiPropertyOptional({ format: 'uuid' }) member_id?: string;
}

export class GuardianRequestDto {
  @ApiProperty({ format: 'uuid' }) request_id: string;
  @ApiProperty() display_name: string;
  @ApiProperty() space_name: string;
  @ApiProperty({ enum: ['FAMILY', 'GROUP'] }) space_kind: string;
  @ApiProperty() created_at: string;
}

export class GuardianRequestListDto {
  @ApiProperty({ type: [GuardianRequestDto] }) requests: GuardianRequestDto[];
}

export class MyInvitationDto {
  @ApiProperty({ format: 'uuid' }) invite_id: string;
  @ApiProperty() space_name: string;
  @ApiProperty({ enum: ['FAMILY', 'GROUP'] }) space_kind: 'FAMILY' | 'GROUP';
  @ApiProperty() inviter_display_name: string;
  @ApiProperty() expires_at: string;
}

export class MyInvitationListDto {
  @ApiProperty({ type: [MyInvitationDto] }) invitations: MyInvitationDto[];
}

export class InvitationDeclinedDto {
  @ApiProperty({ enum: ['DECLINED'] }) status: 'DECLINED';
}
