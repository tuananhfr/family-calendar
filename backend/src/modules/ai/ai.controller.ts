import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import { AiService } from './ai.service';
import {
  AiConsentDto,
  AiConsentRequestDto,
  AiConversationDto,
  AiConversationListDto,
  AiMessageRequestDto,
  AiMessageResponseDto,
  AiStatusDto,
} from './dto/ai.dto';

const NOT_SHARED = '404 NOT_FOUND when the Space is unknown to the server (LOCAL_ONLY), not shared, or not yours.';

@ApiTags('ai')
@ApiCookieAuth('fc_sid')
@ApiNotFoundResponse({ description: NOT_SHARED })
@Controller('spaces/:id/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOkResponse({ type: AiStatusDto, description: 'Needs `ai` VIEW.' })
  status(@CurrentSession() session: SessionContext, @Param('id') spaceId: string): Promise<AiStatusDto> {
    return this.ai.status(session, spaceId);
  }

  @Post('consent')
  @HttpCode(200)
  @ApiOkResponse({ type: AiConsentDto, description: 'Needs `ai` EDIT. Per person and Space.' })
  consent(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Body() dto: AiConsentRequestDto,
  ): Promise<AiConsentDto> {
    return this.ai.setConsent(session, spaceId, dto);
  }

  @Post('messages')
  @HttpCode(200)
  @RateLimit({ bucket: 'ai-messages', limit: 30, windowSeconds: 3600, by: 'actor' })
  @ApiOkResponse({ type: AiMessageResponseDto, description: 'Drafts only; nothing is saved to the family data.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN without `ai` EDIT; AI_CONSENT_REQUIRED before consent.' })
  @ApiServiceUnavailableResponse({
    description: 'AI_NOT_CONFIGURED (no provider on the server) or TEMPORARILY_UNAVAILABLE (provider failed).',
  })
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMITED with Retry-After: more than 30 messages per hour.' })
  send(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Body() dto: AiMessageRequestDto,
  ): Promise<AiMessageResponseDto> {
    return this.ai.send(session, spaceId, dto);
  }

  @Get('conversations')
  @ApiOkResponse({ type: AiConversationListDto, description: 'Only the conversations of the caller.' })
  conversations(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
  ): Promise<AiConversationListDto> {
    return this.ai.conversations(session, spaceId);
  }

  @Get('conversations/:cid')
  @ApiOkResponse({ type: AiConversationDto, description: '404 for a conversation of someone else.' })
  conversation(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('cid') conversationId: string,
  ): Promise<AiConversationDto> {
    return this.ai.conversation(session, spaceId, conversationId);
  }
}
