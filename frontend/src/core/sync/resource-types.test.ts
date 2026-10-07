import { describe, expect, it } from "vitest";
import { RESOURCE_STORE, RESOURCE_TYPES } from "./resource-types";

describe("resource registry", () => {
  it("maps every resource type of modules.md §1 to its Dexie store", () => {
    expect(RESOURCE_TYPES).toHaveLength(23);
    expect(RESOURCE_STORE).toEqual({
      space_settings: "spaces",
      member: "members",
      role: "roles",
      item: "items",
      item_exception: "itemExceptions",
      occurrence_state: "occurrenceStates",
      checklist_item: "checklistItems",
      checklist_state: "checklistStates",
      participation: "participations",
      reminder_rule: "reminderRules",
      finance_account: "financeAccounts",
      finance_txn: "financeTxns",
      finance_budget: "financeBudgets",
      finance_saving: "financeSavings",
      finance_loan: "financeLoans",
      finance_goal: "financeGoals",
      health_profile: "healthProfiles",
      health_metric: "healthMetrics",
      health_note: "healthNotes",
      folder: "folders",
      file: "files",
      automation: "automations",
      template: "templates",
    });
  });
});
