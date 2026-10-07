"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { HealthMetricType } from "@/core/model/health";
import type { Member } from "@/core/model/member";
import { Button, Dialog, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import type { HealthData } from "../hooks/useHealth";
import { deleteHealthRecord, type HealthType } from "../model/health-writes";
import { MetricForm } from "./MetricForm";
import { NoteForm } from "./NoteForm";
import { ProfileForm } from "./ProfileForm";

export type HealthDialog =
  | { kind: "metric"; memberId?: string; type?: HealthMetricType }
  | { kind: "profile"; member: Member }
  | { kind: "note"; memberId?: string }
  | { kind: "delete"; type: HealthType; id: string; question: string; done: string };

function ConfirmDelete({ request, onClose }: { request: Extract<HealthDialog, { kind: "delete" }>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await deleteHealthRecord(request.type, request.id);
      toast(request.done, "success");
      onClose();
    } catch (e) {
      console.error(e);
      toast(t("health.errors.UNKNOWN"), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      icon={<Trash2 />}
      title={t("common.delete")}
      description={request.question}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => void remove()} loading={busy}>
            {t("common.delete")}
          </Button>
        </>
      }
    />
  );
}

export function HealthDialogs({ dialog, data, onClose }: { dialog: HealthDialog | null; data: HealthData; onClose: () => void }) {
  if (!dialog || !data.spaceId) return null;
  switch (dialog.kind) {
    case "metric":
      return <MetricForm spaceId={data.spaceId} members={data.members} now={data.now} memberId={dialog.memberId} type={dialog.type} onClose={onClose} />;
    case "profile":
      return <ProfileForm spaceId={data.spaceId} member={dialog.member} profile={data.profiles.find((p) => p.memberId === dialog.member.id)} onClose={onClose} />;
    case "note":
      return <NoteForm spaceId={data.spaceId} members={data.members} today={data.today} memberId={dialog.memberId} onClose={onClose} />;
    case "delete":
      return <ConfirmDelete request={dialog} onClose={onClose} />;
  }
}
