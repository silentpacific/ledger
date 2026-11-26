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

async function rpc<T>(fn: string, args: Record<string, unknown> = {}, revalidate: number | false = REVALIDATE): Promise<T> {
  const fixture = process.env.LEDGER_FIXTURE_DIR;
  if (fixture) {
    const f = path.join(fixture, `${fn}.json`);
    return (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []) as T;
  }
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate, tags: ["ledger"] } }),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const getSites = () => rpc<Site[]>("web_sites");
export const getPromotions = () => rpc<Promo[]>("web_promotions");
export const getChanges = (days = 90) => rpc<Change[]>("web_changes", { p_days: days });
export const getProducts = (domain: string) => rpc<Product[]>("web_products", { p_domain: domain });
export const suggestSite = (domain: string) => rpc<{ outcome: string; domain?: string }>("web_suggest_site", { p_domain: domain }, false);
export const sendContact = (a: Record<string, string>) => rpc<{ ok: boolean; error?: string }>("web_contact", a, false);

/** Jewellery-only views (home feed, benchmarks, explore, promotions) until other industries have enough history. */
export async function getJewellery(): Promise<Site[]> {
  return (await getSites()).filter((s) => (s.industry || "jewellery") === "jewellery");
}

export async function getJewelleryPromotions(): Promise<Promo[]> {
  const [sites, promos] = await Promise.all([getJewellery(), getPromotions()]);
  const d = new Set(sites.map((x) => x.domain));
  return promos.filter((p) => d.has(p.domain));
}

export async function getSite(domain: string): Promise<Site | undefined> {
  return (await getSites()).find((s) => s.domain === domain);
}
