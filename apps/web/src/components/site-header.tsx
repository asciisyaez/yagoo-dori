"use client";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Calculator,
  Home,
  LibraryBig,
  Menu,
  Network,
  UsersRound,
} from "lucide-react";

const navigation = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Home", icon: Home }],
  },
  {
    label: "Database",
    items: [
      { href: "/cards", label: "Cards & Outfits", icon: LibraryBig },
      { href: "/talents", label: "Talents", icon: UsersRound },
    ],
  },
  {
    label: "Rankings",
    items: [{ href: "/tier-list", label: "Tier list", icon: BarChart3 }],
  },
  {
    label: "Tools",
    items: [
      { href: "/team-builder", label: "Team calculator", icon: Calculator },
      { href: "/holomem-board", label: "Holomem Board", icon: Network },
    ],
  },
  {
    label: "Learn",
    items: [{ href: "/guides", label: "Team guides", icon: BookOpen }],
  },
] as const;

function NavigationLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label={mobile ? "Mobile navigation" : "Primary navigation"}>
      {navigation.map((group) => (
        <section className="nav-group" key={group.label}>
          <h2>{group.label}</h2>
          {group.items.map((item) => {
            const Icon = item.icon;
            const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                aria-current={current ? "page" : undefined}
                className={current ? "nav-current" : undefined}
                href={item.href}
                key={item.href}
                prefetch={false}
                {...(mobile && onNavigate ? { onClick: onNavigate } : {})}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
  );
}

export function SiteHeader() {
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
        <Link className="sidebar-brand" href="/" prefetch={false} aria-label="Yagoo-dori home">
          <span className="sidebar-mark"><Image src="/yagoo-dori-mark.svg" alt="" width={42} height={42} priority /></span>
          <span><strong>Yagoo-dori</strong><small>hololive Dreams</small></span>
        </Link>
        <NavigationLinks />
      </aside>

      <header className="mobile-topbar">
        <Link className="mobile-brand" href="/" prefetch={false} aria-label="Yagoo-dori home">
          <Image src="/yagoo-dori-mark.svg" alt="" width={36} height={36} priority />
          <strong>Yagoo-dori</strong>
        </Link>
        <div className="mobile-drawer">
          <button
            aria-controls="mobile-navigation-panel"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="mobile-drawer-trigger"
            onClick={() => setMobileOpen((value) => !value)}
            ref={mobileTriggerRef}
            type="button"
          >
            <Menu aria-hidden="true" /><span>Menu</span>
          </button>
          {mobileOpen && <div className="mobile-drawer-panel" id="mobile-navigation-panel">
            <div className="drawer-heading"><strong>Navigate</strong><span>Cards, tiers & guides</span></div>
            <NavigationLinks mobile onNavigate={() => setMobileOpen(false)} />
          </div>}
        </div>
      </header>
    </>
  );
}
