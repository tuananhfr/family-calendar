import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { redact } from '../../common/log-redaction';
import { todayIn } from '../../common/time/zoned';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import type { SpaceAccessContext } from '../access/evaluate-access';
import type { Level } from '../access/role-matrix';
import { sharedSpaceContext } from '../access/shared-space-context';
import { loadSpaceReadView } from '../calendar/space-read-view';
import { CLOCK, type Clock } from '../jobs/clock';
import { aiVisibleMembers, buildAiContext, type AiContext } from './context-builder';
import type {
  AiConsentDto,
  AiConsentRequestDto,
  AiConversationDto,
  AiConversationListDto,
  AiMessageRequestDto,
  AiMessageResponseDto,
  AiStatusDto,
} from './dto/ai.dto';
import { AI_PROVIDER, AiProviderError, type AiMessage, type AiProvider } from './providers/ai-provider';
import { AI_TOOLS, parseToolCall, type AiDraft } from './tools';

/** Bump when the consent text shown in the app changes; older consents then stop counting. */
export const AI_CONSENT_VERSION = '2026-10';
const HISTORY_MESSAGES = 20;
const LIST_LIMIT = 50;

interface ConsentRow {
  version: string;
  allow_health: number;
  accepted_at: Date;
}

function parseDrafts(raw: unknown): AiDraft[] {
  if (raw === null || raw === undefined) return [];
  const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(value) ? (value as AiDraft[]) : [];
}

function systemPrompt(context: AiContext): string {
  return [
    'Bạn là trợ lý của ứng dụng Lịch Gia Đình, trả lời bằng tiếng Việt, ngắn gọn và thân thiện.',
    'Bạn KHÔNG lưu hay sửa dữ liệu. Khi người dùng muốn tạo lịch, nhắc nhở hoặc việc cần làm, hãy gọi công cụ',
    'propose_item (mỗi mục một lần gọi); muốn tạo thời khóa biểu thì gọi propose_timetable; muốn tóm tắt một',
    'khoảng thời gian thì gọi summarize_period. Người dùng sẽ tự xem bản nháp và bấm "Thêm".',
    'Chỉ dựa vào ngữ cảnh dưới đây; nếu thiếu thông tin (ví dụ giờ), để trống trường đó thay vì đoán.',
    'Ngữ cảnh chỉ gồm những gì người hỏi được phép xem và đã đồng ý chia sẻ với trợ lý.',
    `<family_context>${JSON.stringify(context)}</family_context>`,
  ].join('\n');
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** AI exists only for Spaces the server holds and shares (AI-001); everything else is 404. */
  spaceContext(session: SessionContext, spaceId: string, level: Level): Promise<SpaceAccessContext> {
    return sharedSpaceContext(this.ds, this.access, session, spaceId, 'ai', level);
  }

  async status(session: SessionContext, spaceId: string): Promise<AiStatusDto> {
    await this.spaceContext(session, spaceId, 'VIEW');
    const consent = await this.consentRow(spaceId, session.actorId);
    return { configured: this.provider !== null, consent: consent ? this.consentDto(consent) : null };
  }

  async setConsent(session: SessionContext, spaceId: string, dto: AiConsentRequestDto): Promise<AiConsentDto> {
    await this.spaceContext(session, spaceId, 'EDIT');
    if (!dto.accepted) {
      await this.ds.query('DELETE FROM ai_consents WHERE space_id = ? AND actor_id = ?', [spaceId, session.actorId]);
      return { accepted: false, allow_health: false, accepted_at: null, version: AI_CONSENT_VERSION };
    }
    const now = this.clock.now();
    await this.ds.query(
      `INSERT INTO ai_consents (space_id, actor_id, version, allow_health, accepted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE allow_health = VALUES(allow_health), updated_at = VALUES(updated_at),
         accepted_at = IF(version = VALUES(version), accepted_at, VALUES(accepted_at)), version = VALUES(version)`,
      [spaceId, session.actorId, AI_CONSENT_VERSION, dto.allow_health ? 1 : 0, now, now],
    );
    const row = await this.consentRow(spaceId, session.actorId);
    return this.consentDto(row!);
  }

  async send(session: SessionContext, spaceId: string, dto: AiMessageRequestDto): Promise<AiMessageResponseDto> {
    const ctx = await this.spaceContext(session, spaceId, 'EDIT');
    const provider = this.provider;
    if (!provider) throw new ApiError(ErrorCode.AI_NOT_CONFIGURED, 503);
    const consent = await this.consentRow(spaceId, session.actorId);
    if (!consent) throw new ApiError(ErrorCode.AI_CONSENT_REQUIRED, 403);

    const history: AiMessage[] = [];
    let conversationId = dto.conversation_id;
    if (conversationId) {
      await this.ownConversation(session, spaceId, conversationId);
      const rows: Array<{ role: 'user' | 'assistant'; text: string }> = await this.ds.query(
        'SELECT role, text FROM ai_messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT ?',
        [conversationId, HISTORY_MESSAGES],
      );
      history.push(...rows.reverse().map((r) => ({ role: r.role, content: r.text })));
      // The API expects the conversation to start with the user.
      while (history.length > 0 && history[0].role !== 'user') history.shift();
    }

    const [space]: Array<{ time_zone: string }> = await this.ds.query('SELECT time_zone FROM spaces WHERE id = ?', [
      spaceId,
    ]);
    const now = this.clock.now();
    const view = await loadSpaceReadView(this.ds.manager, spaceId, space.time_zone);
    const context = buildAiContext(view, ctx, {
      allowHealth: Number(consent.allow_health) === 1,
      today: todayIn(space.time_zone, now),
    });

    const started = Date.now();
    let completion;
    try {
      completion = await provider.complete({
        system: systemPrompt(context),
        messages: [...history, { role: 'user', content: dto.text }],
        tools: AI_TOOLS,
      });
    } catch (err) {
      const reason = err instanceof AiProviderError ? err.reason : 'UNAVAILABLE';
      // Only the reason and error name: provider messages can quote the prompt back.
      this.logger.warn(JSON.stringify(redact({ event: 'ai.provider_failed', reason, error: err })));
      if (reason === 'MISCONFIGURED') throw new ApiError(ErrorCode.AI_NOT_CONFIGURED, 503);
      throw new ApiError(ErrorCode.TEMPORARILY_UNAVAILABLE, 503);
    }

    const members = aiVisibleMembers(view.members, ctx).map((m) => ({ id: m.id as string, name: String(m.display_name) }));
    const drafts = completion.toolCalls
      .map((call) => parseToolCall(call, members))
      .filter((d): d is AiDraft => d !== null);
    const reply =
      completion.text ||
      (drafts.length > 0 ? 'Mình đã soạn bản nháp, bạn kiểm tra rồi bấm "Thêm" nhé.' : 'Xin lỗi, mình chưa có câu trả lời.');

    const isNew = !conversationId;
    conversationId ??= randomUUID();
    const cid = conversationId;
    await withTransaction(this.ds, async (em) => {
      const at = this.clock.now();
      if (isNew) {
        await em.query(
          'INSERT INTO ai_conversations (id, space_id, actor_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [cid, spaceId, session.actorId, at, at],
        );
      } else {
        await em.query('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [at, cid]);
      }
      await em.query(
        `INSERT INTO ai_messages (conversation_id, role, text, drafts, created_at)
         VALUES (?, 'user', ?, NULL, ?), (?, 'assistant', ?, ?, ?)`,
        [cid, dto.text, at, cid, reply, JSON.stringify(drafts), at],
      );
    });

    this.logger.log(
      JSON.stringify(
        redact({
          event: 'ai.message',
          space_id: spaceId,
          new_conversation: isNew,
          tool_calls: completion.toolCalls.length,
          drafts: drafts.length,
          context_items: context.upcoming.length,
          ms: Date.now() - started,
        }),
      ),
    );
    return { conversation_id: cid, reply, drafts };
  }

  async conversations(session: SessionContext, spaceId: string): Promise<AiConversationListDto> {
    await this.spaceContext(session, spaceId, 'VIEW');
    const rows: Array<{ id: string; created_at: Date; updated_at: Date; message_count: string | number; first: string | null }> =
      await this.ds.query(
        `SELECT c.id, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS message_count,
                (SELECT m.text FROM ai_messages m WHERE m.conversation_id = c.id AND m.role = 'user'
                  ORDER BY m.seq LIMIT 1) AS first
           FROM ai_conversations c
          WHERE c.space_id = ? AND c.actor_id = ?
          ORDER BY c.updated_at DESC, c.id DESC LIMIT ?`,
        [spaceId, session.actorId, LIST_LIMIT],
      );
    return {
      conversations: rows.map((r) => ({
        id: r.id,
        preview: (r.first ?? '').slice(0, 80),
        message_count: Number(r.message_count),
        created_at: new Date(r.created_at).toISOString(),
        updated_at: new Date(r.updated_at).toISOString(),
      })),
    };
  }

  async conversation(session: SessionContext, spaceId: string, conversationId: string): Promise<AiConversationDto> {
    await this.spaceContext(session, spaceId, 'VIEW');
    await this.ownConversation(session, spaceId, conversationId);
    const rows: Array<{ role: 'user' | 'assistant'; text: string; drafts: unknown; created_at: Date }> =
      await this.ds.query(
        'SELECT role, text, drafts, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY seq',
        [conversationId],
      );
    return {
      id: conversationId,
      messages: rows.map((r) => ({
        role: r.role,
        text: r.text,
        drafts: parseDrafts(r.drafts),
        created_at: new Date(r.created_at).toISOString(),
      })),
    };
  }

  /** Deletes conversations idle for longer than the retention period (modules.md §11, default 30 days). */
  async purgeExpired(retentionDays: number): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - retentionDays * 86_400_000);
    const result: { affectedRows?: number } = await this.ds.query('DELETE FROM ai_conversations WHERE updated_at < ?', [
      cutoff,
    ]);
    return result.affectedRows ?? 0;
  }

  /** A conversation belongs to one person; anyone else (OWNER included) gets 404. */
  private async ownConversation(session: SessionContext, spaceId: string, conversationId: string): Promise<void> {
    const [row]: Array<{ id: string }> = isClientId(conversationId)
      ? await this.ds.query('SELECT id FROM ai_conversations WHERE id = ? AND space_id = ? AND actor_id = ?', [
          conversationId,
          spaceId,
          session.actorId,
        ])
      : [];
    if (!row) throw new ApiError(ErrorCode.NOT_FOUND, 404);
  }

  private async consentRow(spaceId: string, actorId: string): Promise<ConsentRow | null> {
    const [row]: ConsentRow[] = await this.ds.query(
      'SELECT version, allow_health, accepted_at FROM ai_consents WHERE space_id = ? AND actor_id = ? AND version = ?',
      [spaceId, actorId, AI_CONSENT_VERSION],
    );
    return row ?? null;
  }

  private consentDto(row: ConsentRow): AiConsentDto {
    return {
      accepted: true,
      allow_health: Number(row.allow_health) === 1,
      accepted_at: new Date(row.accepted_at).toISOString(),
      version: row.version,
    };
  }
}
