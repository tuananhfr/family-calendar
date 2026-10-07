import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import {
  CreateJoinRequestDto,
  InvitationDeclinedDto,
  JoinRequestCreatedDto,
  MyInvitationListDto,
} from './dto/invite.dto';
import { MeInvitationsService } from './me-invitations.service';

@ApiTags('invites')
@ApiCookieAuth('fc_sid')
@Controller('me/invitations')
export class MeInvitationsController {
  constructor(private readonly invitations: MeInvitationsService) {}

  @Get()
  @ApiOkResponse({
    type: MyInvitationListDto,
    description: 'Open invites sent to a verified email linked to the caller.',
  })
  async list(@CurrentSession() session: SessionContext): Promise<MyInvitationListDto> {
    return { invitations: await this.invitations.list(session) };
  }

  @Post(':iid/accept')
  @HttpCode(201)
  @ApiCreatedResponse({
    type: JoinRequestCreatedDto,
    description: '404 INVITE_INVALID if the invite is not addressed to the caller.',
  })
  accept(
    @CurrentSession() session: SessionContext,
    @Param('iid') inviteId: string,
    @Body() dto: CreateJoinRequestDto,
  ): Promise<JoinRequestCreatedDto> {
    return this.invitations.accept(session, inviteId, dto);
  }

  @Post(':iid/decline')
  @HttpCode(200)
  @ApiOkResponse({ type: InvitationDeclinedDto })
  decline(@CurrentSession() session: SessionContext, @Param('iid') inviteId: string): Promise<InvitationDeclinedDto> {
    return this.invitations.decline(session, inviteId);
  }
}
