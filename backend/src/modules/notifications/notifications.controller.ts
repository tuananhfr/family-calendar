import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import {
  ListNotificationsQueryDto,
  MarkNotificationsReadDto,
  NotificationListDto,
  UnreadCountDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiCookieAuth('fc_sid')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: NotificationListDto })
  list(
    @CurrentSession() session: SessionContext,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationListDto> {
    return this.notifications.list(session, query.cursor, query.limit);
  }

  @Post('read')
  @HttpCode(200)
  @ApiOkResponse({ type: UnreadCountDto, description: '422 VALIDATION_FAILED unless exactly one of ids / all.' })
  read(@CurrentSession() session: SessionContext, @Body() dto: MarkNotificationsReadDto): Promise<UnreadCountDto> {
    return this.notifications.markRead(session, dto);
  }
}
