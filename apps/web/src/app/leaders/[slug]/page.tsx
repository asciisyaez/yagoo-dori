import { publicCards } from "@yagoo-dori/core";
import { permanentRedirect } from "next/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  return publicCards.map((card) => ({ slug: card.slug }));
}

export default async function LeaderProfileRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/cards/${slug}#leader-outfit`);
}
