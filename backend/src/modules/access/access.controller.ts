import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { AssignRoleDto, MembershipListDto, PolicyChangedDto } from './dto/membership.dto';
import { MembershipService } from './membership.service';
@ApiTags('access')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id/memberships')
export class AccessController {
  constructor(private readonly members: MembershipService) {}
  @Get() @ApiOkResponse({ type: MembershipListDto })
  list(@CurrentSession() session: SessionContext, @Param('id') id: string) { return this.members.list(session, id); }
  @Post(':actorId/role') @HttpCode(200) @ApiOkResponse({ type: PolicyChangedDto })
  assign(@CurrentSession() session: SessionContext, @Param('id') id: string, @Param('actorId') actorId: string, @Body() dto: AssignRoleDto) {
    return this.members.change(session, id, actorId, dto.role_id);
  }
  @Post(':actorId/remove') @HttpCode(200) @ApiOkResponse({ type: PolicyChangedDto })
  remove(@CurrentSession() session: SessionContext, @Param('id') id: string, @Param('actorId') actorId: string) {
    return this.members.change(session, id, actorId);
  }
}
