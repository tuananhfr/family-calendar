import { FileText } from "lucide-react";
import { Card, PageHeader } from "@/design/components";
import { STATIC_PAGES, type StaticPageKey } from "@/i18n/static-pages";

export function StaticPageScreen({ page }: { page: StaticPageKey }) {
  const content = STATIC_PAGES[page];
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title={content.title} subtitle={content.intro} icon={<FileText />} />
      <Card className="flex flex-col gap-6">
        {content.sections.map((s) => (
          <section key={s.heading} className="flex flex-col gap-2">
            <h2 className="text-base font-bold">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="max-w-[70ch] text-sm leading-relaxed text-body">
                {p}
              </p>
            ))}
          </section>
        ))}
      </Card>
    </div>
  );
}
