import type { ReactNode } from "react";
import Link from "next/link";
import { t } from "@/i18n/vi";
import { Illustration } from "@/design/components";

// Onboarding, invite join and active SOS run without app chrome so nothing competes with the one task.
export default function BareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <Link href="/" aria-label={t("appName")} className="self-start">
        <Illustration name="logo" height={56} priority />
      </Link>
      <main id="main">{children}</main>
    </div>
  );
}
