import { ApiRequestError } from "@/core/api/errors";
import { t } from "@/i18n/vi";
export function sharingError(error: unknown) {
  if (!(error instanceof ApiRequestError)) return error instanceof Error ? error.message : t("sharing.error");
  if (Object.values(error.fields ?? {}).includes("LAST_OWNER")) return t("sharing.lastOwner");
  if (["AUTH_REQUIRED", "SESSION_EXPIRED", "DEVICE_REVOKED"].includes(error.code)) return t("sharing.sessionMissing");
  if (["FORBIDDEN", "SPACE_ACCESS_REVOKED"].includes(error.code)) return t("sharing.permissionDenied");
  if (["INVITE_INVALID", "RECOVERY_INVALID"].includes(error.code) || error.fields?.token) return t("sharing.invalidToken");
  if (error.code === "RATE_LIMITED") return t("sharing.rateLimited");
  if (error.code === "VALIDATION_FAILED") return t("sharing.invalidInput");
  return t("sharing.error");
}
