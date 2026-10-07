import { decimal, id, jsonArray, oneOf, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

/** One per Member; family-entered notes only (modules.md §8). */
export const healthProfileDefinition = new TableResource({
  type: 'health_profile',
  table: 'health_profiles',
  access: capabilityRules('health', { memberColumn: 'member_id' }),
  immutable: ['memberId'],
  fields: [
    { key: 'memberId', column: 'member_id', codec: id },
    { key: 'sex', column: 'sex', codec: oneOf(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'] as const) },
    {
      key: 'bloodType',
      column: 'blood_type',
      codec: oneOf(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const),
      optional: true,
    },
    { key: 'heightCm', column: 'height_cm', codec: decimal(20, 260, 1), optional: true },
    { key: 'allergies', column: 'allergies', codec: jsonArray(text(100), { max: 30, unique: true }) },
    { key: 'conditions', column: 'conditions', codec: jsonArray(text(100), { max: 30, unique: true }) },
    { key: 'insuranceNumber', column: 'insurance_number', codec: text(30, 0), optional: true },
    { key: 'emergencyNote', column: 'emergency_note', codec: text(500, 0), optional: true },
  ],
  refs: [{ key: 'memberId', table: 'members' }],
  async checkAsync(columns, e, ctx) {
    // UNIQUE(space_id, member_id) also covers deleted rows, so a second profile is refused up front.
    const rows: unknown[] = await ctx.em.query(
      'SELECT id FROM health_profiles WHERE space_id = ? AND member_id = ? AND id <> ?',
      [ctx.spaceId, columns.member_id, ctx.resourceId],
    );
    if (rows.length > 0) e.add('memberId', 'PROFILE_EXISTS');
  },
});
