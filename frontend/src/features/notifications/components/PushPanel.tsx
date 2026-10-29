"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BellRing } from "lucide-react";
import { db } from "@/core/db/db";
import { hasPushSubscription, subscribePush, unsubscribePush, PushSetupError } from "@/core/pwa/push";
import { Button, Card } from "@/design/components";
import { t } from "@/i18n/vi";
import { useNotificationPermission } from "../hooks/useNotificationPermission";

export function PushPanel() {
  const { caps, request } = useNotificationPermission();
  const allowed = useLiveQuery(async () => (await db.settings.get("online.enabled"))?.value === true && (await db.spaces.where("sharingState").equals("SHARED").count()) > 0, []);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let live = true;
    if (!allowed) return;
    void hasPushSubscription().then((value) => live && setSubscribed(value)).catch(() => live && setError(t("pwa.workerFailed")));
    return () => { live = false; };
  }, [allowed]);
  const change = async () => {
    setBusy(true); setError(undefined);
    try {
      if (subscribed) { await unsubscribePush(); setSubscribed(false); }
      else { if (caps?.notification === "default") await request(); await subscribePush(); setSubscribed(true); }
    } catch (err) { setError(err instanceof PushSetupError ? err.message : t("pwa.pushFailed")); }
    finally { setBusy(false); }
  };
  const enabled = allowed && caps?.push && caps.notification !== "denied";
  return <Card className="flex flex-col gap-3">
    <h2 className="flex items-center gap-2 text-base font-bold text-text"><BellRing aria-hidden className="size-5 text-primary" />{t("pwa.pushTitle")}</h2>
    <p className="text-sm text-muted">{t("pwa.pushBody")}</p>
    {!allowed ? <p className="text-sm text-muted">{t("pwa.needsSharing")}</p> : !caps?.push || caps.notification === "denied" ? <p className="text-sm text-muted">{t("pwa.unsupported")}</p> : subscribed ? <p role="status" className="text-sm text-success">{t("pwa.pushEnabled")}</p> : null}
    <Button className="self-start" variant={subscribed ? "secondary" : "primary"} disabled={!enabled || busy} loading={busy} onClick={() => void change()}>{t(subscribed ? "pwa.pushDisable" : "pwa.pushEnable")}</Button>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
  </Card>;
}
