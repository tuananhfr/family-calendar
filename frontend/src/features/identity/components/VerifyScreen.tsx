"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearApiSession } from "@/core/api/client";
import { Button, Select } from "@/design/components";
import { t } from "@/i18n/vi";
import { IdentityFrame } from "./IdentityFrame";
import { importSharedSpaces } from "../model/import-spaces";
import { newOnlineDevice, refreshSession } from "../model/session";
export function VerifyScreen() {
  const router = useRouter();
  const started = useRef(false);
  const [token, setToken] = useState("");
  const [purpose, setPurpose] = useState("link");
  const [actors, setActors] = useState<Array<{ actor_id: string; label: string }>>([]);
  const [actor, setActor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    queueMicrotask(() => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    const secret = fragment.get("token") ?? query.get("token") ?? "";
    const kind = fragment.get("purpose") ?? "link";
    history.replaceState(null, "", location.pathname);
    setToken(secret); setPurpose(kind);
    if (!secret) { setError(t("sharing.invalidToken")); return; }
    if (kind === "login") {
      void api<{ actors: Array<{ actor_id: string; label: string }> }>("POST", "/auth/login/preview", { token: secret }).then((r) => {
        setActors(r.actors); setActor(r.actors[0]?.actor_id ?? "");
        if (!r.actors.length) setError(t("sharing.noAccount"));
      }).catch(() => setError(t("sharing.invalidToken")));
    }
    });
  }, []);
  return <IdentityFrame title={t("sharing.verifyTitle")}>
    <p className="text-sm text-body">{t(purpose === "login" ? "sharing.selectIdentity" : "sharing.linkHint")}</p>
    {purpose === "login" && actors.length ? <Select label={t("sharing.selectIdentity")} options={actors.map((a) => ({ value: a.actor_id, label: a.label }))} value={actor} onValueChange={setActor} /> : null}
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    <Button disabled={!token || !!error || (purpose === "login" && !actor)} loading={busy} onClick={async () => {
      setBusy(true);
      try {
        if (purpose === "login") {
          const pending = await import("@/core/db/db").then(({ db }) => db.outbox.filter((o) => o.state !== "ACKNOWLEDGED" && o.state !== "INVALID").count());
          if (pending) throw new Error(t("sharing.pendingLogout"));
          await api("POST", "/auth/login/verify", { token, actor_id: actor, ...newOnlineDevice() });
          clearApiSession();
          await refreshSession();
          await importSharedSpaces();
          router.replace("/hom-nay/");
        } else {
          await api("POST", "/auth/magic-link/verify", { token });
          await refreshSession(); router.replace("/cai-dat/?tab=account");
        }
      } catch (err) { setError(sharingError(err)); }
      finally { setBusy(false); }
    }}>{t("sharing.verify")}</Button>
  </IdentityFrame>;
}
