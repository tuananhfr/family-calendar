"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { BLOOD_TYPES, SEXES, type HealthProfile } from "@/core/model/health";
import type { Member } from "@/core/model/member";
import { Select, TextArea, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { HealthFormError, saveHealthProfile } from "../model/health-writes";
import { HealthFormDialog } from "./HealthFormDialog";

const NONE = "-";
const splitList = (s: string) => [
  ...new Set(
    s
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];

export function ProfileForm({ spaceId, member, profile, onClose }: { spaceId: string; member: Member; profile?: HealthProfile; onClose: () => void }) {
  const [sex, setSex] = useState<string>(profile?.sex ?? "UNSPECIFIED");
  const [bloodType, setBloodType] = useState<string>(profile?.bloodType ?? NONE);
  const [height, setHeight] = useState(profile?.heightCm ? String(profile.heightCm).replace(".", ",") : "");
  const [allergies, setAllergies] = useState((profile?.allergies ?? []).join(", "));
  const [conditions, setConditions] = useState((profile?.conditions ?? []).join(", "));
  const [insurance, setInsurance] = useState(profile?.insuranceNumber ?? "");
  const [emergencyNote, setEmergencyNote] = useState(profile?.emergencyNote ?? "");

  return (
    <HealthFormDialog
      title={t("health.profile.editTitle", { name: member.displayName })}
      icon={<UserRound />}
      submitLabel={t("health.profile.save")}
      onClose={onClose}
      onSubmit={async () => {
        const heightCm = height.trim() ? Number(height.trim().replace(",", ".")) : undefined;
        if (heightCm !== undefined && !(heightCm >= 20 && heightCm <= 260)) throw new HealthFormError({ heightCm: "HEIGHT" });
        await saveHealthProfile(spaceId, {
          memberId: member.id,
          sex: sex as HealthProfile["sex"],
          bloodType: bloodType === NONE ? undefined : (bloodType as HealthProfile["bloodType"]),
          heightCm,
          allergies: splitList(allergies),
          conditions: splitList(conditions),
          insuranceNumber: insurance.trim() || undefined,
          emergencyNote: emergencyNote.trim() || undefined,
        });
        return t("health.profile.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t("health.profile.sex")} value={sex} onValueChange={setSex} options={SEXES.map((x) => ({ value: x, label: t(`health.sexes.${x}`) }))} />
            <Select
              label={t("health.profile.bloodType")}
              value={bloodType}
              onValueChange={setBloodType}
              options={[{ value: NONE, label: t("health.profile.none") }, ...BLOOD_TYPES.map((x) => ({ value: x, label: x }))]}
              error={errors.bloodType}
            />
          </div>
          <TextField
            label={t("health.profile.height")}
            optional
            inputMode="decimal"
            value={height}
            onChange={(e) => {
              setHeight(e.target.value);
              clear("heightCm");
            }}
            error={errors.heightCm}
          />
          <TextField label={t("health.profile.allergies")} optional helper={t("health.profile.listHelper")} value={allergies} onChange={(e) => setAllergies(e.target.value)} error={errors.allergies} />
          <TextField
            label={t("health.profile.conditions")}
            optional
            helper={t("health.profile.listHelper")}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            error={errors.conditions}
          />
          <TextField label={t("health.profile.insurance")} optional maxLength={30} value={insurance} onChange={(e) => setInsurance(e.target.value)} error={errors.insuranceNumber} />
          <TextArea label={t("health.profile.emergencyNote")} optional maxLength={500} value={emergencyNote} onChange={(e) => setEmergencyNote(e.target.value)} error={errors.emergencyNote} />
        </>
      )}
    </HealthFormDialog>
  );
}
