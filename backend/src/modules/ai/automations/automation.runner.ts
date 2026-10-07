import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import type { AppConfig } from '../../../config/configuration';
import { deterministicId } from '../../../common/ids';
import { redact } from '../../../common/log-redaction';
import { addDays, type LocalDate } from '../../../common/time/local-date';
import { datePart, instantToZoned, todayIn } from '../../../common/time/zoned';
import { withTransaction } from '../../../database/transaction';
import { AccessService } from '../../access/access.service';
import { hasLevel } from '../../access/evaluate-access';
import { CLOCK, type Clock } from '../../jobs/clock';
import { readerContext, resolveTargets } from '../../reminders/reminder-targets';
import { OperationsService } from '../../sync/operations.service';
import type { StoredRow } from '../../sync/resource-definition';
import { RESOURCE_REGISTRY } from '../../sync/resource-registry';
import { AiService } from '../ai.service';
import { itemOccurrences, loadSpaceReadView } from '../../calendar/space-read-view';
import { buildAiContext } from '../context-builder';
import {
  examReviewDate,
  isExamTitle,
  paymentNoticeDue,
  ruleParams,
  weeklySummaryKey,
  type AutomationRuleKey,
} from './automation-rules';

interface AutomationRow {
  id: string;
  space_id: string;
  created_by_actor_id: string;
  rule_key: AutomationRuleKey;
  params: unknown;
  time_zone: string;
}

/** Exams this far ahead get their review task, so it shows up in lists before the review day. */
const EXAM_LOOKAHEAD_DAYS = 14;
export const PAYMENT_NOTICE_TEXT = 'Sắp đến hạn thanh toán.';

function params(raw: unknown): Record<string, unknown> {
  const v: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/**
 * Fixed if-then rules from the Automations tab (modules.md §11), run by the worker without any AI. Every firing
 * has a unique run_key, so hourly re-runs, restarts and parallel workers never repeat a notice or a task.
 * Notices carry counts or a fixed sentence only, never titles or amounts.
 */
@Injectable()
export class AutomationRunner {
  private readonly logger = new Logger(AutomationRunner.name);

  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly operations: OperationsService,
    private readonly ai: AiService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async runDue(): Promise<void> {
    const rows: AutomationRow[] = await this.ds.query(
      `SELECT a.id, a.space_id, a.created_by_actor_id, a.rule_key, a.params, s.time_zone
         FROM automations a JOIN spaces s ON s.id = a.space_id AND s.sharing_state = 'SHARED'
        WHERE a.deleted_at IS NULL AND a.enabled = 1
        ORDER BY a.space_id, a.id`,
    );
    for (const row of rows) {
      try {
        if (row.rule_key === 'WEEKLY_SUMMARY') await this.weeklySummary(row);
        else if (row.rule_key === 'PAYMENT_DUE_REMINDER') await this.paymentDue(row);
        else await this.examReview(row);
      } catch (err) {
        this.logger.warn(JSON.stringify(redact({ event: 'automation.failed', rule: row.rule_key, error: err })));
      }
    }
    await this.ai.purgeExpired(this.config.get('ai', { infer: true }).retentionDays);
  }

  private async weeklySummary(a: AutomationRow): Promise<void> {
    const now = this.clock.now();
    const sunday = weeklySummaryKey(instantToZoned(now, a.time_zone), ruleParams(a.rule_key, params(a.params)));
    if (!sunday) return;
    const runKey = `${a.id}:week:${sunday}`;
    if (await this.hasRun(runKey)) return;

    const view = await loadSpaceReadView(this.ds.manager, a.space_id, a.time_zone);
    const actors: Array<{ actor_id: string }> = await this.ds.query(
      "SELECT actor_id FROM memberships WHERE space_id = ? AND status = 'ACTIVE' ORDER BY actor_id",
      [a.space_id],
    );
    const notices: Array<{ actorId: string; text: string }> = [];
    for (const { actor_id: actorId } of actors) {
      const ctx = await this.readerFor(a.space_id, actorId);
      if (!ctx || !hasLevel(ctx, 'calendar.view')) continue;
      // Counts per reader: each person only counts what they could open themselves.
      const week = buildAiContext(view, ctx, { allowHealth: true, today: addDays(sunday, 1), days: 7 });
      const count = (kind: string) => week.upcoming.filter((u) => u.kind === kind).length;
      notices.push({
        actorId,
        text: `Tuần tới: ${count('EVENT')} lịch, ${count('REMINDER')} nhắc nhở, ${count('TASK')} việc cần làm.`,
      });
    }
    await this.record(a, runKey, 'DONE', notices.length, async (em) => {
      for (const n of notices) {
        await this.notify(em, a, n.actorId, deterministicId('automation', a.id, sunday, n.actorId), n.text, {
          automation_id: a.id,
        });
      }
    });
  }

  private async paymentDue(a: AutomationRow): Promise<void> {
    const daysBefore = ruleParams(a.rule_key, params(a.params)).days_before ?? 3;
    const today = todayIn(a.time_zone, this.clock.now());
    const view = await loadSpaceReadView(this.ds.manager, a.space_id, a.time_zone);
    for (const item of view.items) {
      if (item.preset !== 'PAYMENT' || item.completed_at) continue;
      for (const occ of itemOccurrences(item, view, { from: today, to: addDays(today, daysBefore) })) {
        if (!paymentNoticeDue(datePart(occ.start), today, daysBefore)) continue;
        const runKey = `${a.id}:${occ.occurrenceKey}`;
        if (await this.hasRun(runKey)) continue;
        // Responsible member's people, else the creator; only those who may read the payment (PRIVATE stays private).
        const targets = await resolveTargets(this.ds.manager, this.access, a.space_id, item, [], ['IN_APP']);
        const actorIds = targets.map((t) => t.actorId).filter((x): x is string => !!x);
        await this.record(a, runKey, 'DONE', actorIds.length, async (em) => {
          for (const actorId of actorIds) {
            await this.notify(
              em,
              a,
              actorId,
              deterministicId('automation', a.id, occ.occurrenceKey, actorId),
              PAYMENT_NOTICE_TEXT,
              { item_id: item.id, occurrence_key: occ.occurrenceKey },
            );
          }
        });
      }
    }
  }

  /** Creates the review task through the normal sync write path, as the person who set up the rule. */
  private async examReview(a: AutomationRow): Promise<void> {
    const daysBefore = ruleParams(a.rule_key, params(a.params)).days_before ?? 3;
    const today = todayIn(a.time_zone, this.clock.now());
    const [device]: Array<{ id: string }> = await this.ds.query(
      "SELECT id FROM devices WHERE actor_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC, id LIMIT 1",
      [a.created_by_actor_id],
    );
    if (!device) return;
    const ctx = await readerContext(this.ds.manager, this.access, a.space_id, a.created_by_actor_id, device.id);
    if (!ctx) return;
    const view = await loadSpaceReadView(this.ds.manager, a.space_id, a.time_zone);
    const children = new Set(view.members.filter((m) => m.profile === 'CHILD').map((m) => m.id as string));

    for (const exam of view.items) {
      if (exam.kind === 'TASK' || exam.category !== 'STUDY' || !isExamTitle(String(exam.title))) continue;
      const memberIds = (exam.$children?.memberIds as string[] | undefined) ?? [];
      const involved = [...memberIds, ...(exam.responsible_member_id ? [exam.responsible_member_id as string] : [])];
      if (!involved.some((id) => children.has(id))) continue;
      if (!RESOURCE_REGISTRY.item.access.canRead(ctx, exam, null)) continue;
      for (const occ of itemOccurrences(exam, view, { from: today, to: addDays(today, EXAM_LOOKAHEAD_DAYS) })) {
        const runKey = `${a.id}:${occ.occurrenceKey}`;
        if (await this.hasRun(runKey)) continue;
        const payload = this.reviewTask(a, exam, examReviewDate(datePart(occ.start), today, daysBefore), occ);
        // Deterministic ids: a retry after a crash replays the stored result instead of creating a second task.
        const result = await this.operations.apply(
          { sessionId: '', actorId: a.created_by_actor_id, deviceId: device.id, accountId: null },
          a.space_id,
          [
            {
              operation_id: deterministicId('exam-review-op', a.id, occ.occurrenceKey),
              resource_type: 'item',
              resource_id: payload.id,
              action: 'create',
              base_revision: null,
              payload,
              client_created_at: this.clock.now().toISOString(),
              schema_version: 1,
            },
          ],
        );
        const applied = result.results[0]?.status === 'APPLIED';
        await this.record(a, runKey, applied ? 'DONE' : 'FAILED', applied ? 1 : 0);
      }
    }
  }

  private reviewTask(
    a: AutomationRow,
    exam: StoredRow,
    date: LocalDate,
    occ: { occurrenceKey: string; title?: string },
  ): Record<string, unknown> & { id: string } {
    const now = this.clock.now().toISOString();
    return {
      id: deterministicId('exam-review', a.id, occ.occurrenceKey),
      spaceId: a.space_id,
      createdByActorId: a.created_by_actor_id,
      // Same audience as the exam, so the task is never visible to more people than the exam itself.
      dataClass: exam.data_class,
      sharingScope: exam.sharing_scope,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      kind: 'TASK',
      preset: 'PERSONAL',
      title: `Ôn bài: ${occ.title ?? String(exam.title)}`.slice(0, 200),
      schedule: { allDay: true, start: date, timeZone: a.time_zone },
      memberIds: (exam.$children?.memberIds as string[] | undefined) ?? [],
      responsibleMemberId: (exam.responsible_member_id as string | null) ?? null,
      category: 'STUDY',
      priority: 'HIGH',
      attachments: [],
      showOnCalendar: true,
      calendarSystem: 'SOLAR',
    };
  }

  private async readerFor(spaceId: string, actorId: string) {
    const [device]: Array<{ id: string }> = await this.ds.query(
      "SELECT id FROM devices WHERE actor_id = ? AND status = 'ACTIVE' ORDER BY created_at, id LIMIT 1",
      [actorId],
    );
    return device ? readerContext(this.ds.manager, this.access, spaceId, actorId, device.id) : null;
  }

  private async hasRun(runKey: string): Promise<boolean> {
    const rows: unknown[] = await this.ds.query('SELECT id FROM automation_runs WHERE run_key = ?', [runKey]);
    return rows.length > 0;
  }

  /** The run row is the lock: if another worker inserted it first, this one writes nothing. */
  private async record(
    a: AutomationRow,
    runKey: string,
    status: 'DONE' | 'FAILED',
    resultCount: number,
    effects?: (em: EntityManager) => Promise<void>,
  ): Promise<void> {
    const now = this.clock.now();
    await withTransaction(this.ds, async (em) => {
      const inserted: { affectedRows?: number } = await em.query(
        `INSERT IGNORE INTO automation_runs (space_id, automation_id, rule_key, run_key, status, result_count, ran_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [a.space_id, a.id, a.rule_key, runKey, status, resultCount, now],
      );
      if (!inserted.affectedRows) return;
      if (effects) await effects(em);
      await em.query('UPDATE automations SET last_run_at = ? WHERE id = ?', [now, a.id]);
    });
  }

  private async notify(
    em: EntityManager,
    a: AutomationRow,
    actorId: string,
    id: string,
    text: string,
    ref: Record<string, unknown>,
  ): Promise<void> {
    await em.query(
      `INSERT IGNORE INTO notifications (id, actor_id, space_id, type, resource_ref, title_safe, created_at)
       VALUES (?, ?, ?, 'AUTOMATION', ?, ?, ?)`,
      [id, actorId, a.space_id, JSON.stringify(ref), text.slice(0, 200), this.clock.now()],
    );
  }
}
