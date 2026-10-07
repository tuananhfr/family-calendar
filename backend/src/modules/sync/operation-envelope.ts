import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { isClientId } from '../../common/ids';
import { isPlainObject } from './fields';
import { validationError } from './resource-definition';
import { SYNC_ACTIONS, isResourceType, type ResourceType, type SyncAction } from './resource-types';

export const MAX_BATCH_OPERATIONS = 50;
export const MAX_BATCH_BYTES = 512 * 1024;

export interface Operation {
  operation_id: string;
  resource_type: ResourceType;
  resource_id: string;
  action: SyncAction;
  base_revision: string | null;
  payload: unknown;
}

export type EnvelopeCheck = { ok: true; op: Operation } | { ok: false; operationId: string; error: ApiError };

/**
 * Validates one envelope. A missing/invalid operation_id makes the whole batch unreadable (422); any other
 * problem only rejects that operation, so the rest of the batch still applies.
 */
export function checkEnvelope(raw: unknown, index: number): EnvelopeCheck {
  if (!isPlainObject(raw) || !isClientId(raw.operation_id)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { [`operations.${index}.operation_id`]: 'INVALID_ID' });
  }
  const operationId = raw.operation_id;
  const fail = (error: ApiError): EnvelopeCheck => ({ ok: false, operationId, error });
  if (raw.schema_version !== 1) {
    return fail(new ApiError(ErrorCode.CONTRACT_UNSUPPORTED, 400, undefined, { schema_version: 'UNSUPPORTED' }));
  }
  if (!isResourceType(raw.resource_type)) return fail(validationError({ resource_type: 'UNKNOWN_RESOURCE_TYPE' }));
  if (!isClientId(raw.resource_id)) return fail(validationError({ resource_id: 'INVALID_ID' }));
  if (!(SYNC_ACTIONS as readonly unknown[]).includes(raw.action)) return fail(validationError({ action: 'INVALID' }));
  const base = raw.base_revision ?? null;
  if (base !== null && (typeof base !== 'string' || !/^\d{1,19}$/.test(base))) {
    return fail(validationError({ base_revision: 'INVALID' }));
  }
  return {
    ok: true,
    op: {
      operation_id: operationId,
      resource_type: raw.resource_type,
      resource_id: raw.resource_id,
      action: raw.action as SyncAction,
      base_revision: base,
      payload: raw.payload ?? null,
    },
  };
}
