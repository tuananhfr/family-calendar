import { sha256Hex } from '../../common/crypto/tokens';

export interface HashableOperation {
  resource_type: string;
  resource_id: string;
  action: string;
  base_revision: string | null;
  payload: unknown;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : canonical(v)));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}

/** JSON with object keys sorted at every depth, so equal content always serializes to equal bytes. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

/**
 * Identity of what an operation asks for. operation_id, client_created_at and schema_version are left out so a
 * retry with a refreshed client timestamp still matches the original.
 */
export function payloadHash(op: HashableOperation): string {
  return sha256Hex(
    canonicalJson({
      resource_type: op.resource_type,
      resource_id: op.resource_id,
      action: op.action,
      base_revision: op.base_revision ?? null,
      payload: op.payload ?? null,
    }),
  );
}
