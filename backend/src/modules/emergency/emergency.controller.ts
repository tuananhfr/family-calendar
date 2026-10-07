import { Body, Controller, Get, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import {
  CloseEmergencyDto,
  CreateEmergencyDto,
  EmergencyAcceptedDto,
  EmergencyListDto,
  EmergencyLocationDto,
  EmergencyRecipientsDto,
  EmergencyRecipientsViewDto,
  EmergencyRecipientStateDto,
  EmergencyResponseDto,
  EmergencyViewDto,
  LocationAcceptedDto,
} from './dto/emergency.dto';
import { EmergencyService, SosRateLimitedError } from './emergency.service';
import { EmergencyRecipientsService } from './recipients.service';

const GROUP_404 = 'Every route here answers 404 NOT_FOUND for a GROUP Space.';

@ApiTags('emergency')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id')
export class EmergencyController {
  constructor(
    private readonly emergencies: EmergencyService,
    private readonly recipients: EmergencyRecipientsService,
  ) {}

  @Post('emergencies')
  @ApiCreatedResponse({
    type: EmergencyAcceptedDto,
    description: `201 when new, 200 when the id already exists (reconcile; a stored terminal state never reopens). ${GROUP_404}`,
  })
  @ApiOkResponse({ type: EmergencyAcceptedDto })
  @ApiTooManyRequestsResponse({
    description: 'RATE_LIMITED with Retry-After: more than 10 new SOS per hour per device.',
  })
  async create(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Body() dto: CreateEmergencyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmergencyAcceptedDto> {
    try {
      const result = await this.emergencies.create(session, spaceId, dto);
      res.status(result.created ? 201 : 200);
      return result.body;
    } catch (err) {
      if (err instanceof SosRateLimitedError) res.setHeader('Retry-After', String(err.retryAfterSeconds));
      throw err;
    }
  }

  @Get('emergencies')
  @ApiOkResponse({ type: EmergencyListDto, description: 'Only events the caller created or currently receives.' })
  async list(@CurrentSession() session: SessionContext, @Param('id') spaceId: string): Promise<EmergencyListDto> {
    return { emergencies: await this.emergencies.list(session, spaceId) };
  }

  @Get('emergencies/:eid')
  @ApiOkResponse({ type: EmergencyViewDto, description: '403 unless creator or a current recipient.' })
  get(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('eid') eventId: string,
  ): Promise<EmergencyViewDto> {
    return this.emergencies.get(session, spaceId, eventId);
  }

  @Post('emergencies/:eid/responses')
  @HttpCode(200)
  @ApiOkResponse({
    type: EmergencyRecipientStateDto,
    description: '403 unless a current recipient (the creator cannot respond); 409 EMERGENCY_CLOSED once closed.',
  })
  respond(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('eid') eventId: string,
    @Body() dto: EmergencyResponseDto,
  ): Promise<EmergencyRecipientStateDto> {
    return this.emergencies.respond(session, spaceId, eventId, dto);
  }

  @Post('emergencies/:eid/close')
  @HttpCode(200)
  @ApiOkResponse({
    type: EmergencyAcceptedDto,
    description: 'Creator only. An already closed event is returned unchanged (first close wins).',
  })
  close(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('eid') eventId: string,
    @Body() dto: CloseEmergencyDto,
  ): Promise<EmergencyAcceptedDto> {
    return this.emergencies.close(session, spaceId, eventId, dto);
  }

  @Post('emergencies/:eid/location')
  @HttpCode(201)
  @ApiCreatedResponse({
    type: LocationAcceptedDto,
    description: 'Creator only; 409 EMERGENCY_CLOSED once the event is closed.',
  })
  location(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('eid') eventId: string,
    @Body() dto: EmergencyLocationDto,
  ): Promise<LocationAcceptedDto> {
    return this.emergencies.addLocation(session, spaceId, eventId, dto);
  }

  @Get('emergency-recipients')
  @ApiOkResponse({ type: EmergencyRecipientsViewDto })
  recipientList(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
  ): Promise<EmergencyRecipientsViewDto> {
    return this.recipients.view(session, spaceId);
  }

  @Put('emergency-recipients')
  @ApiOkResponse({
    type: EmergencyRecipientsViewDto,
    description: 'members EDIT (OWNER/ADULT by default); 422 if a member is not in this Space.',
  })
  replaceRecipients(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Body() dto: EmergencyRecipientsDto,
  ): Promise<EmergencyRecipientsViewDto> {
    return this.recipients.replace(session, spaceId, dto);
  }
}
