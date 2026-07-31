import Link from "next/link";
import { ChevronRight } from "lucide-react";

type PageHeadingProps = {
  eyebrow: string;
  title: string;
  intro: string;
  trail?: { href: string; label: string }[];
  marker?: string;
};

export function PageHeading({ eyebrow, title, intro, trail = [], marker }: PageHeadingProps) {
  return (
    <header className="page-heading">
      {trail.length > 0 && (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Park entrance</Link>
          {trail.map((item) => (
            <span key={item.href}>
              <ChevronRight aria-hidden="true" />
              <Link href={item.href}>{item.label}</Link>
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

