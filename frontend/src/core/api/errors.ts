// Copy of backend/src/common/errors/error-codes.ts (ARC-02: the apps share no source); keep the two lists in step.
export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  CSRF_INVALID: "CSRF_INVALID",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  DEVICE_REVOKED: "DEVICE_REVOKED",
  SPACE_ACCESS_REVOKED: "SPACE_ACCESS_REVOKED",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  RESOURCE_DELETED: "RESOURCE_DELETED",
  OPERATION_ID_REUSED: "OPERATION_ID_REUSED",
  RESYNC_REQUIRED: "RESYNC_REQUIRED",
  CONTRACT_UNSUPPORTED: "CONTRACT_UNSUPPORTED",
  RATE_LIMITED: "RATE_LIMITED",
  TEMPORARILY_UNAVAILABLE: "TEMPORARILY_UNAVAILABLE",
  SNAPSHOT_TOO_LARGE: "SNAPSHOT_TOO_LARGE",
  ID_COLLISION: "ID_COLLISION",
  INVITE_INVALID: "INVITE_INVALID",
  RECOVERY_INVALID: "RECOVERY_INVALID",
  AI_NOT_CONFIGURED: "AI_NOT_CONFIGURED",
  AI_CONSENT_REQUIRED: "AI_CONSENT_REQUIRED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const KNOWN = new Set<string>(Object.values(ErrorCode));

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && KNOWN.has(value);
}

// Mirrors the backend's fallback for bodies without an envelope (proxy pages, body-parser errors).
const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "AUTH_REQUIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  413: "PAYLOAD_TOO_LARGE",
  415: "VALIDATION_FAILED",
  422: "VALIDATION_FAILED",
  429: "RATE_LIMITED",
  502: "TEMPORARILY_UNAVAILABLE",
  503: "TEMPORARILY_UNAVAILABLE",
  504: "TEMPORARILY_UNAVAILABLE",
};

export function codeForStatus(status: number): ErrorCode {
  return STATUS_TO_CODE[status] ?? (status >= 500 ? "INTERNAL" : "VALIDATION_FAILED");
}

/** A failed API call; `NETWORK` = no HTTP response at all (offline, DNS, CORS, server down). */
export class ApiRequestError extends Error {
  constructor(
    readonly code: ErrorCode | "NETWORK",
    readonly status: number,
    message: string = code,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Worth retrying later with the same request; business 4xx are not (sync-protocol.md Error contract). */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  return error.code === "NETWORK" || error.code === "RATE_LIMITED" || error.code === "TEMPORARILY_UNAVAILABLE" || error.code === "INTERNAL";
}
