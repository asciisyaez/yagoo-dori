import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  return [];
}

export const metadata: Metadata = { title: "Guide not found" };

export default function GuidePage() {
  notFound();
}
