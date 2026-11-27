// Works out every page's numbers from the latest scans and stores them in the database (web_views, web_site_index),
// so the website never downloads every store. Run after each scan by .github/workflows/views.yml:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/build-views.ts [--dry-run]
// Stores in the not_featured table (plus NOT_FEATURED, comma-separated) are never put forward as examples.
import { getChanges, getPromotions, getSites } from "../lib/data";
import { buildAll } from "../lib/views";

async function notFeaturedTable(): Promise<string[]> {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/not_featured?select=domain`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`not_featured: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { domain: string }[]).map((r) => r.domain);
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const t0 = Date.now();
  const [sites, promos, changes] = await Promise.all([getSites(), getPromotions(), getChanges(365)]);
  const notFeatured = new Set([...(process.env.NOT_FEATURED || "").split(","), ...(await notFeaturedTable())].map((x) => x.trim()).filter(Boolean));
  const { index, views } = buildAll(sites, promos, changes, notFeatured);
  const size = (x: unknown) => JSON.stringify(x).length;
  const big = Object.entries(views).map(([k, v]) => [k, size(v)] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`${sites.length} stores, ${promos.length} promotions, ${changes.length} changes -> ${Object.keys(views).length} views; ` +
    `index ${(size(index) / 1e6).toFixed(2)} MB, views ${(size(views) / 1e6).toFixed(2)} MB; largest: ${big.map(([k, n]) => `${k} ${(n / 1e3).toFixed(0)} kB`).join(", ")}`);
  if (dry) { const fs = await import("node:fs"); fs.writeFileSync(process.env.VIEWS_OUT || "/tmp/views.json", JSON.stringify({ index, views })); return; }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are needed to publish");
  const res = await fetch(`${url}/rest/v1/rpc/publish_web_data`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_index: index, p_views: views }),
  });
  if (!res.ok) throw new Error(`publish failed: ${res.status} ${await res.text()}`);
  console.log("published", await res.json(), `in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
main().catch((e) => { console.error(e); process.exit(1); });
