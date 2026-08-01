import { permanentRedirect } from "next/navigation";

export default async function LeaderProfileRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/cards/${slug}#leader-outfit`);
}
