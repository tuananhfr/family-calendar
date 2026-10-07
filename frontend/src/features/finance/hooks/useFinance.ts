"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { canRead, hasLevel } from "@/core/access/evaluate";
import type { FinanceBudget, FinanceGoal, FinanceLoan, FinanceSaving, FinanceTxn } from "@/core/model/finance";
import type { Member } from "@/core/model/member";
import { listActive } from "@/core/repo/read";
import { useAccess, useActiveSpace, useMembers } from "@/features/members";

export interface FinanceData {
  loading: boolean;
  /** No `finance` VIEW for the active role (a child profile): the screen shows ForbiddenState. */
  forbidden: boolean;
  canEdit: boolean;
  spaceId?: string;
  txns: FinanceTxn[];
  budgets: FinanceBudget[];
  savings: FinanceSaving[];
  loans: FinanceLoan[];
  goals: FinanceGoal[];
  members: Member[];
  /** Adults who get the auto reminders (maturity, loan due). */
  reminderMemberIds: string[];
}

const EMPTY = { txns: [], budgets: [], savings: [], loans: [], goals: [], members: [], reminderMemberIds: [] };

export function useFinance(): FinanceData {
  const { space } = useActiveSpace();
  const spaceId = space?.id;
  const access = useAccess();
  const members = useMembers(spaceId);
  const allowed = access ? hasLevel(access, "finance", "VIEW") : false;
  // Nothing is read from IndexedDB for a role without access, not just hidden after the fact.
  const data = useLiveQuery(
    async () =>
      spaceId && allowed
        ? {
            txns: await listActive<FinanceTxn>("finance_txn", spaceId),
            budgets: await listActive<FinanceBudget>("finance_budget", spaceId),
            savings: await listActive<FinanceSaving>("finance_saving", spaceId),
            loans: await listActive<FinanceLoan>("finance_loan", spaceId),
            goals: await listActive<FinanceGoal>("finance_goal", spaceId),
          }
        : null,
    [spaceId, allowed],
  );

  return useMemo(() => {
    if (!access || !members) return { loading: true, forbidden: false, canEdit: false, spaceId, ...EMPTY };
    if (!allowed) return { loading: false, forbidden: true, canEdit: false, spaceId, ...EMPTY };
    if (!data) return { loading: true, forbidden: false, canEdit: false, spaceId, ...EMPTY };
    const readable = <T extends FinanceTxn | FinanceBudget | FinanceSaving | FinanceLoan | FinanceGoal>(rows: T[]) => rows.filter((r) => canRead(access, r, "finance"));
    const active = members.filter((m) => m.status === "ACTIVE");
    return {
      loading: false,
      forbidden: false,
      canEdit: hasLevel(access, "finance", "EDIT"),
      spaceId,
      txns: readable(data.txns),
      budgets: readable(data.budgets),
      savings: readable(data.savings),
      loans: readable(data.loans),
      goals: readable(data.goals),
      members: active,
      reminderMemberIds: active.filter((m) => m.profile === "PARENT").map((m) => m.id),
    };
  }, [access, members, allowed, data, spaceId]);
}
