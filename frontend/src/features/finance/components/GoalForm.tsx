"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import type { FinanceGoal } from "@/core/model/finance";
import { DateField, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { saveGoal } from "../model/finance-writes";
import { FinanceFormDialog } from "./FinanceFormDialog";
import { MoneyField } from "./MoneyField";

export function GoalForm({ spaceId, goal, onClose }: { spaceId: string; goal?: FinanceGoal; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState<number | undefined>(goal?.targetAmount);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  return (
    <FinanceFormDialog
      title={t(goal ? "finance.goal.editTitle" : "finance.goal.addTitle")}
      icon={<Target />}
      submitLabel={t("finance.goal.save")}
      onClose={onClose}
      onSubmit={async () => {
        await saveGoal(spaceId, { name, targetAmount: target ?? 0, deadline: deadline || undefined, contributions: goal?.contributions ?? [] }, goal?.id);
        return t("finance.goal.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <TextField
            label={t("finance.goal.name")}
            required
            autoFocus
            maxLength={100}
            value={name}
            placeholder={t("finance.goal.namePlaceholder")}
            onChange={(e) => {
              setName(e.target.value);
              clear("name");
            }}
            error={errors.name}
          />
          <MoneyField
            label={t("finance.goal.target")}
            required
            value={target}
            onChange={(v) => {
              setTarget(v);
              clear("targetAmount");
            }}
            error={errors.targetAmount}
          />
          <DateField label={t("finance.goal.deadline")} optional value={deadline} onChange={(e) => setDeadline(e.target.value)} error={errors.deadline} />
        </>
      )}
    </FinanceFormDialog>
  );
}
