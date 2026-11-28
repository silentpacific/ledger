import { INDUSTRIES } from "@/lib/industries";

/** The site's menus, shared by the header and the footer. */
export const INDUSTRY_LINKS: [string, string][] = [...INDUSTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((i) => [`/industries/${i.slug}`, i.name]);
export const INSIGHTS: [string, string, string][] = [
  ["/payments", "Payments", "Cards, wallets and buy now, pay later"],
  ["/promotions", "Promotions", "Who's on sale, how deep, how long"],
  ["/policies", "Policies", "Returns, warranty and delivery terms"],
  ["/tech", "Technologies", "Apps and tools behind each store"],
  ["/platforms", "Platforms", "Shopify, BigCommerce and the rest"],
  ["/benchmarks", "Benchmarks", "What's normal, with the full spread"],
  ["/changes", "What changed", "Every change, dated"],
];
export const COMPANY: [string, string, string][] = [
  ["/about", "About us", "Who we are and what we track"],
  ["/methodology", "Methodology", "How we collect and check facts"],
  ["/contact", "Contact us", "Questions, corrections and opt-outs"],
];
export const LEGAL: [string, string][] = [
  ["/methodology#privacy", "Privacy policy"], ["/methodology#terms", "Terms of use"],
  ["/methodology#opt-out", "Opt out of tracking"], ["/contact?topic=wrong-fact", "Report a wrong fact"],
];
