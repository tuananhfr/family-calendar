import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import {
  MagicLinkAcceptedDto,
  MagicLinkRequestDto,
  MagicLinkVerifiedDto,
  MagicLinkVerifyDto,
} from './dto/recovery.dto';
import { MagicLinkService } from './magic-link.service';

@ApiTags('account')
@ApiCookieAuth('fc_sid')
@Controller('auth/magic-link')
export class MagicLinkController {
  constructor(private readonly magicLinks: MagicLinkService) {}

  @Post()
  @HttpCode(202)
  @RateLimit({ bucket: 'magic-link', limit: 20, windowSeconds: 3600, by: 'ip' })
  @ApiAcceptedResponse({
    type: MagicLinkAcceptedDto,
    description: 'Same answer whether or not the address has an account.',
  })
  async request(
    @CurrentSession() session: SessionContext,
    @Body() dto: MagicLinkRequestDto,
  ): Promise<MagicLinkAcceptedDto> {
    await this.magicLinks.request(session, dto.email);
    return { accepted: true };
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOkResponse({
    type: MagicLinkVerifiedDto,
    description: '422 VALIDATION_FAILED fields.token=INVALID if used, expired or not yours.',
  })
  verify(@CurrentSession() session: SessionContext, @Body() dto: MagicLinkVerifyDto): Promise<MagicLinkVerifiedDto> {
    return this.magicLinks.verify(session, dto.token);
  }
}
