import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { CurrentSession, type SessionContext } from '../../../common/http/current-session.decorator';
import { AiService } from '../ai.service';
import { AutomationRunListDto } from '../dto/ai.dto';

/** Rules themselves are the `automation` sync resource; only their run history lives here. */
@ApiTags('ai')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id/automations')
export class AutomationsController {
  constructor(
    private readonly ds: DataSource,
    private readonly ai: AiService,
  ) {}

  @Get('runs')
  @ApiOkResponse({ type: AutomationRunListDto, description: 'Needs `ai` VIEW; 404 like the AI routes.' })
  async runs(@CurrentSession() session: SessionContext, @Param('id') spaceId: string): Promise<AutomationRunListDto> {
    await this.ai.spaceContext(session, spaceId, 'VIEW');
    const rows: Array<{
      id: string | number;
      automation_id: string;
      rule_key: string;
      status: string;
      result_count: number;
      ran_at: Date;
    }> = await this.ds.query(
      `SELECT id, automation_id, rule_key, status, result_count, ran_at
         FROM automation_runs WHERE space_id = ? ORDER BY ran_at DESC, id DESC LIMIT 50`,
      [spaceId],
    );
    return {
      runs: rows.map((r) => ({
        id: String(r.id),
        automation_id: r.automation_id,
        rule_key: r.rule_key,
        status: r.status,
        result_count: Number(r.result_count),
        ran_at: new Date(r.ran_at).toISOString(),
      })),
    };
  }
}
