"use client";

import type { OccurrenceState } from "@/core/model/occurrence";
import { useItemEditor } from "@/features/items";
import type { ColumnBlock } from "../model/day-layout";
import { EventBlock } from "./EventBlock";

/** One member's hour column; the background lines are hour rules so the grid stays aligned with the gutter. */
export function MemberColumn({
  label,
  blocks,
  height,
  pxPerHour,
  states,
}: {
  label: string;
  blocks: ColumnBlock[];
  height: number;
  pxPerHour: number;
  states: Map<string, OccurrenceState>;
}) {
  const openDetail = useItemEditor((s) => s.openDetail);
  return (
    <div
      role="group"
      aria-label={label}
      className="relative border-l border-border bg-surface"
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${pxPerHour}px)`,
      }}
    >
      {blocks.map((b) => (
        <EventBlock
          key={b.occurrence.occurrenceKey}
          block={b}
          done={states.get(b.occurrence.occurrenceKey)?.status === "DONE"}
          onOpen={() => openDetail(b.item.id, b.occurrence.occurrenceKey)}
        />
      ))}
    </div>
  );
}
