import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { AccessService } from '../access/access.service';
import { hasLevel } from '../access/evaluate-access';
import { sharedSpaceContext } from '../access/shared-space-context';
import { IntegrationsDto, type IntegrationStatusDto } from '../ics/dto/ics.dto';
import { IcsService } from '../ics/ics.service';
import { INTEGRATION_PROVIDERS } from './entities/integration.entity';

const NOT_CONFIGURED = 'Chưa kết nối — cần quản trị máy chủ cấu hình.';
const OPEN_API = 'Dùng link ICS đăng ký để đưa lịch gia đình vào Google Calendar hoặc ứng dụng lịch khác.';

/** modules.md §12, V1: a status frame only; no third-party connection can be made yet. */
@ApiTags('integrations')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id/integrations')
export class IntegrationsController {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly ics: IcsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: IntegrationsDto, description: 'Needs `settings` VIEW; 404 for a Space the server does not hold.' })
  async status(@CurrentSession() session: SessionContext, @Param('id') spaceId: string): Promise<IntegrationsDto> {
    const ctx = await sharedSpaceContext(this.ds, this.access, session, spaceId, 'settings', 'VIEW');
    const connected: Array<{ provider: string; status: 'CONNECTED' | 'ERROR' }> = await this.ds.query(
      'SELECT provider, status FROM integrations WHERE space_id = ?',
      [spaceId],
    );
    const stored = new Map(connected.map((r) => [r.provider, r.status]));
    const integrations: IntegrationStatusDto[] = INTEGRATION_PROVIDERS.map((provider) => {
      const status = stored.get(provider);
      if (status) return { provider, status, can_connect: false, message: '' };
      if (provider === 'OPEN_API') return { provider, status: 'AVAILABLE', can_connect: false, message: OPEN_API };
      return { provider, status: 'NOT_CONFIGURED', can_connect: false, message: NOT_CONFIGURED };
    });
    const canManage = hasLevel(ctx, 'backup', 'EDIT');
    return {
      integrations,
      can_manage_ics: canManage,
      ics_feeds: canManage ? await this.ics.activeFeeds(spaceId) : [],
    };
  }
}
