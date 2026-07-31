"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Database,
  Home,
  LibraryBig,
  Menu,
  Shirt,
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
      { href: "/cards", label: "Member cards", icon: LibraryBig },
      { href: "/talents", label: "Talents", icon: UsersRound },
      { href: "/leaders", label: "Leaders / Outfits", icon: Shirt },
    ],
  },
  {
    label: "Rankings",
    items: [{ href: "/tier-list", label: "Member tier list", icon: BarChart3 }],
  },
  {
    label: "Learn",
    items: [
      { href: "/guides", label: "Team guides", icon: BookOpen },
      { href: "/sources", label: "Data sources", icon: Database },
    ],
  },
] as const;

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <aside className="app-sidebar">
        <Link className="sidebar-brand" href="/" prefetch={false} aria-label="Yagoo-dori home">
          <span className="sidebar-mark"><Image src="/yagoo-dori-mark.svg" alt="" width={42} height={42} priority /></span>
          <span><strong>Yagoo-dori</strong><small>hololive Dreams</small></span>
        </Link>
        <NavigationLinks />
        <div className="sidebar-snapshot">
          <span className="snapshot-pulse" aria-hidden="true" />
          <span><strong>Roster synced</strong><small>30 Jul 2026 snapshot</small></span>
        </div>
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
            className="mobile-drawer-trigger"
            onClick={() => setMobileOpen((value) => !value)}
            type="button"
          >
            <Menu aria-hidden="true" /><span>Menu</span>
          </button>
          {mobileOpen && <div className="mobile-drawer-panel" id="mobile-navigation-panel">
            <div className="drawer-heading"><strong>Navigate</strong><span>Database & guides</span></div>
            <NavigationLinks mobile />
          </div>}
        </div>
      </header>
    </>
  );
}
