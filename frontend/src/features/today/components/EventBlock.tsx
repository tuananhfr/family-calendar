"use client";

import { CATEGORY_META } from "@/design/categories";
import { cn } from "@/design/cn";
import { timePart } from "@/core/time/zoned";
import type { ColumnBlock } from "../model/day-layout";

/** Two lines need ~34px; shorter blocks fold the time onto the title line so nothing is clipped mid-glyph. */
const TWO_LINE_MIN_PX = 34;
const INSET_PX = 3;

export function blockTimeLabel(block: Pick<ColumnBlock, "occurrence">): string {
  const from = timePart(block.occurrence.start);
  const to = block.occurrence.end ? timePart(block.occurrence.end) : null;
  return to ? `${from} - ${to}` : (from ?? "");
}

/** A positioned event on the member grid; spans adjacent member columns for shared events (IMG-A "Ăn trưa cùng gia đình"). */
/** `dense`: week columns are too narrow for an icon once a block shares its column, so the title gets that space. */
export function EventBlock({ block, done, dense, onOpen }: { block: ColumnBlock; done?: boolean; dense?: boolean; onOpen: () => void }) {
  const meta = CATEGORY_META[block.item.category];
  const Icon = meta.icon;
  const title = block.occurrence.title ?? block.item.title;
  const time = blockTimeLabel(block);
  const compact = block.height < TWO_LINE_MIN_PX;
  const share = (block.span * 100) / block.lanes;
  const showIcon = !dense || block.lanes === 1;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${title} (${time})`}
      data-testid="event-block"
      data-span={block.span}
      className={cn(
        "absolute flex min-w-0 items-start gap-1.5 overflow-hidden rounded-control border-l-[3px] text-left shadow-sm transition-shadow hover:shadow-card focus-visible:z-20",
        compact ? "py-0.5" : "py-1.5",
        showIcon ? "px-2" : "px-1",
        block.span > 1 && "z-10",
        done && "opacity-60",
      )}
      style={{
        top: block.top + 1,
        height: Math.max(block.height - 2, 18),
        left: `calc(${share * block.lane}% + ${INSET_PX}px)`,
        width: `calc(${share}% - ${INSET_PX * 2}px)`,
        background: `var(${meta.bgVar})`,
        borderLeftColor: `var(${meta.dotVar})`,
      }}
    >
      {showIcon ? <Icon aria-hidden className={cn("shrink-0", compact ? "mt-px size-3.5" : "mt-0.5 size-4")} style={{ color: `var(${meta.dotVar})` }} /> : null}
      <span className="min-w-0 flex-1 leading-tight">
        {compact ? (
          <span className="block truncate text-xs font-semibold text-text">
            {title} <span className="font-normal text-body">{time}</span>
          </span>
        ) : (
          <>
            <span className={cn("block truncate text-xs font-semibold text-text", done && "line-through")}>{title}</span>
            <span className="block truncate text-[0.6875rem] text-body">{time}</span>
          </>
        )}
      </span>
      <span className="sr-only">{meta.label}</span>
    </button>
  );
}
