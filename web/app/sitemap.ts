import type { MetadataRoute } from "next";
import { getSites } from "@/lib/data";
import { facets } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sites = await getSites();
  const latest = sites.reduce((a, s) => (s.last_scanned_at > a ? s.last_scanned_at : a), new Date(0).toISOString());
  const fixed = ["", "/sites", "/explore", "/compare", "/benchmarks", "/promotions", "/industries", "/about", "/contact", "/methodology"]
    .map((p) => ({ url: `${SITE_URL}${p}`, lastModified: latest, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  const siteUrls = sites.map((s) => ({ url: `${SITE_URL}/sites/${s.domain}`, lastModified: s.last_scanned_at, changeFrequency: "weekly" as const, priority: 0.8 }));
  const fc = facets(sites);
  // only lists with enough sites to be useful get indexed
  const lists = Object.entries(fc).flatMap(([k, items]) => items.filter((x: any) => x.n >= 2)
    .map((x) => ({ url: `${SITE_URL}/explore/${k}/${x.value}`, lastModified: latest, changeFrequency: "weekly" as const, priority: 0.6 })));
  return [...fixed, ...siteUrls, ...lists];
}
