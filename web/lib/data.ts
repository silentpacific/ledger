// Data access: the site reads only through the public web_* functions in ledger-db,
// with the publishable key (safe to expose). Pages refresh hourly (ISR).

import { PUBLISHABLE_KEY, SUPABASE_URL } from "./client";
import type { StoreRow } from "./views";

const URL_ = process.env.SUPABASE_URL || SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || PUBLISHABLE_KEY;
export const REVALIDATE = 3600;

export type Fact = { s: string; v: any; at: string; q: string | null; u: string | null; c: string };
export type Site = {
  domain: string; industry?: string; segment: string | null; platform: string | null; homepage_url: string | null;
  first_scanned_at: string; last_scanned_at: string; facts: Record<string, Fact>;
};
export type Promo = {
  domain: string; name: string; type: string | null; discount: string | null; starts: string | null;
  ends: string | null; first_seen: string; last_seen: string; times_seen: number; source: string | null; live: boolean;
};
export type Change = {
  domain: string; category: string; key: string; type: string; from: any; to: any;
  from_status: string | null; to_status: string | null; at: string; confirmed: boolean;
};
export type Product = {
  title: string; type: string | null; url: string | null; first_seen: string;
  prices: { price: number | null; compare_at: number | null; available: boolean | null; from: string; to: string | null }[];
};

// One download per build worker / server instance, shared by every page that asks for the same thing.
const MEMO = new Map<string, { at: number; p: Promise<unknown> }>();

async function rpc<T>(fn: string, args: Record<string, unknown> = {}, revalidate: number | false = REVALIDATE): Promise<T> {
  if (revalidate === false) return rpcOnce<T>(fn, args, revalidate);
  const key = fn + JSON.stringify(args);
  const hit = MEMO.get(key);
  // during a build, one copy serves every page; on the live site keep it only briefly so hourly refreshes see new scans
  const ttl = process.env.NEXT_PHASE === "phase-production-build" ? revalidate * 1000 : 5 * 60 * 1000;
  if (hit && Date.now() - hit.at < ttl) return hit.p as Promise<T>;
  const p = rpcOnce<T>(fn, args, revalidate);
  MEMO.set(key, { at: Date.now(), p });
  p.catch(() => MEMO.delete(key)); // never keep a failure
  return p;
}

async function rpcOnce<T>(fn: string, args: Record<string, unknown>, revalidate: number | false): Promise<T> {
  const fixture = process.env.LEDGER_FIXTURE_DIR;
  if (fixture) return (await import("./fixture")).fixture(fixture, fn, args) as T;
  for (let attempt = 1; ; attempt++) {
    try {
      return await rpcFetch<T>(fn, args, revalidate);
    } catch (e) {
      if (attempt >= 3 || !/ (500|502|503|504) /.test(String(e))) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt)); // the database was briefly busy: try again
    }
  }
}

async function rpcFetch<T>(fn: string, args: Record<string, unknown>, revalidate: number | false): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    // X-Ledger-Data versions Vercel's shared data cache key. web_sites outgrew the 2 MB cache limit, so fresh copies
    // can't be stored and an old one (144 stores, saved while it was still small) kept being served. Bump this if a
    // stale cached copy ever sticks again.
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "X-Ledger-Data": "2" },
    body: JSON.stringify(args),
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate, tags: ["ledger"] } }),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Segments are switched off for now (27 Nov 2026): they overlapped, many had one store, and they weren't
 * an industry standard. The data stays in the database; set this to true to show them again. */
export const SEGMENTS_ENABLED = false;

/** Lists from the scanner can contain empty entries (null, ""); drop them once here so no page can trip on one. */
function clean(s: Site): Site {
  const facts: Record<string, Fact> = {};
  for (const [k, f] of Object.entries(s.facts || {})) {
    facts[k] = Array.isArray(f?.v) ? { ...f, v: f.v.filter((x: unknown) => x != null && !(typeof x === "string" && !x.trim())) } : f;
  }
  return { ...s, facts };
}

/** Every store with every fact. Only the page-data builder (scripts/build-views.ts) calls this: pages read their
 * own worked-out view (getView) or the few stores they show, so no page downloads every store. */
export async function getSites(): Promise<Site[]> {
  const raw = (await rpc<Site[]>("web_sites")).map(clean);
  const sites = SEGMENTS_ENABLED ? raw : raw.map((s) => ({ ...s, segment: null }));
  const { rememberNames } = await import("./format");
  rememberNames(sites); // so pages that only have a domain (feeds, promotions) show the store's real name
  return sites;
}
/** "live" = seen in the site's latest scan AND not past its advertised end date, for every page. */
export async function getPromotions(domains?: string[]): Promise<Promo[]> {
  const today = new Date().toISOString().slice(0, 10);
  return (await rpc<Promo[]>("web_promotions", domains ? { p_domains: domains } : {})).map((p) => ({ ...p, live: p.live && (!p.ends || p.ends.slice(0, 10) >= today) }));
}
/** Changes by stores. Differences found while the starting record was being built (see BASELINE_UNTIL)
 * are improvements in our reading, not changes by the store, so they're left out everywhere. */
export async function getChanges(days = 90, domains?: string[]): Promise<Change[]> {
  const { BASELINE_UNTIL } = await import("./schedule");
  const cut = new Date(BASELINE_UNTIL).getTime();
  return (await rpc<Change[]>("web_changes", domains ? { p_days: days, p_domains: domains } : { p_days: days })).filter((c) => new Date(c.at).getTime() > cut);
}
export const getProducts = (domain: string) => rpc<Product[]>("web_products", { p_domain: domain });
export const suggestSite = (domain: string) => rpc<{ outcome: string; domain?: string }>("web_suggest_site", { p_domain: domain }, false);
export const sendContact = (a: Record<string, string>) => rpc<{ ok: boolean; error?: string }>("web_contact", a, false);

/** Sites with no industry recorded are the first vertical, jewellery. */
export const industryOf = (s: { industry?: string | null }) => s.industry || "jewellery";

/** Sites in one industry (and segment), or all of them. */
export function filterSites(sites: Site[], industry?: string, segment?: string): Site[] {
  if (!SEGMENTS_ENABLED) segment = undefined; // old segment links show the whole industry
  return sites.filter((s) => (!industry || industryOf(s) === industry) && (!segment || s.segment === segment));
}

export function promotionsFor(promos: Promo[], sites: Site[]): Promo[] {
  const d = new Set(sites.map((x) => x.domain));
  return promos.filter((p) => d.has(p.domain));
}

const noSegments = (s: Site): Site => (SEGMENTS_ENABLED ? s : { ...s, segment: null });
/** One store with all its facts, or undefined. */
export async function getSite(domain: string): Promise<Site | undefined> {
  const s = await rpc<Site | null>("web_site", { p_domain: domain });
  return s ? noSegments(clean(s)) : undefined;
}
/** A few stores (at most 10) with all their facts, in the order asked. */
export async function getSitesIn(domains: string[]): Promise<Site[]> {
  if (!domains.length) return [];
  const xs = (await rpc<Site[]>("web_sites_in", { p_domains: domains.slice(0, 10) })).map(clean).map(noSegments);
  return domains.map((d) => xs.find((s) => s.domain === d)).filter((s): s is Site => !!s);
}
/** One page's worked-out numbers (lib/views.ts), refreshed after each scan. */
export async function getView<T = any>(key: string): Promise<T | null> {
  return rpc<T | null>("web_view", { p_key: key });
}
export type View = Awaited<ReturnType<typeof getView>>;
/** The counts behind the industry tabs and page intros. */
export type Counts = { all: number; ind: Record<string, number>; industries: number; latest: string };
export const getCounts = async (): Promise<Counts> => (await getView<Counts>("counts")) ?? { all: 0, ind: {}, industries: 0, latest: "" };
/** One page of a stores table: filtered by industry and list tags ("payments:afterpay") and search words. */
export const PAGE_SIZE = 50;
export async function listSites(o: { industry?: string; tags?: string[]; words?: string[]; page?: number; size?: number }) {
  const size = o.size ?? PAGE_SIZE, page = Math.max(1, o.page || 1);
  return rpc<{ total: number; rows: StoreRow[] }>("web_site_list", {
    p_industry: o.industry || null, p_tags: o.tags || [], p_words: o.words || [], p_limit: size, p_offset: (page - 1) * size });
}
export const getSitemap = () => rpc<{ domain: string; last_scanned_at: string }[]>("web_sitemap");
export type CalendarRow = { domain: string; store: string; industry: string; name: string; discount: string | null; starts: string | null;
  ends: string | null; live: boolean; pct: number; a: string; b: string };
export type Calendar = { rows: CalendarRow[]; shown: number; discount_stores: number; types: Record<string, number>; sites: number;
  live_sites: number; discount_sites: number; deepest: { pct: number; domain: string; store: string } | null; bf_sites: number };
export const promoCalendar = (from: Date, to: Date, industry?: string, type?: string, year = false) =>
  rpc<Calendar>("web_promo_calendar", { p_from: from.toISOString(), p_to: to.toISOString(), p_industry: industry || null, p_type: type || null, p_year: year });
export const promoSearch = (words: string[]) =>
  rpc<{ domain: string; store: string; name: string; discount: string | null; starts: string | null; ends: string | null; live: boolean; last_seen: string }[]>("web_promo_search", { p_words: words });
