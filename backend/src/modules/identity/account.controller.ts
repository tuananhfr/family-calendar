import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { AccountService } from './account.service';
import { AccountStatusDto } from './dto/recovery.dto';

@ApiTags('account')
@ApiCookieAuth('fc_sid')
@Controller('account')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  @ApiOkResponse({ type: AccountStatusDto })
  status(@CurrentSession() session: SessionContext): Promise<AccountStatusDto> {
    return this.accounts.status(session);
  }

  @Post('unlink')
  @HttpCode(200)
  @ApiOkResponse({ type: AccountStatusDto, description: 'Devices stay signed in.' })
  unlink(@CurrentSession() session: SessionContext): Promise<AccountStatusDto> {
    return this.accounts.unlink(session);
  }
}
