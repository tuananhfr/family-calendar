import Link from "next/link";
import { t } from "@/i18n/vi";
import { BrandLogo } from "@/design/components";
import { FOOTER_LINKS } from "./nav-config";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface px-4 py-4 md:px-6">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo compact className="[&>span]:size-9 [&_svg]:scale-90" />
          <div>
            <p className="text-sm font-bold text-text">{t("appName")}</p>
            <p className="whitespace-nowrap text-xs text-muted">{t("shell.footerTagline")}</p>
          </div>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-1 gap-y-1 text-xs text-body">
          {FOOTER_LINKS.map((l) => (
            <li key={l.key}>
              <Link href={l.href} className="inline-flex min-h-9 items-center rounded-control px-2 hover:text-primary hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
