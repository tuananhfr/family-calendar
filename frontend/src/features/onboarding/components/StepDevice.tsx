import { CircleCheck } from "lucide-react";
import { Chip, Illustration } from "@/design/components";
import { t } from "@/i18n/vi";
import type { DraftPerson } from "./StepMembers";

export function StepDevice({ people, who, onWho, error }: { people: DraftPerson[]; who: string | null; onWho: (key: string | null) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-text">{t("onboarding.device.title")}</h2>
          <p className="mt-1 text-sm text-body">{t("onboarding.device.body")}</p>
        </div>
        <Illustration name="hero-today" height={120} className="self-center rounded-card" />
      </div>
      <ul className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-body">
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            {t(`onboarding.device.points.${i}`)}
          </li>
        ))}
      </ul>
      <div role="group" aria-label={t("onboarding.device.whoLabel")} className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text">{t("onboarding.device.whoLabel")}</span>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <Chip key={p.key} selected={who === p.key} onClick={() => onWho(p.key)}>
              {p.displayName}
            </Chip>
          ))}
          <Chip selected={who === null} onClick={() => onWho(null)}>
            {t("onboarding.device.whoLater")}
          </Chip>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
