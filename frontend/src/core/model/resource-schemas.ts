import type { z } from "zod";
import type { ResourceType } from "../sync/resource-types";
import { automationSchema } from "./automation";
import {
  financeAccountSchema,
  financeBudgetSchema,
  financeGoalSchema,
  financeLoanSchema,
  financeSavingSchema,
  financeTxnSchema,
} from "./finance";
import { healthMetricSchema, healthNoteSchema, healthProfileSchema } from "./health";
import { itemSchema } from "./item";
import { memberSchema } from "./member";
import {
  checklistItemSchema,
  checklistStateSchema,
  itemExceptionSchema,
  occurrenceStateSchema,
  participationSchema,
} from "./occurrence";
import { reminderRuleSchema } from "./reminder-rule";
import { roleSchema } from "./role";
import { spaceSchema } from "./space";
import { fileSchema, folderSchema } from "./storage";
import { templateSchema } from "./template";

/** One zod schema per registry resource; used for form validation, backup restore and sync payload checks. */
export const RESOURCE_SCHEMAS = {
  space_settings: spaceSchema,
  member: memberSchema,
  role: roleSchema,
  item: itemSchema,
  item_exception: itemExceptionSchema,
  occurrence_state: occurrenceStateSchema,
  checklist_item: checklistItemSchema,
  checklist_state: checklistStateSchema,
  participation: participationSchema,
  reminder_rule: reminderRuleSchema,
  finance_account: financeAccountSchema,
  finance_txn: financeTxnSchema,
  finance_budget: financeBudgetSchema,
  finance_saving: financeSavingSchema,
  finance_loan: financeLoanSchema,
  finance_goal: financeGoalSchema,
  health_profile: healthProfileSchema,
  health_metric: healthMetricSchema,
  health_note: healthNoteSchema,
  folder: folderSchema,
  file: fileSchema,
  automation: automationSchema,
  template: templateSchema,
} as const satisfies Record<ResourceType, z.ZodType>;

export type ResourceRecord<T extends ResourceType> = z.infer<(typeof RESOURCE_SCHEMAS)[T]>;
