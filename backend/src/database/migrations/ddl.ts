// Shared DDL fragments for hand-written migrations. Frozen once used: changing them would make
// old migrations produce a different schema on fresh databases.

/** UUIDs compare byte-exact (ascii_bin); every column joined by a foreign key must use the same type. */
export const ID = 'CHAR(36) CHARACTER SET ascii COLLATE ascii_bin';

/** Lowercase hex SHA-256. */
export const HASH = 'CHAR(64) CHARACTER SET ascii COLLATE ascii_bin';

export const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

export const DATA_CLASS_ENUM = "ENUM('NORMAL','PRIVATE','SENSITIVE')";

export const SHARING_SCOPE_ENUM =
  "ENUM('FAMILY_ALL','PARENTS_SENIORS','PARENTS_CHILDREN','PRIVATE','GROUP_MEMBERS','GROUP_MANAGERS')";

/**
 * Columns every registry resource carries (modules.md §1). created_by_actor_id has no FK: records made by a
 * local-only Actor on a shared device are uploaded at bootstrap before that Actor ever registers.
 */
export const RESOURCE_COLUMNS = `id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      created_by_actor_id ${ID} NOT NULL,
      data_class ${DATA_CLASS_ENUM} NOT NULL,
      sharing_scope ${SHARING_SCOPE_ENUM} NOT NULL,
      revision BIGINT UNSIGNED NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL`;

/** Keys shared by every registry resource; UNIQUE (space_id, id) is the target of same-Space composite FKs. */
export function resourceKeys(table: string): string {
  return `PRIMARY KEY (id),
      UNIQUE KEY uq_${table}_space_id (space_id, id),
      KEY idx_${table}_space_updated (space_id, updated_at),
      KEY idx_${table}_space_deleted (space_id, deleted_at),
      CONSTRAINT fk_${table}_space FOREIGN KEY (space_id) REFERENCES spaces (id)`;
}

/** Same-Space reference: (space_id, column) must match a row of `refTable` in the same Space. */
export function sameSpaceFk(table: string, column: string, refTable: string, onDelete?: 'CASCADE'): string {
  const suffix = onDelete ? ` ON DELETE ${onDelete}` : '';
  return `CONSTRAINT fk_${table}_${column} FOREIGN KEY (space_id, ${column}) REFERENCES ${refTable} (space_id, id)${suffix}`;
}
