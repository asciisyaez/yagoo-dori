import packageJson from "../../package.json";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-disclaimer">Unofficial fan site; not affiliated with COVER Corp. or QualiArts.</p>
      <p className="footer-version">v{packageJson.version}</p>
    </footer>
  );
}
