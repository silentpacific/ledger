import type { Metadata } from "next";
import FacetIndex from "@/components/FacetIndex";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Store policies at Australian online stores: returns, delivery, loyalty",
  description: "How many Australian online stores offer free returns, 30-day returns, same-day delivery, click and collect, loyalty programmes and more, by industry.",
  alternates: { canonical: "/policies" },
};

export default async function Policies({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { industry } = await searchParams;
  return FacetIndex({ kind: "policy", title: "Store policies", label: "Policy", industry,
    lede: "Returns, delivery, loyalty and AI-readiness policies, as each store states them." });
}
