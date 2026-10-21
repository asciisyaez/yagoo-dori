"use client";

import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
import { MapPinned } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <section className="not-found">
      <MapPinned aria-hidden="true" />
      <p className="eyebrow">{t("notFound.eyebrow")}</p>
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.desc")}</p>
      <Link className="button-primary cursor-pointer transition-colors duration-200" href="/">
        {t("notFound.returnHome")}
      </Link>
    </section>
  );
}
