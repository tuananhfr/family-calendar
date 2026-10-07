import { addDays } from '../../../common/time/local-date';
import type { AiToolDef } from '../tools';
import type { AiCompletion, AiMessage, AiProvider } from './ai-provider';

interface FakeContext {
  today?: string;
  members?: Array<{ name: string }>;
  upcoming?: unknown[];
}

/**
 * Deterministic stand-in for tests and E2E (AI_PROVIDER=fake): never calls a network service. Scripted replies win;
 * otherwise a few keyword rules produce the drafts the UI flows need.
 */
export class FakeAiProvider implements AiProvider {
  calls: Array<{ system: string; messages: AiMessage[]; tools: AiToolDef[] }> = [];
  private scripted: AiCompletion[] = [];
  private failure: Error | null = null;

  script(completion: AiCompletion): void {
    this.scripted.push(completion);
  }

  fail(err: Error): void {
    this.failure = err;
  }

  reset(): void {
    this.calls = [];
    this.scripted = [];
    this.failure = null;
  }

  complete(input: { system: string; messages: AiMessage[]; tools: AiToolDef[] }): Promise<AiCompletion> {
    this.calls.push({ system: input.system, messages: input.messages.map((m) => ({ ...m })), tools: input.tools });
    if (this.failure) {
      const err = this.failure;
      this.failure = null;
      return Promise.reject(err);
    }
    const next = this.scripted.shift();
    if (next) return Promise.resolve(next);
    return Promise.resolve(this.byKeywords(input.system, input.messages.at(-1)?.content ?? ''));
  }

  private byKeywords(system: string, text: string): AiCompletion {
    const ctx = readContext(system);
    const today = ctx.today ?? '2026-01-01';
    const lower = text.toLocaleLowerCase('vi');
    if (lower.includes('tóm tắt')) {
      return {
        text: 'Đây là tóm tắt tuần tới.',
        toolCalls: [
          {
            name: 'summarize_period',
            input: {
              from: today,
              to: addDays(today, 6),
              summary: `Có ${ctx.upcoming?.length ?? 0} mục trong hai tuần tới.`,
            },
          },
        ],
      };
    }
    if (/(tạo|thêm|nhắc|đặt lịch)/.test(lower)) {
      const medication = lower.includes('thuốc');
      const kind = lower.includes('việc') ? 'TASK' : lower.includes('nhắc') || medication ? 'REMINDER' : 'EVENT';
      const member = (ctx.members ?? []).find((m) => lower.includes(m.name.toLocaleLowerCase('vi')));
      return {
        text: 'Mình đã soạn bản nháp, bạn kiểm tra rồi bấm "Thêm" nhé.',
        toolCalls: [
          {
            name: 'propose_item',
            input: {
              kind,
              preset: medication ? 'MEDICATION' : kind === 'TASK' ? 'PERSONAL' : kind === 'REMINDER' ? 'REMEMBER' : 'EVENT',
              title: medication ? 'Uống thuốc' : text.slice(0, 80),
              date: addDays(today, 1),
              time: '08:00',
              end_time: null,
              category: medication ? 'HEALTH' : 'FAMILY',
              member_name: member?.name ?? null,
              note: null,
            },
          },
        ],
      };
    }
    return { text: 'Mình có thể giúp bạn tạo lịch, nhắc nhở hoặc việc cần làm.', toolCalls: [] };
  }
}

function readContext(system: string): FakeContext {
  const match = /<family_context>([\s\S]*?)<\/family_context>/.exec(system);
  if (!match) return {};
  try {
    return JSON.parse(match[1]) as FakeContext;
  } catch {
    return {};
  }
}
