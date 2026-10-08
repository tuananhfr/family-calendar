import { SectionCard, type SectionCardProps } from "@/design/components";

export function TodayRail(props: SectionCardProps) {
  return <SectionCard {...props} className="gap-4 p-4 shadow-none md:p-5 [&_h2]:text-sm [&_h2]:leading-snug [&_h2]:whitespace-normal [&_h2]:overflow-visible [&_a]:min-h-9" />;
}
