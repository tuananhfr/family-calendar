"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/app-shell/nav-config";
import { ArrowLeft, ArrowRight, History } from "lucide-react";
import { newId } from "@/core/ids";
import { profileForRelationship } from "@/core/model/common";
import { Button, Card, Dialog, SkeletonList } from "@/design/components";
import { t } from "@/i18n/vi";
import { useActiveSpace } from "@/features/members";
import { RestoreWizard } from "@/features/settings";
import { useAppStore } from "@/store/app.store";
import { createFamily, type StartOption } from "../model/create-family";
import { StepDevice } from "./StepDevice";
import { StepMembers, newPerson, type DraftPerson } from "./StepMembers";
import { StepStart } from "./StepStart";
import { Stepper } from "./Stepper";

export function OnboardingScreen() {
  const router = useRouter();
  const { spaces, loading } = useActiveSpace();
  const setActive = useAppStore((s) => s.setActiveSpaceId);
  const setUsingMemberId = useAppStore((s) => s.setUsingMemberId);
  const setSeniorMode = useAppStore((s) => s.setSeniorMode);

  const [step, setStep] = useState(0);
  const [familyName, setFamilyName] = useState(t("onboarding.familyNameDefault"));
  const [people, setPeople] = useState<DraftPerson[]>([]);
  const [startWith, setStartWith] = useState<StartOption>("CALENDAR");
  const [who, setWho] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string>();
  const [showNameErrors, setShowNameErrors] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const finished = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Opening /bat-dau with a family already on this device (bookmark, back button) goes to Today instead.
  useEffect(() => {
    if (!loading && spaces.length > 0 && !finished.current) router.replace(ROUTES.today);
  }, [loading, spaces.length, router]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (loading || spaces.length > 0) return <SkeletonList rows={3} />;

  const goNext = () => {
    if (step === 0) {
      if (!familyName.trim()) return setStepError(t("onboarding.familyName") + ": " + t("common.required"));
      if (people.length === 0) return setStepError(t("onboarding.members.empty"));
      if (people.some((p) => !p.displayName.trim())) {
        setShowNameErrors(true);
        return setStepError(t("onboarding.members.needName"));
      }
    }
    setStepError(undefined);
    setStep((s) => s + 1);
  };

  const finish = async () => {
    setCreating(true);
    setStepError(undefined);
    try {
      const { spaceId, memberIds } = await createFamily({
        familyName: familyName.trim(),
        members: people.map((p) => ({
          relationship: p.relationship,
          displayName: p.displayName.trim(),
        })),
        startWith,
      });
      finished.current = true;
      setActive(spaceId);
      const idx = who ? people.findIndex((p) => p.key === who) : -1;
      if (idx >= 0) {
        setUsingMemberId(memberIds[idx]);
        // ui-ux.md "Chế độ Senior": a device bound to a SENIOR member starts in large-text mode.
        if (profileForRelationship(people[idx].relationship) === "SENIOR") setSeniorMode(true);
      }
      router.replace(ROUTES.today);
    } catch {
      setStepError(t("onboarding.device.error"));
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Stepper step={step} />
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {t(`onboarding.steps.${step}`)}
      </h1>
      <Card className="md:p-7">
        {step === 0 ? (
          <StepMembers
            familyName={familyName}
            onFamilyName={setFamilyName}
            people={people}
            onAdd={(r) => {
              setPeople((ps) => [...ps, newPerson(r, newId())]);
              setStepError(undefined);
            }}
            onChange={(key, name) => setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, displayName: name } : p)))}
            onRemove={(key) => {
              setPeople((ps) => ps.filter((p) => p.key !== key));
              if (who === key) setWho(null);
            }}
            error={stepError}
            showNameErrors={showNameErrors}
          />
        ) : step === 1 ? (
          <StepStart value={startWith} onChange={setStartWith} />
        ) : (
          <StepDevice people={people} who={who} onWho={setWho} error={stepError} />
        )}
      </Card>
      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" icon={<ArrowLeft aria-hidden className="size-4" />} onClick={() => setStep((s) => s - 1)} disabled={creating}>
            {t("onboarding.back")}
          </Button>
        ) : (
          // A new phone or a wiped browser starts here; settings sit behind a family, so restore is offered now.
          <Button variant="ghost" icon={<History aria-hidden className="size-4" />} onClick={() => setRestoring(true)}>
            {t("onboarding.restore.open")}
          </Button>
        )}
        {step < 2 ? (
          <Button onClick={goNext} size="lg">
            {t("onboarding.next")}
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button onClick={finish} size="lg" loading={creating}>
            {creating ? t("onboarding.device.creating") : t("onboarding.device.finish")}
          </Button>
        )}
      </div>
      <Dialog open={restoring} onOpenChange={setRestoring} title={t("onboarding.restore.title")} description={t("settings.restore.body")} icon={<History />} size="md">
        {/* The redirect effect above sends the user to Today as soon as the restored Space exists. */}
        <RestoreWizard bare onRestored={() => setRestoring(false)} />
      </Dialog>
    </div>
  );
}
