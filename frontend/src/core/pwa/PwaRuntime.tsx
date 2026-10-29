"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Dialog } from "@/design/components";
import { t } from "@/i18n/vi";
import { useServiceWorker } from "./useServiceWorker";

export function PwaRuntime() {
  const { waiting, error } = useServiceWorker();
  const [dismissed, setDismissed] = useState<ServiceWorker | null>(null);
  const [busy, setBusy] = useState(false);
  const activate = () => {
    if (!waiting) return;
    setBusy(true);
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    waiting.postMessage({ type: "ACTIVATE_UPDATE" });
  };
  return <>
    {error ? <p role="status" className="fixed bottom-20 inset-x-3 z-30 mx-auto max-w-lg rounded-control border border-border bg-surface px-4 py-3 text-sm text-muted shadow-card sm:bottom-3">{t("pwa.workerFailed")}</p> : null}
    <Dialog open={!!waiting && waiting !== dismissed} onOpenChange={(open) => !open && setDismissed(waiting)} size="sm" title={t("pwa.updateTitle")} description={t("pwa.updateBody")} icon={<RefreshCw />} footer={<><Button variant="secondary" disabled={busy} onClick={() => setDismissed(waiting)}>{t("pwa.later")}</Button><Button loading={busy} onClick={activate}>{t("pwa.update")}</Button></>} />
  </>;
}
