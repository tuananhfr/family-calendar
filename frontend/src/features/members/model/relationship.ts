import { profileForRelationship, type Profile, type Relationship } from "@/core/model/common";
import type { LocalDate } from "@/core/time/local-date";
import { t } from "@/i18n/vi";
import { ageLabel } from "./age";

export { profileForRelationship };

export function relationshipLabel(r: Relationship): string {
  return t(`relationship.${r}`);
}

export function profileLabel(p: Profile): string {
  return t(`profile.${p}`);
}

/** Card subtitle "Con trai · 10 tuổi"; avoids "Bố / Bố" when the name is the relationship itself. */
export function memberSubtitle(
  m: {
    displayName: string;
    relationship: Relationship;
    profile: Profile;
    birthDate?: LocalDate;
  },
  today: LocalDate,
): string {
  const rel = relationshipLabel(m.relationship);
  const head = m.displayName.trim().toLocaleLowerCase("vi") === rel.toLocaleLowerCase("vi") ? profileLabel(m.profile) : rel;
  const age = ageLabel(m.birthDate, today);
  return age ? `${head} · ${age}` : head;
}
