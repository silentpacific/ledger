import { notFound } from "next/navigation";
import type { Metadata } from "next";
import FacetDetail, { facetTitle, loadFacet } from "@/components/FacetDetail";
import { facetHref, facets } from "@/lib/format";
import { getSites } from "@/lib/data";
import { industryName } from "@/lib/industries";

export type FacetProps = { params: Promise<{ value: string }>; searchParams: Promise<{ industry?: string }> };

/** Route handlers for one kind of list (payments, platform, policy): static params, metadata and the page. */
export function facetRoutes(kind: string) {
  return {
    async generateStaticParams() {
      return (facets(await getSites())[kind] || []).map((x) => ({ value: x.value }));
    },
    async generateMetadata({ params, searchParams }: FacetProps): Promise<Metadata> {
      const { value } = await params;
      const { industry } = await searchParams;
      const { sites, f } = await loadFacet(kind, value, industry);
      if (!f) return { title: "Not found" };
      const n = sites.filter(f.test).length;
      const scope = industry ? `Australian ${industryName(industry).toLowerCase()} stores` : "Australian online stores";
      return {
        robots: n < 2 || industry ? { index: false, follow: true } : undefined,
        title: `${facetTitle(kind, f.name)}: ${n} ${scope}`,
        description: `${n} of ${sites.length} ${scope}: ${f.name}. See which ones, who added or dropped it recently, and how each industry compares.`,
        alternates: { canonical: facetHref(kind, value) },
      };
    },
    async Page({ params, searchParams }: FacetProps) {
      const { value } = await params;
      const { industry } = await searchParams;
      const page = await FacetDetail({ kind, value, industry });
      if (!page) notFound();
      return page;
    },
  };
}
