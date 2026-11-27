// Browser-safe database access: the publishable key only (safe to expose), for search-as-you-type and the homepage record.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iqxscslcntachstcdeve.supabase.co";
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_G06fs18qVltKMOEfi6uhbA_jKa2_uKN";

export async function rpcClient<T>(fn: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", signal,
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Search words for store names and addresses, the same way the index stores them. */
export const words = (s: string) => s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").normalize("NFKD")
  .replace(/[^a-z0-9% ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

export type StoreHit = { domain: string; name: string; industry: string };
/** Stores whose name or address contains every typed word, in name order. */
export async function findStores(q: string, limit = 12, signal?: AbortSignal): Promise<StoreHit[]> {
  const w = words(q);
  if (!w.length) return [];
  const r = await rpcClient<{ rows: StoreHit[] }>("web_site_list", { p_words: w, p_limit: limit }, signal);
  return r.rows;
}
