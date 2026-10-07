import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ID, RESOURCE_COLUMNS, TABLE_OPTIONS, resourceKeys } from './ddl';

// members is created here rather than with the other resources: access evaluation reads member profiles.
export class SpacesRolesMemberships1791300200000 implements MigrationInterface {
  name = 'SpacesRolesMemberships1791300200000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE spaces (
      id ${ID} NOT NULL,
      kind ENUM('FAMILY','GROUP') NOT NULL,
      name VARCHAR(100) NOT NULL,
      time_zone VARCHAR(64) NOT NULL,
      sharing_state ENUM('INITIALIZING','SHARED') NOT NULL DEFAULT 'INITIALIZING',
      settings JSON NOT NULL,
      change_seq BIGINT UNSIGNED NOT NULL DEFAULT 0,
      policy_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
      created_by_actor_id ${ID} NOT NULL,
      revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_spaces_creator (created_by_actor_id),
      CONSTRAINT fk_spaces_creator FOREIGN KEY (created_by_actor_id) REFERENCES actors (id),
      CONSTRAINT chk_spaces_settings CHECK (JSON_VALID(settings))
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE roles (
      ${RESOURCE_COLUMNS},
      role_key VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      name VARCHAR(50) NOT NULL,
      matrix JSON NOT NULL,
      restrictions JSON NULL,
      is_system TINYINT(1) NOT NULL DEFAULT 0,
      based_on VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
      ${resourceKeys('roles')},
      UNIQUE KEY uq_roles_space_key (space_id, role_key),
      CONSTRAINT chk_roles_matrix CHECK (JSON_VALID(matrix)),
      CONSTRAINT chk_roles_restrictions CHECK (restrictions IS NULL OR JSON_VALID(restrictions))
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE members (
      ${RESOURCE_COLUMNS},
      display_name VARCHAR(50) NOT NULL,
      relationship ENUM('FATHER','MOTHER','SON','DAUGHTER','GRANDFATHER','GRANDMOTHER','GUARDIAN','OTHER') NOT NULL,
      profile ENUM('PARENT','SENIOR','CHILD') NOT NULL,
      birth_date DATE NULL,
      phone VARCHAR(20) NULL,
      email VARCHAR(254) NULL,
      avatar VARCHAR(100) NULL,
      color VARCHAR(30) NULL,
      interests JSON NOT NULL,
      note VARCHAR(500) NULL,
      status ENUM('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
      ${resourceKeys('members')},
      CONSTRAINT chk_members_interests CHECK (JSON_VALID(interests))
    ) ${TABLE_OPTIONS}`);

    // Composite FKs keep a membership's role, and a representation's member, inside the same Space.
    await q.query(`CREATE TABLE memberships (
      id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      role_id ${ID} NOT NULL,
      status ENUM('ACTIVE','REMOVED') NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      removed_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_memberships_space_actor (space_id, actor_id),
      KEY idx_memberships_actor (actor_id),
      KEY idx_memberships_role (space_id, role_id),
      CONSTRAINT fk_memberships_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_memberships_actor FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT fk_memberships_role FOREIGN KEY (space_id, role_id) REFERENCES roles (space_id, id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE member_representations (
      space_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      member_id ${ID} NOT NULL,
      relation ENUM('SELF','GUARDIAN') NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, actor_id, member_id),
      KEY idx_member_representations_member (space_id, member_id),
      CONSTRAINT fk_member_representations_membership
        FOREIGN KEY (space_id, actor_id) REFERENCES memberships (space_id, actor_id),
      CONSTRAINT fk_member_representations_member FOREIGN KEY (space_id, member_id) REFERENCES members (space_id, id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`ALTER TABLE recovery_credentials
      ADD CONSTRAINT fk_recovery_space FOREIGN KEY (space_id) REFERENCES spaces (id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE recovery_credentials DROP FOREIGN KEY fk_recovery_space');
    await q.query('DROP TABLE member_representations');
    await q.query('DROP TABLE memberships');
    await q.query('DROP TABLE members');
    await q.query('DROP TABLE roles');
    await q.query('DROP TABLE spaces');
  }
}
