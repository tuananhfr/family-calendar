"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiRequestError } from "@/core/api/client";
import { Button, Select, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { IdentityFrame } from "@/features/identity/components/IdentityFrame";
import { ensureLocalSession, refreshSession } from "@/features/identity/model/session";
import { importSharedSpaces } from "@/features/identity/model/import-spaces";
import { useAppStore } from "@/store/app.store";
export function JoinScreen() {
  const router = useRouter();
  const started = useRef(false);
  const [token, setToken] = useState("");
  const [requestId, setRequestId] = useState("");
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("PARENT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    queueMicrotask(() => {
      const fragment = new URLSearchParams(location.hash.slice(1));
      const query = new URLSearchParams(location.search);
      const secret = fragment.get("token") ?? query.get("token") ?? "";
      history.replaceState(null, "", location.pathname);
      setToken(secret);
      if (!secret) setRequestId(sessionStorage.getItem("fc.joinRequest") ?? "");
    });
  }, []);
  const preview = useQuery({ queryKey: ["invite-preview", token], queryFn: () => api<{ space_name: string; inviter_display_name: string; expires_at: string }>("POST", "/invites/preview", { token }), enabled: !!token, retry: false });
  const status = useQuery({ queryKey: ["join-status", requestId], queryFn: () => api<{ status: string; space_id?: string }>("GET", "/join-requests/" + requestId), enabled: !!requestId, refetchInterval: (q) => ["PENDING", "PENDING_GUARDIAN"].includes(q.state.data?.status ?? "PENDING") ? 5_000 : false, retry: false });
  return <IdentityFrame title={t("sharing.joinTitle")}>
    {requestId ? <>
      <p className="text-sm text-body" role="status">{t(status.data?.status === "APPROVED" ? "sharing.APPROVED" : status.data?.status === "REJECTED" ? "sharing.rejected" : status.data?.status === "EXPIRED" ? "sharing.expired" : "sharing.pending")}</p>
      {status.isError ? <p className="text-sm text-danger" role="alert">{t("sharing.sessionMissing")}</p> : null}
      {status.data?.status === "APPROVED" ? <Button loading={busy} onClick={async () => {
        setBusy(true); try {
          await refreshSession(); await importSharedSpaces();
          if (status.data?.space_id) useAppStore.getState().setActiveSpaceId(status.data.space_id);
          sessionStorage.removeItem("fc.joinRequest"); router.replace("/hom-nay/");
        } catch { setError(t("sharing.error")); } finally { setBusy(false); }
      }}>{t("sharing.openFamily")}</Button> : null}
    </> : <>
      {preview.isPending && token ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
      {preview.isError || !token ? <p className="text-sm text-danger" role="alert">{t("sharing.expired")}</p> : null}
      {preview.data ? <form className="flex flex-col gap-4" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(undefined);
        try {
          try { await refreshSession(); } catch (err) {
            if (err instanceof ApiRequestError && ["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(err.code)) await ensureLocalSession(); else throw err;
          }
          const request = await api<{ request_id: string }>("POST", "/invites/join", { token, display_name: name, proposed_profile: profile });
          sessionStorage.setItem("fc.joinRequest", request.request_id); setRequestId(request.request_id); setToken("");
        } catch (err) { setError(sharingError(err)); } finally { setBusy(false); }
      }}>
        <div className="rounded-control bg-primary-soft p-4"><h2 className="break-words font-bold text-text">{preview.data.space_name}</h2><p className="text-sm text-body">{preview.data.inviter_display_name}</p></div>
        <p className="text-sm text-body">{t("sharing.joinHint")}</p>
        <TextField label={t("sharing.name")} required maxLength={50} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label={t("sharing.profile")} value={profile} onValueChange={setProfile} options={["PARENT", "SENIOR", "CHILD"].map((p) => ({ value: p, label: t("profile." + p) }))} />
        <Button type="submit" loading={busy} disabled={!name.trim()}>{t("sharing.join")}</Button>
      </form> : null}
    </>}
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </IdentityFrame>;
}
