import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import FacetDetail, { facetTitle, loadFacet } from "@/components/FacetDetail";
import { facets } from "@/lib/format";
import { getSites } from "@/lib/data";
import { industryName } from "@/lib/industries";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const fc = facets(await getSites());
  return Object.entries(fc).filter(([k]) => k !== "tech").flatMap(([kind, items]) => items.map((x) => ({ kind, value: x.value })));
}

type P = { params: Promise<{ kind: string; value: string }>; searchParams: Promise<{ industry?: string }> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { kind, value } = await params;
  const { industry } = await searchParams;
  const { sites, f } = await loadFacet(kind, value, industry);
  if (!f) return { title: "Not found" };
  const n = sites.filter(f.test).length;
  const scope = industry ? `Australian ${industryName(industry).toLowerCase()} stores` : "Australian online stores";
  return {
    robots: n < 2 || industry ? { index: false, follow: true } : undefined,
    title: `${facetTitle(kind, f.name)}: ${n} ${scope}`,
    description: `${n} of ${sites.length} ${scope}: ${f.name}. See which ones, who added or dropped it recently, and how each industry compares.`,
    alternates: { canonical: `/explore/${kind}/${value}` },
  };
}

export default async function ExploreList({ params, searchParams }: P) {
  const { kind, value } = await params;
  const { industry } = await searchParams;
  if (kind === "tech") redirect(`/tech/${value}${industry ? `?industry=${industry}` : ""}`);
  const page = await FacetDetail({ kind, value, industry });
  if (!page) notFound();
  return page;
}
