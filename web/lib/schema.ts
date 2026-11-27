// Structured data (schema.org JSON-LD), generated from the same data as each page.
import { BRAND } from "./brand";
import { SITE_URL } from "./site";
import type { Fact, Site } from "./data";

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Site-wide: who publishes the site, and a search box for search engines. */
export function siteSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": ORG_ID, name: BRAND, url: SITE_URL, areaServed: "AU",
        description: "Dated, sourced facts on how Australian online stores sell: policies, prices, promotions, payments and tech." },
      { "@type": "WebSite", "@id": WEBSITE_ID, name: BRAND, url: SITE_URL, inLanguage: "en-AU", publisher: { "@id": ORG_ID },
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string" } },
    ],
  };
}

export type Crumb = [string, string?];
export type ListEntry = { name: string; path: string };

/** One page: its type, breadcrumbs (Home is added) and, for list pages, the items it lists. */
export function pageSchema({ type = "WebPage", name, path, description, crumbs = [], items, extra = [], dateModified }: {
  type?: string; name: string; path: string; description?: string; crumbs?: Crumb[]; items?: ListEntry[];
  extra?: object[]; dateModified?: string;
}) {
  const url = abs(path);
  const trail: Crumb[] = [["Home", "/"], ...crumbs];
  const graph: object[] = [
    { "@type": type, "@id": `${url}#page`, url, name, ...(description ? { description } : {}), inLanguage: "en-AU",
      isPartOf: { "@id": WEBSITE_ID }, publisher: { "@id": ORG_ID }, ...(dateModified ? { dateModified } : {}),
      ...(items?.length ? { mainEntity: { "@id": `${url}#list` } } : {}) },
  ];
  if (crumbs.length) {
    graph.push({ "@type": "BreadcrumbList", itemListElement: trail.map(([n, p], i) => ({
      "@type": "ListItem", position: i + 1, name: n, ...(p || i === trail.length - 1 ? { item: abs(p ?? path) } : {}) })) });
  }
  if (items?.length) {
    graph.push({ "@type": "ItemList", "@id": `${url}#list`, numberOfItems: items.length,
      itemListElement: items.slice(0, 200).map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, url: abs(x.path) })) });
  }
  return { "@context": "https://schema.org", "@graph": [...graph, ...extra] };
}

const f = (s: Site, k: string): Fact | undefined => s.facts?.[k];
const observed = (s: Site, k: string) => { const x = f(s, k); return x && x.s === "observed" ? x.v : undefined; };

/** A tracked store, described from its observed facts (only what the store's own pages state). */
export function storeSchema(s: Site, name: string) {
  const days = observed(s, "policies.returns.period_days");
  const freeReturns = observed(s, "policies.returns.free_returns");
  const out: Record<string, unknown> = {
    "@type": "OnlineStore", "@id": `${abs(`/sites/${s.domain}`)}#store`, name, url: s.homepage_url || `https://${s.domain}/`, areaServed: "AU",
  };
  if (typeof days === "number") {
    out.hasMerchantReturnPolicy = { "@type": "MerchantReturnPolicy", applicableCountry: "AU", merchantReturnDays: days,
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      ...(freeReturns === true ? { returnFees: "https://schema.org/FreeReturn" } : {}) };
  }
  return out;
}
