import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, Public, type SessionContext } from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import {
  ApproveJoinRequestDto,
  CreateInviteDto,
  CreateInviteResponseDto,
  CreateJoinRequestDto,
  GuardianRequestListDto,
  InviteListDto,
  InvitePreviewDto,
  InviteSummaryDto,
  JoinRequestCreatedDto,
  JoinRequestDecisionDto,
  JoinRequestListDto,
  JoinRequestStatusDto,
} from './dto/invite.dto';
import { InvitesService } from './invites.service';
import { JoinRequestsService } from './join-requests.service';

@ApiTags('invites')
@ApiCookieAuth('fc_sid')
@Controller()
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly requests: JoinRequestsService,
  ) {}

  @Post('spaces/:id/invites')
  @HttpCode(201)
  @ApiCreatedResponse({ type: CreateInviteResponseDto, description: 'Needs members EDIT; 403 otherwise.' })
  create(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Body() dto: CreateInviteDto,
  ): Promise<CreateInviteResponseDto> {
    return this.invites.create(session, spaceId, dto);
  }

  @Get('spaces/:id/invites')
  @ApiOkResponse({ type: InviteListDto })
  async list(@CurrentSession() session: SessionContext, @Param('id') spaceId: string): Promise<InviteListDto> {
    return { invites: await this.invites.list(session, spaceId) };
  }

  @Post('spaces/:id/invites/:iid/revoke')
  @HttpCode(200)
  @ApiOkResponse({ type: InviteSummaryDto, description: 'Waiting requests on this invite become REJECTED.' })
  revoke(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('iid') inviteId: string,
  ): Promise<InviteSummaryDto> {
    return this.invites.revoke(session, spaceId, inviteId);
  }

  @Get('invites/:token/preview')
  @Public()
  @RateLimit({ bucket: 'invite-preview', limit: 60, windowSeconds: 3600, by: 'ip' })
  @ApiOkResponse({
    type: InvitePreviewDto,
    description: '404 INVITE_INVALID for unknown, revoked, expired or used-up invites.',
  })
  preview(@Param('token') token: string): Promise<InvitePreviewDto> {
    return this.invites.preview(token);
  }

  @Post('invites/:token/join-requests')
  @HttpCode(201)
  @RateLimit({ bucket: 'join-requests', limit: 10, windowSeconds: 3600, by: 'ip' })
  @ApiCreatedResponse({ type: JoinRequestCreatedDto, description: 'Idempotent per invite and Actor.' })
  join(
    @CurrentSession() session: SessionContext,
    @Param('token') token: string,
    @Body() dto: CreateJoinRequestDto,
  ): Promise<JoinRequestCreatedDto> {
    return this.requests.create(session, token, dto);
  }

  @Get('join-requests/:rid')
  @ApiOkResponse({ type: JoinRequestStatusDto, description: 'Own requests only; 404 otherwise.' })
  status(@CurrentSession() session: SessionContext, @Param('rid') rid: string): Promise<JoinRequestStatusDto> {
    return this.requests.status(session, rid);
  }

  @Post('join-requests/:rid/guardian-confirm')
  @HttpCode(200)
  @ApiOkResponse({ type: JoinRequestDecisionDto, description: 'Caller must be a Family guardian of the requester.' })
  guardianConfirm(
    @CurrentSession() session: SessionContext,
    @Param('rid') rid: string,
  ): Promise<JoinRequestDecisionDto> {
    return this.requests.guardianConfirm(session, rid);
  }

  @Get('me/guardian-requests')
  @ApiOkResponse({ type: GuardianRequestListDto })
  async guardianInbox(@CurrentSession() session: SessionContext): Promise<GuardianRequestListDto> {
    return { requests: await this.requests.guardianInbox(session) };
  }

  @Get('spaces/:id/join-requests')
  @ApiOkResponse({ type: JoinRequestListDto })
  async listRequests(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
  ): Promise<JoinRequestListDto> {
    return { requests: await this.requests.list(session, spaceId) };
  }

  @Post('spaces/:id/join-requests/:rid/approve')
  @HttpCode(200)
  @ApiOkResponse({
    type: JoinRequestDecisionDto,
    description: '409 INVITE_INVALID when the invite expired, was revoked or is used up.',
  })
  approve(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('rid') rid: string,
    @Body() dto: ApproveJoinRequestDto,
  ): Promise<JoinRequestDecisionDto> {
    return this.requests.approve(session, spaceId, rid, dto);
  }

  @Post('spaces/:id/join-requests/:rid/reject')
  @HttpCode(200)
  @ApiOkResponse({ type: JoinRequestDecisionDto })
  reject(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('rid') rid: string,
  ): Promise<JoinRequestDecisionDto> {
    return this.requests.reject(session, spaceId, rid);
  }
}
