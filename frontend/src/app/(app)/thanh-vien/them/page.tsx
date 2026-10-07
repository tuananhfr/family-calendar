import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { SkeletonList } from "@/design/components";
import { AddMemberScreen } from "@/features/members";

export const metadata: Metadata = { title: t("members.form.addTitle") };

export default function AddMemberPage() {
  // useSearchParams (?id= for editing) needs a Suspense boundary under static export.
  return (
    <Suspense fallback={<SkeletonList rows={4} />}>
      <AddMemberScreen />
    </Suspense>
  );
}
