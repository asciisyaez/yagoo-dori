import NextLink, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";

type SiteLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

/**
 * Next 16 emits invalid RSC prefetch URLs for static exports. Normal document
 * navigation remains reliable, so prefetch stays off until that upstream bug
 * is fixed.
 */
export function SiteLink({ prefetch = false, ...props }: SiteLinkProps) {
  return <NextLink {...props} prefetch={prefetch} />;
}
