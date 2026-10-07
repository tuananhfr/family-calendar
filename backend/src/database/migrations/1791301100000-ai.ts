import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ID, TABLE_OPTIONS, sameSpaceFk } from './ddl';

export class Ai1791301100000 implements MigrationInterface {
  name = 'Ai1791301100000';

  public async up(q: QueryRunner): Promise<void> {
    // Per person and Space: one adult agreeing does not send anyone else's questions (modules.md §11).
    await q.query(`CREATE TABLE ai_consents (
      space_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      version VARCHAR(20) CHARACTER SET ascii NOT NULL,
      allow_health TINYINT(1) NOT NULL,
      accepted_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, actor_id),
      CONSTRAINT fk_ai_consents_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_ai_consents_actor FOREIGN KEY (actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE ai_conversations (
      id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_ai_conversations_owner (space_id, actor_id, updated_at),
      KEY idx_ai_conversations_updated (updated_at),
      CONSTRAINT fk_ai_conversations_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_ai_conversations_actor FOREIGN KEY (actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    // seq orders a turn's question before its answer even when both carry the same millisecond.
    await q.query(`CREATE TABLE ai_messages (
      seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      conversation_id ${ID} NOT NULL,
      role ENUM('user','assistant') NOT NULL,
      text TEXT NOT NULL,
      drafts JSON NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (seq),
      KEY idx_ai_messages_conversation (conversation_id, seq),
      CONSTRAINT fk_ai_messages_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id)
        ON DELETE CASCADE,
      CONSTRAINT chk_ai_messages_drafts CHECK (drafts IS NULL OR JSON_VALID(drafts))
    ) ${TABLE_OPTIONS}`);

    // run_key is unique per rule firing (week, occurrence), so a re-run or a second worker never repeats it.
    await q.query(`CREATE TABLE automation_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      space_id ${ID} NOT NULL,
      automation_id ${ID} NOT NULL,
      rule_key ENUM('PAYMENT_DUE_REMINDER','WEEKLY_SUMMARY','EXAM_REVIEW_TASK') NOT NULL,
      run_key VARCHAR(191) CHARACTER SET ascii NOT NULL,
      status ENUM('DONE','FAILED') NOT NULL,
      result_count INT NOT NULL,
      ran_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_automation_runs_key (run_key),
      KEY idx_automation_runs_space (space_id, ran_at, id),
      CONSTRAINT fk_automation_runs_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      ${sameSpaceFk('automation_runs', 'automation_id', 'automations')}
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of ['automation_runs', 'ai_messages', 'ai_conversations', 'ai_consents']) {
      await q.query(`DROP TABLE ${table}`);
    }
  }
}
