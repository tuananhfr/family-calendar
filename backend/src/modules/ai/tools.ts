import { isLocalDate } from '../../common/time/local-date';
import { CATEGORIES, ITEM_KINDS, PRESETS_BY_KIND, isPresetOfKind, type ItemKind } from '../sync/domain-enums';

export interface AiToolDef {
  name: string;
  description: string;
  /** JSON Schema; every object is closed (additionalProperties: false) so strict tool use can enforce it. */
  inputSchema: Record<string, unknown>;
}

export interface ItemDraft {
  type: 'ITEM';
  kind: ItemKind;
  preset: string;
  title: string;
  date: string;
  time: string | null;
  end_time: string | null;
  all_day: boolean;
  category: string;
  member_id: string | null;
  member_name: string | null;
  note: string | null;
}

export interface TimetableDraft {
  type: 'TIMETABLE';
  member_id: string | null;
  member_name: string | null;
  entries: Array<{ weekday: number; start: string; end: string; subject: string; room: string | null }>;
}

export interface SummaryDraft {
  type: 'SUMMARY';
  from: string;
  to: string;
  summary: string;
}

/** Nothing here is ever written by the server: the user confirms a draft and the app saves it the normal way. */
export type AiDraft = ItemDraft | TimetableDraft | SummaryDraft;

const nullableString = { type: ['string', 'null'] };
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const AI_TOOLS: AiToolDef[] = [
  {
    name: 'propose_item',
    description:
      'Soạn bản nháp MỘT lịch (EVENT), nhắc nhở (REMINDER) hoặc việc cần làm (TASK) để người dùng xác nhận. ' +
      'Không lưu gì: người dùng tự bấm "Thêm". date dạng YYYY-MM-DD, time/end_time dạng HH:mm hoặc null nếu cả ngày ' +
      'hoặc chưa rõ giờ. member_name là tên gọi của thành viên trong ngữ cảnh, null nếu không có.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: [...ITEM_KINDS] },
        preset: { type: 'string', enum: [...new Set(Object.values(PRESETS_BY_KIND).flat())] },
        title: { type: 'string' },
        date: { type: 'string', format: 'date' },
        time: nullableString,
        end_time: nullableString,
        category: { type: 'string', enum: [...CATEGORIES] },
        member_name: nullableString,
        note: nullableString,
      },
      required: ['kind', 'preset', 'title', 'date', 'time', 'end_time', 'category', 'member_name', 'note'],
    },
  },
  {
    name: 'propose_timetable',
    description:
      'Soạn bản nháp thời khóa biểu hằng tuần cho một thành viên. weekday: 1 = Thứ Hai … 7 = Chủ nhật; ' +
      'start/end dạng HH:mm. Không lưu gì.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        member_name: nullableString,
        entries: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              weekday: { type: 'integer' },
              start: { type: 'string' },
              end: { type: 'string' },
              subject: { type: 'string' },
              room: nullableString,
            },
            required: ['weekday', 'start', 'end', 'subject', 'room'],
          },
        },
      },
      required: ['member_name', 'entries'],
    },
  },
  {
    name: 'summarize_period',
    description: 'Trả một thẻ tóm tắt lịch của gia đình trong khoảng from–to (YYYY-MM-DD), chỉ dựa trên ngữ cảnh được cung cấp.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        from: { type: 'string', format: 'date' },
        to: { type: 'string', format: 'date' },
        summary: { type: 'string' },
      },
      required: ['from', 'to', 'summary'],
    },
  },
];

const DEFAULT_PRESET: Record<ItemKind, string> = { EVENT: 'EVENT', REMINDER: 'REMEMBER', TASK: 'PERSONAL' };

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > 0 ? s.slice(0, max) : null;
}

function time(v: unknown): string | null {
  return typeof v === 'string' && HH_MM.test(v) ? v : null;
}

function resolveMember(
  v: unknown,
  members: ReadonlyArray<{ id: string; name: string }>,
): { member_id: string | null; member_name: string | null } {
  const name = cleanText(v, 50);
  if (!name) return { member_id: null, member_name: null };
  const match = members.find((m) => m.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'));
  return match ? { member_id: match.id, member_name: match.name } : { member_id: null, member_name: name };
}

/**
 * Validates one tool call from the model (never trusted, strict mode or not) and turns it into a draft; anything
 * unusable is dropped rather than guessed.
 */
export function parseToolCall(
  call: { name: string; input: unknown },
  members: ReadonlyArray<{ id: string; name: string }>,
): AiDraft | null {
  const input = record(call.input);
  if (!input) return null;
  switch (call.name) {
    case 'propose_item': {
      const kind = (ITEM_KINDS as readonly string[]).includes(input.kind as string) ? (input.kind as ItemKind) : null;
      const title = cleanText(input.title, 200);
      const date = isLocalDate(input.date) ? input.date : null;
      if (!kind || !title || !date) return null;
      const start = time(input.time);
      const end = start ? time(input.end_time) : null;
      const preset = typeof input.preset === 'string' && isPresetOfKind(kind, input.preset) ? input.preset : DEFAULT_PRESET[kind];
      return {
        type: 'ITEM',
        kind,
        preset,
        title,
        date,
        time: start,
        end_time: end && end > (start ?? '') ? end : null,
        all_day: start === null,
        category: (CATEGORIES as readonly string[]).includes(input.category as string) ? (input.category as string) : 'OTHER',
        ...resolveMember(input.member_name, members),
        note: cleanText(input.note, 2000),
      };
    }
    case 'propose_timetable': {
      const rows = Array.isArray(input.entries) ? input.entries.slice(0, 80) : [];
      const entries: TimetableDraft['entries'] = [];
      for (const raw of rows) {
        const r = record(raw);
        if (!r) continue;
        const weekday = r.weekday;
        const start = time(r.start);
        const end = time(r.end);
        const subject = cleanText(r.subject, 100);
        if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) continue;
        if (!start || !end || end <= start || !subject) continue;
        entries.push({ weekday, start, end, subject, room: cleanText(r.room, 50) });
      }
      if (entries.length === 0) return null;
      return { type: 'TIMETABLE', ...resolveMember(input.member_name, members), entries };
    }
    case 'summarize_period': {
      const summary = cleanText(input.summary, 2000);
      if (!isLocalDate(input.from) || !isLocalDate(input.to) || !summary || input.to < input.from) return null;
      return { type: 'SUMMARY', from: input.from, to: input.to, summary };
    }
    default:
      return null;
  }
}
