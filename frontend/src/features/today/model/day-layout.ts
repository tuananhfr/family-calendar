import type { Item } from "@/core/model/item";
import type { Member } from "@/core/model/member";
import type { Occurrence } from "@/core/recurrence/types";
import type { LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";

export interface DayEntry {
  occurrence: Occurrence;
  item: Item;
}

export interface LayoutOptions {
  startHour: number;
  endHour: number;
  pxPerHour: number;
  /** Day being drawn; defaults to each occurrence's start date. Needed to clip overnight events. */
  date?: LocalDate;
}

export interface PositionedBlock {
  occurrence: Occurrence;
  item: Item;
  top: number;
  height: number;
  /** 0-based lane inside its overlap cluster, out of `lanes`. */
  lane: number;
  lanes: number;
}

export interface ColumnBlock extends PositionedBlock {
  /** Number of adjacent member columns this block covers, starting at its own column. */
  span: number;
}

export interface MemberColumn {
  member: Member | "SHARED";
  blocks: ColumnBlock[];
}

/** An event without an end is drawn as half an hour. */
const DEFAULT_MINUTES = 30;
/** Very short events still get a tappable block, and lanes use the drawn size so blocks never overlap. */
const MIN_VISIBLE_MINUTES = 15;

function minutesOf(value: string): number {
  return Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));
}

interface Span {
  from: number;
  to: number;
}

function visibleSpan(occ: Occurrence, opts: LayoutOptions): Span | null {
  if (occ.allDay) return null;
  const day = opts.date ?? datePart(occ.start);
  const startDay = datePart(occ.start);
  if (startDay > day) return null;
  const from = startDay < day ? 0 : minutesOf(occ.start);
  let to: number;
  if (occ.end === undefined) to = startDay < day ? 0 : from + DEFAULT_MINUTES;
  else if (datePart(occ.end) > day) to = 24 * 60;
  else if (datePart(occ.end) < day) return null;
  else to = minutesOf(occ.end);
  const lo = Math.max(from, opts.startHour * 60);
  const hi = Math.min(to, opts.endHour * 60);
  if (hi <= lo) return null;
  return { from: lo, to: Math.max(hi, lo + MIN_VISIBLE_MINUTES) };
}

function overlaps(a: Span, b: Span): boolean {
  return a.from < b.to && b.from < a.to;
}

/** Positions timed occurrences on an hour grid; overlapping ones share the width in lanes. All-day ones are skipped. */
export function layoutDay(occs: DayEntry[], opts: LayoutOptions): PositionedBlock[] {
  const placed = occs
    .map((entry, index) => ({ entry, index, span: visibleSpan(entry.occurrence, opts) }))
    .filter((p): p is { entry: DayEntry; index: number; span: Span } => p.span !== null);
  const order = [...placed].sort((a, b) => a.span.from - b.span.from || b.span.to - a.span.to || a.index - b.index);

  const lane = new Map<number, number>();
  const lanes = new Map<number, number>();
  let cluster: number[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    for (const i of cluster) lanes.set(i, laneEnds.length);
    cluster = [];
    laneEnds = [];
  };
  for (const p of order) {
    if (p.span.from >= clusterEnd) close();
    let l = laneEnds.findIndex((end) => end <= p.span.from);
    if (l === -1) l = laneEnds.length;
    laneEnds[l] = p.span.to;
    lane.set(p.index, l);
    cluster.push(p.index);
    clusterEnd = Math.max(clusterEnd, p.span.to);
  }
  close();

  const px = opts.pxPerHour / 60;
  return placed.map(({ entry, index, span }) => ({
    occurrence: entry.occurrence,
    item: entry.item,
    top: (span.from - opts.startHour * 60) * px,
    height: (span.to - span.from) * px,
    lane: lane.get(index)!,
    lanes: lanes.get(index)!,
  }));
}

/** All-day occurrences, drawn in the strip above the hour grid. */
export function allDayOf(occs: DayEntry[]): DayEntry[] {
  return occs.filter((e) => e.occurrence.allDay);
}

function runsOf(indexes: number[]): number[][] {
  const runs: number[][] = [];
  for (const i of indexes) {
    const last = runs.at(-1);
    if (last && last.at(-1) === i - 1) last.push(i);
    else runs.push([i]);
  }
  return runs;
}

/**
 * One column per visible ACTIVE member (+ a shared column for events without members when showing everyone).
 * An event of several adjacent members spans their columns (IMG-A "Ăn trưa cùng gia đình") unless another event
 * overlaps it in one of those columns; then each member column gets its own block.
 */
export function columnsFor(
  members: Member[],
  occs: DayEntry[],
  filter: string[] | "ALL",
  opts: LayoutOptions = { startHour: 0, endHour: 24, pxPerHour: 48 },
): MemberColumn[] {
  const cols = members.filter((m) => m.status === "ACTIVE" && (filter === "ALL" || filter.includes(m.id)));
  const colIndex = new Map(cols.map((m, i) => [m.id, i]));
  const shared: DayEntry[] = [];
  const timed = occs
    .filter((e) => !e.occurrence.allDay)
    .map((entry) => {
      const idx = [...new Set(entry.item.memberIds.map((id) => colIndex.get(id)).filter((i): i is number => i !== undefined))].sort(
        (a, b) => a - b,
      );
      return { entry, idx, span: visibleSpan(entry.occurrence, opts) };
    })
    .filter((t) => t.span !== null);

  for (const t of timed) if (t.entry.item.memberIds.length === 0 && filter === "ALL") shared.push(t.entry);

  const anchored: Array<Array<{ entry: DayEntry; span: number }>> = cols.map(() => []);
  for (const t of timed) {
    for (const run of runsOf(t.idx)) {
      const collides =
        run.length > 1 && timed.some((o) => o !== t && o.idx.some((c) => run.includes(c)) && overlaps(o.span!, t.span!));
      if (collides) for (const c of run) anchored[c].push({ entry: t.entry, span: 1 });
      else anchored[run[0]].push({ entry: t.entry, span: run.length });
    }
  }

  const result: MemberColumn[] = cols.map((member, i) => {
    const blocks = layoutDay(
      anchored[i].map((a) => a.entry),
      opts,
    );
    return { member, blocks: blocks.map((b, j) => ({ ...b, span: anchored[i][j].span })) };
  });
  if (shared.length > 0) result.push({ member: "SHARED", blocks: layoutDay(shared, opts).map((b) => ({ ...b, span: 1 })) });
  return result;
}
