import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, RESOURCE_COLUMNS, TABLE_OPTIONS, resourceKeys, sameSpaceFk } from './ddl';

// Enum lists are spelled out here rather than imported so this migration keeps producing the same schema.
const KINDS = "ENUM('EVENT','REMINDER','TASK')";
const PRESETS =
  "ENUM('TIMETABLE','APPOINTMENT','EVENT','SPECIAL_DAY','BIRTHDAY','ANNIVERSARY','DEATH_ANNIVERSARY','HOLIDAY'," +
  "'OTHER','MEDICATION','DOCUMENT','PAYMENT','REMEMBER','PERSONAL','HOUSEWORK','GROUP','SHOPPING')";
const CATEGORIES =
  "ENUM('STUDY','HOUSEWORK','FAMILY','HEALTH','FINANCE','SHOPPING','DOCUMENT','ACTIVITY','SPORT','SPECIAL','OTHER')";
const PRIORITY = "ENUM('HIGH','MEDIUM','LOW')";
const EXPENSE_CATEGORIES =
  "'FOOD','EDUCATION','LIVING','HEALTH','ENTERTAINMENT','TRANSPORT','HOUSING','BILLS','SHOPPING','OTHER'";
const MONEY = 'DECIMAL(15,0)';
/** 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm' wall-clock text, interpreted with the row's time zone. */
const LOCAL_TIME = 'CHAR(16) CHARACTER SET ascii COLLATE ascii_bin';
const OCCURRENCE_KEY = 'VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin';

/** Tables in creation order; dropped in reverse. */
const TABLES = [
  'items',
  'item_members',
  'item_exceptions',
  'occurrence_states',
  'checklist_items',
  'checklist_states',
  'participations',
  'reminder_rules',
  'reminder_recipients',
  'folders',
  'files',
  'finance_accounts',
  'finance_transactions',
  'finance_budgets',
  'finance_savings',
  'finance_loans',
  'finance_loan_payments',
  'finance_goals',
  'finance_goal_contributions',
  'health_profiles',
  'health_metrics',
  'health_notes',
  'automations',
  'templates',
  'sync_changes',
  'tombstones',
  'processed_operations',
];

function json(column: string, table: string, nullable = false): string {
  const check = nullable ? `${column} IS NULL OR JSON_VALID(${column})` : `JSON_VALID(${column})`;
  return `${column} JSON ${nullable ? 'NULL' : 'NOT NULL'},
      CONSTRAINT chk_${table}_${column} CHECK (${check})`;
}

export class Resources1791300300000 implements MigrationInterface {
  name = 'Resources1791300300000';

  public async up(q: QueryRunner): Promise<void> {
    // --- Scheduling ---------------------------------------------------------------------------------------------
    await q.query(`CREATE TABLE items (
      ${RESOURCE_COLUMNS},
      kind ${KINDS} NOT NULL,
      preset ${PRESETS} NOT NULL,
      title VARCHAR(200) NOT NULL,
      all_day TINYINT(1) NOT NULL,
      start_local ${LOCAL_TIME} NOT NULL,
      end_local ${LOCAL_TIME} NULL,
      time_zone VARCHAR(64) NOT NULL,
      rrule VARCHAR(500) NULL,
      ${json('lunar_rule', 'items', true)},
      responsible_member_id ${ID} NULL,
      category ${CATEGORIES} NOT NULL,
      priority ${PRIORITY} NOT NULL DEFAULT 'MEDIUM',
      note VARCHAR(2000) NULL,
      location_text VARCHAR(200) NULL,
      ${json('attachments', 'items')},
      show_on_calendar TINYINT(1) NOT NULL DEFAULT 1,
      calendar_system ENUM('SOLAR','LUNAR') NOT NULL DEFAULT 'SOLAR',
      template_key VARCHAR(100) NULL,
      completed_at DATETIME(3) NULL,
      amount ${MONEY} NULL,
      currency CHAR(3) CHARACTER SET ascii NULL,
      document_type VARCHAR(100) NULL,
      subject VARCHAR(100) NULL,
      teacher VARCHAR(100) NULL,
      room VARCHAR(50) NULL,
      audio_asset_id ${ID} NULL,
      sound_key VARCHAR(50) NULL,
      source_reference VARCHAR(200) NULL,
      ${resourceKeys('items')},
      ${sameSpaceFk('items', 'responsible_member_id', 'members')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE item_members (
      space_id ${ID} NOT NULL,
      item_id ${ID} NOT NULL,
      member_id ${ID} NOT NULL,
      PRIMARY KEY (item_id, member_id),
      KEY idx_item_members_member (space_id, member_id),
      ${sameSpaceFk('item_members', 'item_id', 'items', 'CASCADE')},
      ${sameSpaceFk('item_members', 'member_id', 'members')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE item_exceptions (
      ${RESOURCE_COLUMNS},
      item_id ${ID} NOT NULL,
      occurrence_key ${OCCURRENCE_KEY} NOT NULL,
      kind ENUM('CANCEL','OVERRIDE') NOT NULL,
      ${json('override_data', 'item_exceptions', true)},
      ${resourceKeys('item_exceptions')},
      KEY idx_item_exceptions_item (space_id, item_id, occurrence_key),
      ${sameSpaceFk('item_exceptions', 'item_id', 'items')}
    ) ${TABLE_OPTIONS}`);

    // One state row per occurrence so concurrent "Đã xong" from two devices converge on the same record.
    await q.query(`CREATE TABLE occurrence_states (
      ${RESOURCE_COLUMNS},
      item_id ${ID} NOT NULL,
      occurrence_key ${OCCURRENCE_KEY} NOT NULL,
      status ENUM('DONE','SNOOZED','SKIPPED') NOT NULL,
      acted_at DATETIME(3) NOT NULL,
      acted_by_actor_id ${ID} NOT NULL,
      snooze_until DATETIME(3) NULL,
      ${resourceKeys('occurrence_states')},
      UNIQUE KEY uq_occurrence_states_key (space_id, item_id, occurrence_key),
      ${sameSpaceFk('occurrence_states', 'item_id', 'items')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE checklist_items (
      ${RESOURCE_COLUMNS},
      item_id ${ID} NOT NULL,
      text VARCHAR(200) NOT NULL,
      position INT UNSIGNED NOT NULL,
      ${resourceKeys('checklist_items')},
      KEY idx_checklist_items_item (space_id, item_id),
      ${sameSpaceFk('checklist_items', 'item_id', 'items')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE checklist_states (
      ${RESOURCE_COLUMNS},
      item_id ${ID} NOT NULL,
      checklist_item_id ${ID} NOT NULL,
      occurrence_key ${OCCURRENCE_KEY} NOT NULL,
      checked TINYINT(1) NOT NULL,
      ${resourceKeys('checklist_states')},
      UNIQUE KEY uq_checklist_states_key (space_id, checklist_item_id, occurrence_key),
      KEY idx_checklist_states_item (space_id, item_id),
      ${sameSpaceFk('checklist_states', 'item_id', 'items')},
      ${sameSpaceFk('checklist_states', 'checklist_item_id', 'checklist_items')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE participations (
      ${RESOURCE_COLUMNS},
      item_id ${ID} NOT NULL,
      occurrence_key ${OCCURRENCE_KEY} NULL,
      member_id ${ID} NOT NULL,
      response ENUM('YES','NO','MAYBE') NOT NULL,
      ${resourceKeys('participations')},
      KEY idx_participations_item (space_id, item_id),
      ${sameSpaceFk('participations', 'item_id', 'items')},
      ${sameSpaceFk('participations', 'member_id', 'members')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE reminder_rules (
      ${RESOURCE_COLUMNS},
      item_id ${ID} NOT NULL,
      ${json('offsets_minutes', 'reminder_rules')},
      ${json('offset_months', 'reminder_rules', true)},
      ${json('channels', 'reminder_rules')},
      priority ${PRIORITY} NOT NULL DEFAULT 'MEDIUM',
      sound_key VARCHAR(50) NULL,
      audio_asset_id ${ID} NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      ${resourceKeys('reminder_rules')},
      KEY idx_reminder_rules_item (space_id, item_id),
      ${sameSpaceFk('reminder_rules', 'item_id', 'items')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE reminder_recipients (
      space_id ${ID} NOT NULL,
      reminder_rule_id ${ID} NOT NULL,
      member_id ${ID} NOT NULL,
      PRIMARY KEY (reminder_rule_id, member_id),
      KEY idx_reminder_recipients_member (space_id, member_id),
      ${sameSpaceFk('reminder_recipients', 'reminder_rule_id', 'reminder_rules', 'CASCADE')},
      ${sameSpaceFk('reminder_recipients', 'member_id', 'members')}
    ) ${TABLE_OPTIONS}`);

    // --- Storage (before finance: transactions reference files) -------------------------------------------------
    await q.query(`CREATE TABLE folders (
      ${RESOURCE_COLUMNS},
      name VARCHAR(100) NOT NULL,
      parent_id ${ID} NULL,
      system_key ENUM('PHOTOS','DOCUMENTS','STUDY','HEALTH','VIDEOS','OTHER') NULL,
      ${resourceKeys('folders')},
      UNIQUE KEY uq_folders_system_key (space_id, system_key),
      ${sameSpaceFk('folders', 'parent_id', 'folders')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE files (
      ${RESOURCE_COLUMNS},
      folder_id ${ID} NOT NULL,
      name VARCHAR(255) NOT NULL,
      mime VARCHAR(127) CHARACTER SET ascii NOT NULL,
      size BIGINT UNSIGNED NOT NULL,
      sha256 ${HASH} NOT NULL,
      kind ENUM('IMAGE','DOCUMENT','VIDEO','AUDIO','OTHER') NOT NULL,
      thumbnail_blob_id VARCHAR(64) CHARACTER SET ascii NULL,
      taken_at ${LOCAL_TIME} NULL,
      blob_state ENUM('LOCAL_ONLY','UPLOADING','SYNCED','MISSING') NOT NULL,
      ${resourceKeys('files')},
      KEY idx_files_folder (space_id, folder_id),
      ${sameSpaceFk('files', 'folder_id', 'folders')}
    ) ${TABLE_OPTIONS}`);

    // --- Finance ------------------------------------------------------------------------------------------------
    await q.query(`CREATE TABLE finance_accounts (
      ${RESOURCE_COLUMNS},
      name VARCHAR(100) NOT NULL,
      type ENUM('CASH','BANK','EWALLET','OTHER') NOT NULL,
      opening_balance ${MONEY} NOT NULL DEFAULT 0,
      ${resourceKeys('finance_accounts')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE finance_transactions (
      ${RESOURCE_COLUMNS},
      type ENUM('INCOME','EXPENSE','TRANSFER') NOT NULL,
      amount ${MONEY} NOT NULL,
      category ENUM(${EXPENSE_CATEGORIES},'SALARY','BONUS','BUSINESS','TRANSFER') NOT NULL,
      date DATE NOT NULL,
      member_id ${ID} NULL,
      account_id ${ID} NULL,
      to_account_id ${ID} NULL,
      note VARCHAR(500) NULL,
      item_id ${ID} NULL,
      attachment_file_id ${ID} NULL,
      ${resourceKeys('finance_transactions')},
      KEY idx_finance_transactions_date (space_id, date),
      ${sameSpaceFk('finance_transactions', 'member_id', 'members')},
      ${sameSpaceFk('finance_transactions', 'account_id', 'finance_accounts')},
      ${sameSpaceFk('finance_transactions', 'to_account_id', 'finance_accounts')},
      ${sameSpaceFk('finance_transactions', 'item_id', 'items')},
      ${sameSpaceFk('finance_transactions', 'attachment_file_id', 'files')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE finance_budgets (
      ${RESOURCE_COLUMNS},
      month CHAR(7) CHARACTER SET ascii NOT NULL,
      category ENUM(${EXPENSE_CATEGORIES}) NOT NULL,
      limit_amount ${MONEY} NOT NULL,
      ${resourceKeys('finance_budgets')},
      KEY idx_finance_budgets_month (space_id, month)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE finance_savings (
      ${RESOURCE_COLUMNS},
      name VARCHAR(100) NOT NULL,
      bank VARCHAR(100) NULL,
      principal ${MONEY} NOT NULL,
      rate_percent DECIMAL(5,2) NOT NULL,
      start_date DATE NOT NULL,
      term_months SMALLINT UNSIGNED NOT NULL,
      maturity_date DATE NOT NULL,
      ${resourceKeys('finance_savings')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE finance_loans (
      ${RESOURCE_COLUMNS},
      direction ENUM('BORROWED','LENT') NOT NULL,
      counterparty VARCHAR(100) NOT NULL,
      principal ${MONEY} NOT NULL,
      start_date DATE NOT NULL,
      due_date DATE NULL,
      note VARCHAR(500) NULL,
      ${resourceKeys('finance_loans')}
    ) ${TABLE_OPTIONS}`);

    // Payments/contributions travel inside their parent's payload and are rewritten with it, hence CASCADE.
    await q.query(`CREATE TABLE finance_loan_payments (
      space_id ${ID} NOT NULL,
      loan_id ${ID} NOT NULL,
      position SMALLINT UNSIGNED NOT NULL,
      date DATE NOT NULL,
      amount ${MONEY} NOT NULL,
      PRIMARY KEY (loan_id, position),
      ${sameSpaceFk('finance_loan_payments', 'loan_id', 'finance_loans', 'CASCADE')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE finance_goals (
      ${RESOURCE_COLUMNS},
      name VARCHAR(100) NOT NULL,
      target_amount ${MONEY} NOT NULL,
      deadline DATE NULL,
      ${resourceKeys('finance_goals')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE finance_goal_contributions (
      space_id ${ID} NOT NULL,
      goal_id ${ID} NOT NULL,
      position SMALLINT UNSIGNED NOT NULL,
      date DATE NOT NULL,
      amount ${MONEY} NOT NULL,
      PRIMARY KEY (goal_id, position),
      ${sameSpaceFk('finance_goal_contributions', 'goal_id', 'finance_goals', 'CASCADE')}
    ) ${TABLE_OPTIONS}`);

    // --- Health -------------------------------------------------------------------------------------------------
    await q.query(`CREATE TABLE health_profiles (
      ${RESOURCE_COLUMNS},
      member_id ${ID} NOT NULL,
      sex ENUM('MALE','FEMALE','OTHER','UNSPECIFIED') NOT NULL,
      blood_type ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NULL,
      height_cm DECIMAL(4,1) NULL,
      ${json('allergies', 'health_profiles')},
      ${json('conditions', 'health_profiles')},
      insurance_number VARCHAR(30) NULL,
      emergency_note VARCHAR(500) NULL,
      ${resourceKeys('health_profiles')},
      UNIQUE KEY uq_health_profiles_member (space_id, member_id),
      ${sameSpaceFk('health_profiles', 'member_id', 'members')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE health_metrics (
      ${RESOURCE_COLUMNS},
      member_id ${ID} NOT NULL,
      type ENUM('WEIGHT','HEIGHT','BLOOD_PRESSURE','HEART_RATE','SLEEP','BLOOD_GLUCOSE','TEMPERATURE','CUSTOM') NOT NULL,
      value DECIMAL(12,3) NOT NULL,
      value2 DECIMAL(12,3) NULL,
      unit VARCHAR(20) NULL,
      custom_name VARCHAR(50) NULL,
      measured_at ${LOCAL_TIME} NOT NULL,
      note VARCHAR(500) NULL,
      ${resourceKeys('health_metrics')},
      KEY idx_health_metrics_member (space_id, member_id, type, measured_at),
      ${sameSpaceFk('health_metrics', 'member_id', 'members')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE health_notes (
      ${RESOURCE_COLUMNS},
      member_id ${ID} NOT NULL,
      date DATE NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      ${resourceKeys('health_notes')},
      KEY idx_health_notes_member (space_id, member_id, date),
      ${sameSpaceFk('health_notes', 'member_id', 'members')}
    ) ${TABLE_OPTIONS}`);

    // --- Automations and user templates -------------------------------------------------------------------------
    await q.query(`CREATE TABLE automations (
      ${RESOURCE_COLUMNS},
      rule_key ENUM('PAYMENT_DUE_REMINDER','WEEKLY_SUMMARY','EXAM_REVIEW_TASK') NOT NULL,
      enabled TINYINT(1) NOT NULL,
      ${json('params', 'automations')},
      last_run_at DATETIME(3) NULL,
      ${resourceKeys('automations')}
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE templates (
      ${RESOURCE_COLUMNS},
      kind ${KINDS} NOT NULL,
      preset ${PRESETS} NOT NULL,
      category ${CATEGORIES} NOT NULL,
      title VARCHAR(200) NOT NULL,
      duration_minutes INT UNSIGNED NULL,
      ${json('checklist', 'templates')},
      ${json('reminder_offsets_minutes', 'templates')},
      note VARCHAR(2000) NULL,
      ${resourceKeys('templates')}
    ) ${TABLE_OPTIONS}`);

    // --- Sync bookkeeping ---------------------------------------------------------------------------------------
    await q.query(`CREATE TABLE sync_changes (
      space_id ${ID} NOT NULL,
      seq BIGINT UNSIGNED NOT NULL,
      resource_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      resource_id ${ID} NOT NULL,
      revision BIGINT UNSIGNED NOT NULL,
      op ENUM('UPSERT','DELETE') NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, seq),
      KEY idx_sync_changes_resource (space_id, resource_type, resource_id),
      CONSTRAINT fk_sync_changes_space FOREIGN KEY (space_id) REFERENCES spaces (id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE tombstones (
      space_id ${ID} NOT NULL,
      resource_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      resource_id ${ID} NOT NULL,
      revision BIGINT UNSIGNED NOT NULL,
      seq BIGINT UNSIGNED NOT NULL,
      deleted_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, resource_type, resource_id),
      KEY idx_tombstones_deleted (space_id, deleted_at),
      CONSTRAINT fk_tombstones_space FOREIGN KEY (space_id) REFERENCES spaces (id)
    ) ${TABLE_OPTIONS}`);

    // result stays NULL while the first request for an operation_id is still applying it.
    await q.query(`CREATE TABLE processed_operations (
      operation_id ${ID} NOT NULL,
      device_id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      payload_hash ${HASH} NOT NULL,
      ${json('result', 'processed_operations', true)},
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (operation_id),
      KEY idx_processed_operations_space (space_id),
      KEY idx_processed_operations_created (created_at),
      CONSTRAINT fk_processed_operations_device FOREIGN KEY (device_id) REFERENCES devices (id),
      CONSTRAINT fk_processed_operations_space FOREIGN KEY (space_id) REFERENCES spaces (id)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) await q.query(`DROP TABLE ${table}`);
  }
}
