import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  CurrentSession,
  MaybeSession,
  OptionalSession,
  type SessionContext,
} from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import { setSessionCookies } from '../../common/http/session-cookies';
import { isClientId } from '../../common/ids';
import { DevicesService } from './devices.service';
import { DeviceDto, DeviceListDto } from './dto/device.dto';
import { RegisterDeviceDto, RegisterDeviceResponseDto } from './dto/register-device.dto';
import { SessionsService } from './sessions.service';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly sessions: SessionsService,
  ) {}

  @Post()
  @OptionalSession()
  @RateLimit({ bucket: 'devices', limit: 20, windowSeconds: 3600, by: 'ip' })
  @HttpCode(201)
  @ApiCreatedResponse({ type: RegisterDeviceResponseDto, description: 'Sets fc_sid (HttpOnly) and fc_csrf cookies.' })
  async register(
    @Body() dto: RegisterDeviceDto,
    @MaybeSession() current: SessionContext | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RegisterDeviceResponseDto> {
    const issued = await this.devices.register(dto, current, req.get('user-agent'));
    setSessionCookies(res, issued, this.sessions.cookieOptions);
    return { actorId: dto.actorId, deviceId: dto.deviceId };
  }

  @Get()
  @ApiCookieAuth('fc_sid')
  @ApiOkResponse({ type: DeviceListDto })
  async list(@CurrentSession() session: SessionContext): Promise<DeviceListDto> {
    return { devices: await this.devices.list(session) };
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @ApiCookieAuth('fc_sid')
  @ApiOkResponse({ type: DeviceDto })
  async revoke(@CurrentSession() session: SessionContext, @Param('id') id: string): Promise<DeviceDto> {
    if (!isClientId(id)) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    return this.devices.revoke(session, id);
  }
}
