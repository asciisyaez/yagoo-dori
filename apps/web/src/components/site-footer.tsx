import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-primary">
        <span><strong>Yagoo-dori</strong> · English hololive Dreams database</span>
        <nav aria-label="Footer navigation">
          <Link href="/sources">Sources</Link>
          <Link href="/methodology">Methodology</Link>
          <Link href="/healthz">Status</Link>
        </nav>
      </div>
      <p className="footer-disclaimer">Unofficial fan site; not affiliated with COVER Corp. or QualiArts.</p>
    </footer>
  );
}
