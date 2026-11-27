import { notFound } from "next/navigation";
import type { Metadata } from "next";
import FacetDetail, { facetTitle, loadFacet } from "@/components/FacetDetail";
import { facets } from "@/lib/format";
import { getSites } from "@/lib/data";
import { industryName } from "@/lib/industries";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (facets(await getSites()).payments || []).map((x) => ({ provider: x.value }));
}

type P = { params: Promise<{ provider: string }>; searchParams: Promise<{ industry?: string }> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { provider } = await params;
  const { industry } = await searchParams;
  const { sites, f } = await loadFacet("payments", provider, industry);
  if (!f) return { title: "Not found" };
  const n = sites.filter(f.test).length;
  const scope = industry ? `Australian ${industryName(industry).toLowerCase()} stores` : "Australian online stores";
  return {
    robots: n < 2 || industry ? { index: false, follow: true } : undefined,
    title: `${facetTitle("payments", f.name)}: ${n} ${scope}`,
    description: `${n} of ${sites.length} ${scope} offer ${f.name}. See which ones, who added or dropped it recently, and how each industry compares.`,
    alternates: { canonical: `/payments/${provider}` },
  };
}

export default async function PaymentOption({ params, searchParams }: P) {
  const { provider } = await params;
  const { industry } = await searchParams;
  const page = await FacetDetail({ kind: "payments", value: provider, industry });
  if (!page) notFound();
  return page;
}
