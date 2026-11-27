// Data access: the site reads only through the public web_* functions in ledger-db,
// with the publishable key (safe to expose). Pages refresh hourly (ISR).
import fs from "node:fs";
import path from "node:path";

const URL_ = process.env.SUPABASE_URL || "https://iqxscslcntachstcdeve.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_G06fs18qVltKMOEfi6uhbA_jKa2_uKN";
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

// One download per build worker / server instance, shared by every page. web_sites is over Next's 2 MB data-cache
// limit (3 MB+ by 27 Nov 2026), so without this every one of ~300 pages fetched it again during the build and
// Supabase timed out (statement timeout 57014), failing the deploy.
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
  if (fixture) {
    const f = path.join(fixture, `${fn}.json`);
    return (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []) as T;
  }
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

export async function getSites(): Promise<Site[]> {
  const raw = (await rpc<Site[]>("web_sites")).map(clean);
  const sites = SEGMENTS_ENABLED ? raw : raw.map((s) => ({ ...s, segment: null }));
  const { rememberNames } = await import("./format");
  rememberNames(sites); // so pages that only have a domain (feeds, promotions) show the store's real name
  return sites;
}
/** "live" = seen in the site's latest scan AND not past its advertised end date, for every page. */
export async function getPromotions(): Promise<Promo[]> {
  const today = new Date().toISOString().slice(0, 10);
  return (await rpc<Promo[]>("web_promotions")).map((p) => ({ ...p, live: p.live && (!p.ends || p.ends.slice(0, 10) >= today) }));
}
/** Changes by stores. Differences found while the starting record was being built (see BASELINE_UNTIL)
 * are improvements in our reading, not changes by the store, so they're left out everywhere. */
export async function getChanges(days = 90): Promise<Change[]> {
  const { BASELINE_UNTIL } = await import("./schedule");
  const cut = new Date(BASELINE_UNTIL).getTime();
  return (await rpc<Change[]>("web_changes", { p_days: days })).filter((c) => new Date(c.at).getTime() > cut);
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

export async function getSite(domain: string): Promise<Site | undefined> {
  return (await getSites()).find((s) => s.domain === domain);
}
