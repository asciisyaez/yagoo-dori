import { SiteLink as Link } from "@/components/site-link";
import { MapPinned } from "lucide-react";

export default function NotFound() {
  return (
    <section className="not-found">
      <MapPinned aria-hidden="true" />
      <p className="eyebrow">Off the marked route</p>
      <h1>This field note is not on the map.</h1>
      <p>The record may be waiting for evidence, or its route has changed.</p>
      <Link className="button-primary" href="/">
        Return to the park entrance
      </Link>
    </section>
  );
}

