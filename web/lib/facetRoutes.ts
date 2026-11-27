import { notFound } from "next/navigation";
import type { Metadata } from "next";
import FacetDetail, { facetTitle, loadFacet } from "@/components/FacetDetail";
import { facetHref } from "@/lib/format";
import { getView } from "@/lib/data";
import { industryName } from "@/lib/industries";

export type FacetProps = { params: Promise<{ value: string }>; searchParams: Promise<{ industry?: string; page?: string }> };
type Listed = { kind: string; value: string; name: string; n: number }[];

/** Route handlers for one kind of list (payments, tech, platform, policy): static params, metadata and the page. */
export function facetRoutes(kind: string) {
  return {
    async generateStaticParams() {
      return ((await getView<Listed>("facets")) || []).filter((x) => x.kind === kind).map((x) => ({ value: x.value }));
    },
    async generateMetadata({ params, searchParams }: FacetProps): Promise<Metadata> {
      const { value } = await params;
      const { industry, page } = await searchParams;
      const f = await loadFacet(kind, value);
      if (!f) return { title: "Not found" };
      const c = f.counts[industry || "all"] ?? { m: 0, n: 0 };
      const scope = industry ? `Australian ${industryName(industry).toLowerCase()} stores` : "Australian online stores";
      const verb = kind === "tech" ? `use ${f.name}` : f.name;
      return {
        robots: c.m < 2 || industry || (page && page !== "1") ? { index: false, follow: true } : undefined,
        title: kind === "tech" ? `${scope} using ${f.name} (${c.m})` : `${facetTitle(kind, f.name)}: ${c.m} ${scope}`,
        description: kind === "tech" ? `${c.m} of ${c.n} ${scope} ${verb}. See which ones, adoption by industry, and who added or dropped it recently.`
          : `${c.m} of ${c.n} ${scope}: ${f.name}. See which ones, who added or dropped it recently, and how each industry compares.`,
        alternates: { canonical: facetHref(kind, value) },
      };
    },
    async Page({ params, searchParams }: FacetProps) {
      const { value } = await params;
      const { industry, page } = await searchParams;
      const out = await FacetDetail({ kind, value, industry, page: Math.max(1, Number(page) || 1) });
      if (!out) notFound();
      return out;
    },
  };
}
