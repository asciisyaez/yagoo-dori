import "./globals.css";
import "./shell.css";
import "./database.css";

import type { Metadata } from "next";
import localFont from "next/font/local";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const instrumentSans = localFont({
  src: "../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
  variable: "--font-instrument",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Yagoo-dori — hololive Dreams database",
    template: "%s · Yagoo-dori",
  },
  description:
    "An English hololive Dreams card database, Member tier list, Leader directory, and team-building reference.",
  alternates: { canonical: "/" },
  robots:
    process.env.NEXT_PUBLIC_PUBLICATION_READY === "true"
      ? { index: true, follow: true }
      : { index: false, follow: false },
  icons: { icon: "/yagoo-dori-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={instrumentSans.variable} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="app-frame">
          <SiteHeader />
          <div className="app-stage">
            <main id="main-content" tabIndex={-1}>{children}</main>
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
