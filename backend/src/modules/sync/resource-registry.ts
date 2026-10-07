import type { ResourceDefinition } from './resource-definition';
import type { ResourceType } from './resource-types';
import { automationDefinition } from './resources/automation.definition';
import { checklistItemDefinition } from './resources/checklist-item.definition';
import { checklistStateDefinition } from './resources/checklist-state.definition';
import { fileDefinition } from './resources/file.definition';
import { financeAccountDefinition } from './resources/finance-account.definition';
import { financeBudgetDefinition } from './resources/finance-budget.definition';
import { financeGoalDefinition } from './resources/finance-goal.definition';
import { financeLoanDefinition } from './resources/finance-loan.definition';
import { financeSavingDefinition } from './resources/finance-saving.definition';
import { financeTxnDefinition } from './resources/finance-txn.definition';
import { folderDefinition } from './resources/folder.definition';
import { healthMetricDefinition } from './resources/health-metric.definition';
import { healthNoteDefinition } from './resources/health-note.definition';
import { healthProfileDefinition } from './resources/health-profile.definition';
import { itemExceptionDefinition } from './resources/item-exception.definition';
import { itemDefinition } from './resources/item.definition';
import { memberDefinition } from './resources/member.definition';
import { occurrenceStateDefinition } from './resources/occurrence-state.definition';
import { participationDefinition } from './resources/participation.definition';
import { reminderRuleDefinition } from './resources/reminder-rule.definition';
import { roleDefinition } from './resources/role.definition';
import { spaceSettingsDefinition } from './resources/space-settings.definition';
import { templateDefinition } from './resources/template.definition';

/** One definition per resource type (modules.md §1); the only place the sync engine learns about tables. */
export const RESOURCE_REGISTRY: Record<ResourceType, ResourceDefinition> = {
  space_settings: spaceSettingsDefinition,
  member: memberDefinition,
  role: roleDefinition,
  item: itemDefinition,
  item_exception: itemExceptionDefinition,
  occurrence_state: occurrenceStateDefinition,
  checklist_item: checklistItemDefinition,
  checklist_state: checklistStateDefinition,
  participation: participationDefinition,
  reminder_rule: reminderRuleDefinition,
  finance_account: financeAccountDefinition,
  finance_txn: financeTxnDefinition,
  finance_budget: financeBudgetDefinition,
  finance_saving: financeSavingDefinition,
  finance_loan: financeLoanDefinition,
  finance_goal: financeGoalDefinition,
  health_profile: healthProfileDefinition,
  health_metric: healthMetricDefinition,
  health_note: healthNoteDefinition,
  folder: folderDefinition,
  file: fileDefinition,
  automation: automationDefinition,
  template: templateDefinition,
};
