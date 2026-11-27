import type { MetadataRoute } from "next";
import { getCounts, getSitemap, getView } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";
import { facetHref } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;
const STATIC_UPDATED = "2026-11-27";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sites, counts, listed] = await Promise.all([getSitemap(), getCounts(), getView<{ kind: string; value: string; n: number }[]>("facets")]);
  const latest = counts.latest || new Date(0).toISOString();
  const fixed = ["", "/sites", "/tech", "/compare", "/benchmarks", "/promotions", "/industries", "/payments", "/platforms", "/policies"]
    .map((p) => ({ url: `${SITE_URL}${p}`, lastModified: latest, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  // pages whose text only changes when we edit it: their own date (update STATIC_UPDATED when editing them)
  const statics = ["/about", "/contact", "/methodology"]
    .map((p) => ({ url: `${SITE_URL}${p}`, lastModified: STATIC_UPDATED, changeFrequency: "monthly" as const, priority: 0.4 }));
  const siteUrls = sites.map((s) => ({ url: `${SITE_URL}/sites/${s.domain}`, lastModified: s.last_scanned_at, changeFrequency: "weekly" as const, priority: 0.8 }));
  const inds = INDUSTRIES.map((i) => ({ url: `${SITE_URL}/industries/${i.slug}`, lastModified: latest, changeFrequency: "weekly" as const, priority: 0.7 }));
  // only lists with enough sites to be useful get indexed
  const lists = (listed || []).filter((x) => x.n >= 2)
    .map((x) => ({ url: `${SITE_URL}${facetHref(x.kind, x.value)}`, lastModified: latest, changeFrequency: "weekly" as const, priority: 0.6 }));
  return [...fixed, ...statics, ...inds, ...siteUrls, ...lists];
}
