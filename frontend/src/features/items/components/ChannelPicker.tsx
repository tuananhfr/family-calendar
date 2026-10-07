"use client";

import type { Channel } from "@/core/model/common";
import type { Member } from "@/core/model/member";
import { Checkbox } from "@/design/components";
import { t } from "@/i18n/vi";

/**
 * Email/SMS stay disabled with their real status: this version never sends email or SMS (no provider configured),
 * so a ticked box would promise a message that never goes out.
 */
export function ChannelPicker({ value, onChange, recipients, error }: { value: Channel[]; onChange: (c: Channel[]) => void; recipients: Member[]; error?: string }) {
  const emailStatus = recipients.some((m) => m.email) ? t("items.channels.notConfigured") : t("items.channels.needsEmail");
  const toggle = (c: Channel, on: boolean) => onChange(on ? [...value, c] : value.filter((v) => v !== c));
  return (
    <fieldset data-field="channels" data-invalid={error ? "true" : undefined} className="flex min-w-0 flex-col">
      <legend className="mb-1 text-sm font-semibold text-text">
        {t("items.fields.channels")}
        <span className="text-danger" aria-hidden>
          {" "}*
        </span>
      </legend>
      <Checkbox checked={value.includes("IN_APP")} onCheckedChange={(on) => toggle("IN_APP", on)} label={t("items.channels.IN_APP")} className="min-h-10" />
      <Checkbox
        checked={false}
        onCheckedChange={() => undefined}
        disabled
        className="min-h-10"
        label={
          <span className="text-muted">
            {t("items.channels.EMAIL")} ({emailStatus})
          </span>
        }
      />
      <Checkbox
        checked={false}
        onCheckedChange={() => undefined}
        disabled
        className="min-h-10"
        label={
          <span className="text-muted">
            {t("items.channels.SMS")} ({t("items.channels.notConfigured")})
          </span>
        }
      />
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}
