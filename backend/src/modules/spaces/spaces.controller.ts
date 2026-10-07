import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { BootstrapService } from './bootstrap.service';
import {
  ActivateSpaceDto,
  ActivateSpaceResponseDto,
  BootstrapChunkDto,
  BootstrapChunkResponseDto,
  BootstrapSpaceDto,
  BootstrapSpaceResponseDto,
  SpaceListDto,
  SpaceSummaryDto,
} from './dto/bootstrap.dto';
import { SpacesService } from './spaces.service';

@ApiTags('spaces')
@ApiCookieAuth('fc_sid')
@Controller('spaces')
export class SpacesController {
  constructor(
    private readonly spaces: SpacesService,
    private readonly bootstrap: BootstrapService,
  ) {}

  @Get()
  @ApiOkResponse({ type: SpaceListDto, description: 'Spaces with an ACTIVE membership; INITIALIZING ones only for their creator.' })
  async list(@CurrentSession() session: SessionContext): Promise<SpaceListDto> {
    return { spaces: await this.spaces.list(session) };
  }

  @Post('bootstrap')
  @HttpCode(201)
  @ApiCreatedResponse({
    type: BootstrapSpaceResponseDto,
    description: 'Creates the Space INITIALIZING with default roles and the caller as owner; a retry by the creator answers the same. 409 ID_COLLISION when the id belongs to someone else.',
  })
  start(@CurrentSession() session: SessionContext, @Body() dto: BootstrapSpaceDto): Promise<BootstrapSpaceResponseDto> {
    return this.bootstrap.start(session, dto.space);
  }

  @Get(':id')
  @ApiOkResponse({ type: SpaceSummaryDto })
  get(@CurrentSession() session: SessionContext, @Param('id') id: string): Promise<SpaceSummaryDto> {
    return this.spaces.get(session, id);
  }

  @Post(':id/bootstrap/chunks')
  @HttpCode(200)
  @ApiOkResponse({
    type: BootstrapChunkResponseDto,
    description: 'All-or-nothing per chunk. Errors carry fields.chunk_id + fields.index (+ records.<i>.<field>).',
  })
  chunk(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() dto: BootstrapChunkDto,
  ): Promise<BootstrapChunkResponseDto> {
    return this.bootstrap.chunk(session, id, dto);
  }

  @Post(':id/bootstrap/activate')
  @HttpCode(200)
  @ApiOkResponse({ type: ActivateSpaceResponseDto, description: '422 COUNT_MISMATCH per type keeps the Space INITIALIZING.' })
  activate(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body() dto: ActivateSpaceDto,
  ): Promise<ActivateSpaceResponseDto> {
    return this.bootstrap.activate(session, id, dto);
  }
}
