import { publicCards } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  return publicCards.map((card) => ({ slug: card.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cardPath = `/cards/${slug}/`;
  return {
    alternates: { canonical: cardPath },
    openGraph: { url: cardPath },
  };
}

export default async function LeaderProfileRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/cards/${slug}#leader-outfit`);
}
