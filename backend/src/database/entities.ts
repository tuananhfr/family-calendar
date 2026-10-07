import type { MixedList } from 'typeorm';
import { MemberRepresentationEntity } from '../modules/access/entities/member-representation.entity';
import { MembershipEntity } from '../modules/access/entities/membership.entity';
import { RoleEntity } from '../modules/access/entities/role.entity';
import { AutomationEntity } from '../modules/ai/entities/automation.entity';
import { AuditEventEntity } from '../modules/audit/entities/audit-event.entity';
import { ChecklistItemEntity } from '../modules/calendar/entities/checklist-item.entity';
import { ChecklistStateEntity } from '../modules/calendar/entities/checklist-state.entity';
import { ItemExceptionEntity } from '../modules/calendar/entities/item-exception.entity';
import { ItemMemberEntity } from '../modules/calendar/entities/item-member.entity';
import { ItemEntity } from '../modules/calendar/entities/item.entity';
import { OccurrenceStateEntity } from '../modules/calendar/entities/occurrence-state.entity';
import { ParticipationEntity } from '../modules/calendar/entities/participation.entity';
import { ReminderRecipientEntity } from '../modules/calendar/entities/reminder-recipient.entity';
import { ReminderRuleEntity } from '../modules/calendar/entities/reminder-rule.entity';
import { FinanceAccountEntity } from '../modules/finance/entities/finance-account.entity';
import { FinanceBudgetEntity } from '../modules/finance/entities/finance-budget.entity';
import { FinanceGoalContributionEntity } from '../modules/finance/entities/finance-goal-contribution.entity';
import { FinanceGoalEntity } from '../modules/finance/entities/finance-goal.entity';
import { FinanceLoanPaymentEntity } from '../modules/finance/entities/finance-loan-payment.entity';
import { FinanceLoanEntity } from '../modules/finance/entities/finance-loan.entity';
import { FinanceSavingEntity } from '../modules/finance/entities/finance-saving.entity';
import { FinanceTransactionEntity } from '../modules/finance/entities/finance-transaction.entity';
import { HealthMetricEntity } from '../modules/health-records/entities/health-metric.entity';
import { HealthNoteEntity } from '../modules/health-records/entities/health-note.entity';
import { HealthProfileEntity } from '../modules/health-records/entities/health-profile.entity';
import { AccountLinkEntity } from '../modules/identity/entities/account-link.entity';
import { AccountEntity } from '../modules/identity/entities/account.entity';
import { ActorEntity } from '../modules/identity/entities/actor.entity';
import { DeviceEntity } from '../modules/identity/entities/device.entity';
import { MagicLinkTokenEntity } from '../modules/identity/entities/magic-link-token.entity';
import { RecoveryCredentialEntity } from '../modules/identity/entities/recovery-credential.entity';
import { SessionEntity } from '../modules/identity/entities/session.entity';
import { InviteEntity } from '../modules/invites/entities/invite.entity';
import { JoinRequestEntity } from '../modules/invites/entities/join-request.entity';
import { JobEntity } from '../modules/jobs/entities/job.entity';
import { MemberEntity } from '../modules/members/entities/member.entity';
import { BootstrapChunkEntity } from '../modules/spaces/entities/bootstrap-chunk.entity';
import { SpaceEntity } from '../modules/spaces/entities/space.entity';
import { PushSubscriptionEntity } from '../modules/delivery/entities/push-subscription.entity';
import { EmergencyDeliveryEntity } from '../modules/emergency/entities/emergency-delivery.entity';
import { AiConsentEntity } from '../modules/ai/entities/ai-consent.entity';
import { AiConversationEntity } from '../modules/ai/entities/ai-conversation.entity';
import { AiMessageEntity } from '../modules/ai/entities/ai-message.entity';
import { AutomationRunEntity } from '../modules/ai/entities/automation-run.entity';
import { IcsFeedEntity } from '../modules/ics/entities/ics-feed.entity';
import { IntegrationEntity } from '../modules/integrations/entities/integration.entity';
import { EmergencyEventEntity } from '../modules/emergency/entities/emergency-event.entity';
import { EmergencyLocationEntity } from '../modules/emergency/entities/emergency-location.entity';
import { EmergencyRecipientEntity } from '../modules/emergency/entities/emergency-recipient.entity';
import { EmergencyResponseEntity } from '../modules/emergency/entities/emergency-response.entity';
import { NotificationEntity } from '../modules/notifications/entities/notification.entity';
import { NotificationJobEntity } from '../modules/reminders/entities/notification-job.entity';
import { FileBlobEntity } from '../modules/storage/entities/file-blob.entity';
import { FileEntity } from '../modules/storage/entities/file.entity';
import { FolderEntity } from '../modules/storage/entities/folder.entity';
import { ProcessedOperationEntity } from '../modules/sync/entities/processed-operation.entity';
import { SyncChangeEntity } from '../modules/sync/entities/sync-change.entity';
import { TombstoneEntity } from '../modules/sync/entities/tombstone.entity';
import { TemplateEntity } from '../modules/templates/entities/template.entity';

// Explicit lists instead of globs: globs resolve differently under ts-jest, ts-node and dist.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const ALL_ENTITIES: MixedList<Function> = [
  ActorEntity,
  DeviceEntity,
  SessionEntity,
  AccountEntity,
  AccountLinkEntity,
  RecoveryCredentialEntity,
  MagicLinkTokenEntity,
  AuditEventEntity,
  JobEntity,
  SpaceEntity,
  BootstrapChunkEntity,
  InviteEntity,
  JoinRequestEntity,
  FileBlobEntity,
  NotificationJobEntity,
  NotificationEntity,
  PushSubscriptionEntity,
  EmergencyRecipientEntity,
  EmergencyEventEntity,
  EmergencyResponseEntity,
  EmergencyLocationEntity,
  EmergencyDeliveryEntity,
  AiConsentEntity,
  AiConversationEntity,
  AiMessageEntity,
  AutomationRunEntity,
  IcsFeedEntity,
  IntegrationEntity,
  RoleEntity,
  MemberEntity,
  MembershipEntity,
  MemberRepresentationEntity,
  ChecklistItemEntity,
  ChecklistStateEntity,
  ItemExceptionEntity,
  ItemMemberEntity,
  ItemEntity,
  OccurrenceStateEntity,
  ParticipationEntity,
  ReminderRecipientEntity,
  ReminderRuleEntity,
  FileEntity,
  FolderEntity,
  FinanceAccountEntity,
  FinanceBudgetEntity,
  FinanceGoalContributionEntity,
  FinanceGoalEntity,
  FinanceLoanPaymentEntity,
  FinanceLoanEntity,
  FinanceSavingEntity,
  FinanceTransactionEntity,
  HealthMetricEntity,
  HealthNoteEntity,
  HealthProfileEntity,
  AutomationEntity,
  TemplateEntity,
  ProcessedOperationEntity,
  SyncChangeEntity,
  TombstoneEntity,
];
