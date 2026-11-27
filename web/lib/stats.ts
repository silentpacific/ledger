import type { Promo, Site } from "./data";
import { facets, isDiscount, label, list, median, money, num } from "./format";
import { PLUMBING, techCategory } from "./tech";

/** A median is shown only when at least this share of an industry's sites state the value. */
export const COVERAGE = 0.6;

export type Cell = { text: string; sort: number | null; sub?: string; enough: boolean };

function medianCell(sites: Site[], key: string, as: (n: number) => string): Cell {
  const xs = sites.map((s) => num(s, key)).filter((x): x is number => x !== undefined);
  if (!sites.length) return { text: "—", sort: null, enough: false };
  if (xs.length / sites.length < COVERAGE) {
    return { text: "Not enough data", sub: `${xs.length} of ${sites.length} stores state it`, sort: null, enough: false };
  }
  const m = median(xs)!;
  return { text: as(m), sub: `${xs.length} of ${sites.length} stores`, sort: m, enough: true };
}

/** The six headline stats for a group of sites (an industry, or everything). */
export function groupStats(sites: Site[], promos: Promo[]) {
  const n = sites.length;
  const dom = new Set(sites.map((s) => s.domain));
  const onSale = new Set(promos.filter((p) => p.live && isDiscount(p) && dom.has(p.domain)).map((p) => p.domain)).size;
  const bnpl = sites.filter((s) => list(s, "payments.bnpl_providers").length);
  const prov = new Map<string, number>();
  bnpl.forEach((s) => list(s, "payments.bnpl_providers").forEach((p) => prov.set(p, (prov.get(p) || 0) + 1)));
  const top = [...prov.entries()].sort((a, b) => b[1] - a[1])[0];
  const tool = (facets(sites).tech as any[]).find((t) => !PLUMBING.has(techCategory(t.name)));
  const pct = (x: number) => (n ? Math.round((100 * x) / n) : 0);
  return {
    sites: { text: String(n), sort: n, enough: true } as Cell,
    onSale: { text: `${pct(onSale)}%`, sub: `${onSale} of ${n} stores`, sort: pct(onSale), enough: true } as Cell,
    freeShipping: medianCell(sites, "shipping.free_shipping_threshold", (m) => money(m) === "Free" ? "Free on all orders" : money(m)!),
    returns: medianCell(sites, "policies.returns.period_days", (m) => `${m} days`),
    bnpl: { text: `${pct(bnpl.length)}%`, sub: top ? `Most common: ${label(top[0])} (${top[1]})` : "None found", sort: pct(bnpl.length), enough: true } as Cell,
    topTool: tool ? { text: tool.name, sub: `${tool.n} of ${n} stores (${pct(tool.n)}%)`, sort: pct(tool.n), enough: true } as Cell
      : { text: "—", sort: null, enough: false } as Cell,
  };
}
export const STAT_COLUMNS = [
  ["sites", "Stores monitored"], ["onSale", "Stores with an active offer"], ["freeShipping", "Median free-shipping minimum"],
  ["returns", "Median returns window"], ["bnpl", "Buy now, pay later detected"], ["topTool", "Most-used tool"],
] as const;
