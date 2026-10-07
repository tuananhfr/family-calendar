import type { LocalDate } from "@/core/time/local-date";
import { Badge, Card } from "@/design/components";
import { t } from "@/i18n/vi";
import { ageLabel } from "../model/age";
import type { MemberDraft } from "../model/member-draft";
import { relationshipLabel } from "../model/relationship";
import { MemberAvatar } from "./MemberAvatar";

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function MemberPreview({ draft, photoUrl, today, isNew }: { draft: MemberDraft; photoUrl?: string; today: LocalDate; isNew: boolean }) {
  const name = draft.displayName.trim() || t("members.preview.namePlaceholder");
  const age = ageLabel(draft.birthDate || null, today);
  const rows: Array<[string, string]> = [
    [t("members.preview.birthDate"), draft.birthDate ? `${formatDate(draft.birthDate)}${age ? ` (${age})` : ""}` : t("members.preview.empty")],
    [t("members.preview.phone"), draft.phone.trim() || t("members.preview.empty")],
    [t("members.preview.email"), draft.email.trim() || t("members.preview.empty")],
  ];
  return (
    <Card aria-live="polite">
      <h2 className="text-sm font-bold text-text">{t("members.preview.title")}</h2>
      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <MemberAvatar name={draft.displayName.trim()} avatar={draft.avatar} relationship={draft.relationship} size="xl" overrideSrc={photoUrl} />
        <p className="w-full truncate text-base font-bold text-text" title={name}>
          {name}
        </p>
        {draft.relationship ? <Badge tone="success">{relationshipLabel(draft.relationship)}</Badge> : null}
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}:</dt>
            <dd className="min-w-0 truncate text-body" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {isNew ? (
        <p className="mt-4 rounded-control bg-success-soft px-3 py-2 text-center text-xs font-medium text-success">{t("members.preview.note")}</p>
      ) : null}
    </Card>
  );
}
