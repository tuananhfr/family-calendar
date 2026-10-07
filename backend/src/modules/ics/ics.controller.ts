import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { CurrentSession, Public, type SessionContext } from '../../common/http/current-session.decorator';
import { RateLimitService } from '../../common/http/rate-limit';
import { CreateIcsFeedDto, IcsFeedCreatedDto } from './dto/ics.dto';
import { IcsService } from './ics.service';

/** Calendar apps poll every few hours; this only stops a leaked link from being hammered. */
const FEED_FETCHES_PER_HOUR = 60;

@ApiTags('ics')
@Controller()
export class IcsController {
  constructor(
    private readonly ics: IcsService,
    private readonly limiter: RateLimitService,
  ) {}

  @Post('spaces/:id/ics-feeds')
  @ApiCookieAuth('fc_sid')
  @ApiCreatedResponse({
    type: IcsFeedCreatedDto,
    description: 'Needs `backup` EDIT; 404 for a Space the server does not hold. The URL is returned only here.',
  })
  create(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Body() dto: CreateIcsFeedDto,
  ): Promise<IcsFeedCreatedDto> {
    return this.ics.create(session, spaceId, dto);
  }

  @Delete('spaces/:id/ics-feeds/:fid')
  @HttpCode(204)
  @ApiCookieAuth('fc_sid')
  @ApiNoContentResponse({ description: 'Revoked (also when it already was). Needs `backup` EDIT.' })
  async revoke(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('fid') feedId: string,
  ): Promise<void> {
    await this.ics.revoke(session, spaceId, feedId);
  }

  @Get('ics/:file')
  @Public()
  @ApiProduces('text/calendar')
  @ApiOkResponse({
    description:
      'Subscription feed, no cookie: `/api/v1/ics/<token>.ics`. Cache-Control private, max-age=900. Only NORMAL ' +
      'items with audience FAMILY_ALL / GROUP_MEMBERS, no health items, next 3 years (lunar repeats expanded).',
  })
  @ApiNotFoundResponse({ description: 'Unknown or revoked link, Space no longer shared, or the creator left.' })
  async feed(@Param('file') file: string, @Res() res: Response): Promise<void> {
    const token = file.endsWith('.ics') ? file.slice(0, -4) : '';
    const limit = await this.limiter.hit('ics-feed', sha256Hex(token), FEED_FETCHES_PER_HOUR, 3600);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new ApiError(ErrorCode.RATE_LIMITED, 429);
    }
    const body = await this.ics.render(token);
    if (body === null) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    res.status(200);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="lich-gia-dinh.ics"');
    // The URL is the credential: keep it out of shared caches, referrers and search engines.
    res.setHeader('Cache-Control', 'private, max-age=900');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.send(body);
  }
}
