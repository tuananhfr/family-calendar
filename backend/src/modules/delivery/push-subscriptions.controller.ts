import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import {
  CreatePushSubscriptionDto,
  PushSubscriptionCreatedDto,
  PushSubscriptionListDto,
} from './dto/push-subscription.dto';
import { PushSubscriptionsService } from './push-subscriptions.service';

@ApiTags('notifications')
@ApiCookieAuth('fc_sid')
@Controller('push-subscriptions')
export class PushSubscriptionsController {
  constructor(private readonly subscriptions: PushSubscriptionsService) {}

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({
    type: PushSubscriptionCreatedDto,
    description: 'Upsert by endpoint: the same browser endpoint keeps its id and moves to the calling device.',
  })
  create(
    @CurrentSession() session: SessionContext,
    @Body() dto: CreatePushSubscriptionDto,
  ): Promise<PushSubscriptionCreatedDto> {
    return this.subscriptions.upsert(session, dto);
  }

  @Get()
  @ApiOkResponse({ type: PushSubscriptionListDto })
  async list(@CurrentSession() session: SessionContext): Promise<PushSubscriptionListDto> {
    return { subscriptions: await this.subscriptions.list(session) };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: '404 NOT_FOUND for an id that is not the caller own.' })
  async remove(@CurrentSession() session: SessionContext, @Param('id') id: string): Promise<void> {
    await this.subscriptions.remove(session, id);
  }
}
