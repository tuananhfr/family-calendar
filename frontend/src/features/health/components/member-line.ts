import type { HealthProfile } from "@/core/model/health";
import type { Member } from "@/core/model/member";
import type { LocalDate } from "@/core/time/local-date";
import { ageLabel, relationshipLabel } from "@/features/members";
import { t } from "@/i18n/vi";

/** IMG-F card line "Nam, 41 tuổi"; falls back to the relationship when sex or age is unknown. */
export function memberHealthLine(member: Member, profile: HealthProfile | undefined, today: LocalDate): string {
  const sex = profile && profile.sex !== "UNSPECIFIED" ? t(`health.sexes.${profile.sex}`) : null;
  const age = ageLabel(member.birthDate, today);
  if (sex && age) return t("health.members.sexAge", { sex, age });
  return sex ?? age ?? relationshipLabel(member.relationship);
}
