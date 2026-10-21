"use client";

import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
import { ChevronRight } from "lucide-react";

interface PageHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly trail?: { href: string; label: string }[];
  readonly marker?: string;
}

export function PageHeading({ eyebrow, title, intro, trail = [], marker }: PageHeadingProps) {
  const { t } = useTranslation();

  return (
    <header className="page-heading">
      {trail.length > 0 && (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link className="cursor-pointer" href="/">{t("nav.home")}</Link>
          {trail.map((item) => (
            <span key={item.href}>
              <ChevronRight aria-hidden="true" />
              <Link className="cursor-pointer" href={item.href}>{item.label}</Link>
            </span>
          ))}
        </nav>
      )}
      <div className="heading-grid">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-intro">{intro}</p>
        </div>
        {marker && <span className="page-marker">{marker}</span>}
      </div>
    </header>
  );
}
