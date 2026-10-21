"use client";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Calculator,
  ArrowRightLeft,
  Home,
  LibraryBig,
  Menu,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

interface NavigationItem {
  readonly href: string;
  readonly labelKey: TranslationKey;
  readonly icon: LucideIcon;
}

interface NavigationGroup {
  readonly labelKey: TranslationKey;
  readonly items: ReadonlyArray<NavigationItem>;
}

const navigation: ReadonlyArray<NavigationGroup> = [
  {
    labelKey: "nav.groupOverview",
    items: [{ href: "/", labelKey: "nav.home", icon: Home }],
  },
  {
    labelKey: "nav.groupDatabase",
    items: [
      { href: "/cards", labelKey: "nav.cardsAndOutfits", icon: LibraryBig },
      { href: "/talents", labelKey: "nav.talents", icon: UsersRound },
    ],
  },
  {
    labelKey: "nav.groupRankings",
    items: [{ href: "/tier-list", labelKey: "nav.tierList", icon: BarChart3 }],
  },
  {
    labelKey: "nav.groupTools",
    items: [
      { href: "/team-builder", labelKey: "nav.teamCalculator", icon: Calculator },
      { href: "/roll-compare", labelKey: "nav.rollCompare", icon: ArrowRightLeft },
    ],
  },
  {
    labelKey: "nav.groupLearn",
    items: [{ href: "/guides", labelKey: "nav.teamGuides", icon: BookOpen }],
  },
];

interface NavigationLinksProps {
  readonly mobile?: boolean;
  readonly onNavigate?: () => void;
}

function NavigationLinks({ mobile = false, onNavigate }: NavigationLinksProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav aria-label={mobile ? "Mobile navigation" : "Primary navigation"}>
      {navigation.map((group) => (
        <section className="nav-group" key={group.labelKey}>
          <h2>{t(group.labelKey)}</h2>
          {group.items.map((item) => {
            const Icon = item.icon;
            const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                aria-current={current ? "page" : undefined}
                className={`${current ? "nav-current " : ""}cursor-pointer`}
                href={item.href}
                key={item.href}
                prefetch={false}
                {...(mobile && onNavigate ? { onClick: onNavigate } : {})}
              >
                <Icon aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
  );
}

export function SiteHeader() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      mobileTriggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <>
      <aside className="app-sidebar">
        <Link className="sidebar-brand cursor-pointer" href="/" prefetch={false} aria-label={t("nav.homeLabel")}>
          <span className="sidebar-mark"><Image src="/yagoo-dori-mark.svg" alt="" width={42} height={42} priority /></span>
          <span><strong>Yagoo-dori</strong><small>{t("nav.subTitle")}</small></span>
        </Link>
        <NavigationLinks />
        <LanguageSwitcher />
      </aside>

      <header className="mobile-topbar">
        <Link className="mobile-brand cursor-pointer" href="/" prefetch={false} aria-label={t("nav.homeLabel")}>
          <Image src="/yagoo-dori-mark.svg" alt="" width={36} height={36} priority />
          <strong>Yagoo-dori</strong>
        </Link>
        <div className="mobile-drawer">
          <button
            aria-controls="mobile-navigation-panel"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            className="mobile-drawer-trigger cursor-pointer"
            onClick={() => setMobileOpen((value) => !value)}
            ref={mobileTriggerRef}
            type="button"
          >
            <Menu aria-hidden="true" /><span>Menu</span>
          </button>
          {mobileOpen && <div className="mobile-drawer-panel" id="mobile-navigation-panel">
            <div className="drawer-heading"><strong>{t("nav.drawerHeading")}</strong><span>{t("nav.drawerSubHeading")}</span></div>
            <NavigationLinks mobile onNavigate={() => setMobileOpen(false)} />
            <LanguageSwitcher />
          </div>}
        </div>
      </header>
    </>
  );
}
