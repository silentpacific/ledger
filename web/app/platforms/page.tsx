import type { Metadata } from "next";
import FacetIndex from "@/components/FacetIndex";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Ecommerce platforms used by Australian online stores",
  description: "Which ecommerce platforms Australian online stores run on (Shopify, Magento, BigCommerce and more), by industry.",
  alternates: { canonical: "/platforms" },
};

export default async function Platforms({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { industry } = await searchParams;
  return FacetIndex({ kind: "platform", title: "Ecommerce platforms", label: "Platform", industry,
    lede: "The platform each store runs on, detected from its own pages." });
}
