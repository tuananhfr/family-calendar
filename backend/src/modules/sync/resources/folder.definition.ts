import { SYSTEM_FOLDER_KEYS } from '../domain-enums';
import { id, oneOf, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

export const folderDefinition = new TableResource({
  type: 'folder',
  table: 'folders',
  access: capabilityRules('storage'),
  immutable: ['systemKey'],
  fields: [
    { key: 'name', column: 'name', codec: text(100) },
    { key: 'parentId', column: 'parent_id', codec: id, nullable: true },
    { key: 'systemKey', column: 'system_key', codec: oneOf(SYSTEM_FOLDER_KEYS), nullable: true },
  ],
  refs: [
    {
      key: 'parentId',
      table: 'folders',
      // V1 allows a single level of sub-folders.
      check: (ref) => (ref.parent_id === null ? null : 'TOO_DEEP'),
    },
  ],
  async checkAsync(columns, e, ctx) {
    if (columns.parent_id === ctx.resourceId) e.add('parentId', 'SELF_PARENT');
    if (columns.system_key) {
      const rows: unknown[] = await ctx.em.query(
        'SELECT id FROM folders WHERE space_id = ? AND system_key = ? AND id <> ?',
        [ctx.spaceId, columns.system_key, ctx.resourceId],
      );
      if (rows.length > 0) e.add('systemKey', 'DUPLICATE');
    }
  },
  async deleteBlockers(em, row): Promise<Record<string, string> | null> {
    if (row.system_key) return { systemKey: 'SYSTEM_FOLDER' };
    const [{ n }]: Array<{ n: string | number }> = await em.query(
      `SELECT (SELECT COUNT(*) FROM files WHERE space_id = ? AND folder_id = ? AND deleted_at IS NULL)
            + (SELECT COUNT(*) FROM folders WHERE space_id = ? AND parent_id = ? AND deleted_at IS NULL) AS n`,
      [row.space_id, row.id, row.space_id, row.id],
    );
    return Number(n) > 0 ? { id: 'FOLDER_NOT_EMPTY' } : null;
  },
});
