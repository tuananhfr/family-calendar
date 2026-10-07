"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { t } from "@/i18n/vi";
import { IconButton, Illustration, Sheet } from "@/design/components";
import { FamilySheet } from "./FamilySheet";
import { Footer } from "./Footer";
import { HeaderActions } from "./HeaderActions";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeader } from "./MobileHeader";
import { PaymentPromptHost } from "@/features/finance";
import { ReminderHost } from "@/features/notifications";
import { QuickAddHost } from "./QuickAddHost";
import { SpaceGate } from "./SpaceGate";
import { TasksTodayBadge } from "./TasksTodayBadge";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { ROUTES } from "./nav-config";
import { useShellStore } from "./shell-store";

/**
 * ≥1280 full sidebar · 1024–1279 icon rail · 768–1023 drawer · <768 mobile header + bottom nav (ui-ux.md "Khung ứng dụng").
 */
export function AppShell({ children }: { children: ReactNode }) {
  const drawerOpen = useShellStore((s) => s.drawerOpen);
  const setDrawerOpen = useShellStore((s) => s.setDrawerOpen);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop">
        {t("nav.skipToContent")}
      </a>
      <MobileHeader />
      <header className="sticky top-0 z-30 hidden h-[72px] items-stretch border-b border-border bg-surface/95 pr-4 backdrop-blur md:flex">
        <div className="flex shrink-0 items-center gap-1 pl-2 lg:w-[88px] lg:justify-center lg:pl-0 xl:w-[248px] xl:justify-start xl:pl-5">
          <IconButton label={t("nav.openMenu")} icon={<Menu className="size-5" />} className="lg:hidden" onClick={() => setDrawerOpen(true)} />
          <Link href={ROUTES.today} aria-label={t("appName")} className="flex items-center">
            <Illustration name="logo-mark" height={48} className="rounded-full xl:hidden" priority />
            <Illustration name="logo" height={56} className="hidden xl:block" priority />
          </Link>
        </div>
        <TopNav />
        <div className="flex items-center pl-3">
          <HeaderActions />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="sticky top-[72px] hidden h-[calc(100dvh-72px)] shrink-0 overflow-y-auto overflow-x-hidden border-r border-border bg-surface lg:block lg:w-[88px] xl:w-[248px]">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-5 focus:outline-none md:px-6 md:pb-8 md:pt-6 xl:px-8">
            <SpaceGate>{children}</SpaceGate>
          </main>
          <div className="pb-16 md:pb-0">
            <Footer />
          </div>
        </div>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} side="left" title={t("appName")}>
        <Sidebar collapsible={false} onNavigate={() => setDrawerOpen(false)} />
      </Sheet>
      {/* useSearchParams in the bottom nav needs a Suspense boundary for static export. */}
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
      <FamilySheet />
      <QuickAddHost />
      <TasksTodayBadge />
      <ReminderHost />
      <PaymentPromptHost />
    </div>
  );
}
