import { notFound } from "next/navigation";
import type { Metadata } from "next";
import FacetDetail, { loadFacet } from "@/components/FacetDetail";
import { facets } from "@/lib/format";
import { getSites } from "@/lib/data";
import { industryName } from "@/lib/industries";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (facets(await getSites()).tech as any[]).map((x) => ({ value: x.value }));
}

type P = { params: Promise<{ value: string }>; searchParams: Promise<{ industry?: string }> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { value } = await params;
  const { industry } = await searchParams;
  const { sites, f } = await loadFacet("tech", value, industry);
  if (!f) return { title: "Not found" };
  const n = sites.filter(f.test).length;
  const scope = industry ? `Australian ${industryName(industry).toLowerCase()} stores` : "Australian online stores";
  return {
    robots: n < 2 || industry ? { index: false, follow: true } : undefined,
    title: `${scope} using ${f.name} (${n})`,
    description: `${n} of ${sites.length} ${scope} use ${f.name}. See which ones, adoption by industry, and who added or dropped it recently.`,
    alternates: { canonical: `/tech/${value}` },
  };
}

export default async function TechTool({ params, searchParams }: P) {
  const { value } = await params;
  const { industry } = await searchParams;
  const page = await FacetDetail({ kind: "tech", value, industry });
  if (!page) notFound();
  return page;
}
