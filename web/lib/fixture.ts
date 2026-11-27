// Local builds without the database (LEDGER_FIXTURE_DIR): answers the web_* functions from saved files.
// <dir>/web_sites.json etc. are saved copies; <dir>/views.json is the builder's --dry-run output.
import fs from "node:fs";
import path from "node:path";

const load = (dir: string, f: string) => { const p = path.join(dir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null; };

export function fixture(dir: string, fn: string, a: Record<string, any>): unknown {
  const v = load(dir, "views.json") || { index: [], views: {} };
  const sites = load(dir, "web_sites.json") || [];
  const index: any[] = v.index;
  switch (fn) {
    case "web_view": return v.views[a.p_key] ?? null;
    case "web_site": return sites.find((s: any) => s.domain === a.p_domain) ?? null;
    case "web_sites_in": return sites.filter((s: any) => (a.p_domains || []).includes(s.domain));
    case "web_site_card": return index.find((x) => x.domain === a.p_domain)?.card ?? null;
    case "web_sitemap": return index.map((x) => ({ domain: x.domain, last_scanned_at: x.last_scanned_at }));
    case "web_site_list": {
      const m = index.filter((x) => (!a.p_industry || x.industry === a.p_industry) && (a.p_tags || []).every((t: string) => x.tags.includes(t))
        && (a.p_words || []).every((w: string) => x.search.includes(w)));
      const off = a.p_offset || 0, lim = a.p_limit || 50;
      return { total: m.length, rows: m.slice(off, off + lim).map((x) => ({ domain: x.domain, name: x.name, industry: x.industry, ...x.row })) };
    }
    case "web_promotions": { const p = load(dir, "web_promotions.json") || []; return a.p_domains ? p.filter((x: any) => a.p_domains.includes(x.domain)) : p; }
    case "web_changes": { const c = load(dir, "web_changes.json") || []; return a.p_domains ? c.filter((x: any) => a.p_domains.includes(x.domain)) : c; }
    case "web_promo_calendar": return { rows: [], shown: 0, discount_stores: 0, types: {}, sites: index.length, live_sites: 0, discount_sites: 0, deepest: null, bf_sites: 0 };
    case "web_promo_search": return [];
    default: return load(dir, `${fn}.json`) ?? [];
  }
}
