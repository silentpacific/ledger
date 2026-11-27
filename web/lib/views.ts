// Page numbers worked out once, after each scan, by scripts/build-views.ts, and stored in web_views / web_site_index.
// Pages read only their own view, so no page ever downloads every store. Everything here must be plain JSON.
import type { Change, Promo, Site } from "./data";
import { filterSites, industryOf, promotionsFor } from "./data";
import {
  dateAU, describeChange, facets, isDiscount, label, list, maxPct, median, money, num, show, siteName, slug, val, WALLETS, facetHref,
} from "./format";
import { INDUSTRIES, industryName } from "./industries";
import { COVERAGE, groupStats } from "./stats";
import { PLUMBING, TECH_ORDER, techCategory } from "./tech";

export type FeedItem = { at: string; tag: string; site: string; domain: string; i: string; ind: string; text: string; when: string; sig: string };
export type Card = { domain: string; name: string; industry: string; checked: string; rows: [string, string | null][]; peers: string[] };
/** One line of a stores table (sites list, industry page, list pages). */
export type StoreRow = {
  domain: string; name: string; industry: string;
  p: string | null; fs: number | null; ret: number | null; bn: string[]; lp: string | null; last: string;
};
export type IndexEntry = {
  domain: string; name: string; industry: string; pos: number; search: string; tags: string[];
  row: Omit<StoreRow, "domain" | "name" | "industry">; card: Card; last_scanned_at: string;
};
export type Bar = { label: string; n: number; text?: string; href?: string; color?: string };
export type Ref = { domain: string; name: string };
export type ChangeLine = { domain: string; store: string; text: string; at: string; i: string };

const DAY = 864e5;
const short = (d: string | Date) => dateAU(d, { day: "numeric", month: "short", year: "numeric" });
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9% ]+/g, " ").replace(/\s+/g, " ").trim();
const latestOf = (xs: Site[]) => xs.reduce((a, s) => (s.last_scanned_at > a ? s.last_scanned_at : a), "");
const ref = (s: Site): Ref => ({ domain: s.domain, name: siteName(s) });
const changeLine = (c: Change, byDomain: Map<string, Site>): ChangeLine =>
  ({ domain: c.domain, store: siteName(c.domain), text: describeChange(c).text, at: c.at, i: industryOf(byDomain.get(c.domain) || {}) });
/** Scopes every filtered page is worked out for: all industries, then each industry. */
const SCOPES = ["all", ...INDUSTRIES.map((i) => i.slug)];
const scoped = (all: Site[], scope: string) => (scope === "all" ? all : filterSites(all, scope));
const coreCount = (s: Site) => ["shipping.free_shipping_threshold", "shipping.standard_shipping_cost", "policies.returns.period_days",
  "policies.returns.change_of_mind"].filter((k) => show(s, k) !== "Not stated").length;

// ---------- the per-store index ----------
function tagsOf(s: Site, fc: Record<string, any[]>): string[] {
  const out: string[] = [];
  for (const kind of ["payments", "tech", "platform", "policy"]) for (const f of fc[kind] || []) if (f.test(s)) out.push(`${kind}:${f.value}`);
  return out;
}

function cards(all: Site[], promos: Promo[], notFeatured: Set<string>): Map<string, Card> {
  const liveBest = new Map<string, Promo>();
  promos.filter((p) => p.live).forEach((p) => { const b = liveBest.get(p.domain); if (!b || maxPct(p) > maxPct(b) || (!isDiscount(b) && isDiscount(p))) liveBest.set(p.domain, p); });
  const peersBy = new Map<string, Site[]>(); // per industry, the most complete records first
  for (const s of all) peersBy.set(industryOf(s), [...(peersBy.get(industryOf(s)) || []), s]);
  for (const [k, xs] of peersBy) peersBy.set(k, xs.filter((x) => !notFeatured.has(x.domain)).sort((a, b) => coreCount(b) - coreCount(a)));
  const out = new Map<string, Card>();
  for (const s of all) {
    const fs = num(s, "shipping.free_shipping_threshold"), rd = num(s, "policies.returns.period_days");
    const offer = liveBest.get(s.domain);
    const tech = ((val(s, "tech_stack.technologies") as string[] | undefined) || []).filter((t) => !PLUMBING.has(techCategory(t)))
      .sort((a, b) => TECH_ORDER.indexOf(techCategory(a)) - TECH_ORDER.indexOf(techCategory(b))); // commerce tools before ad pixels
    const opt = (v: string) => (v === "Not stated" ? null : v);
    out.set(s.domain, {
      domain: s.domain, name: siteName(s), industry: industryName(industryOf(s)), checked: short(s.last_scanned_at),
      peers: (peersBy.get(industryOf(s)) || []).filter((x) => x.domain !== s.domain).slice(0, 2).map((x) => x.domain),
      rows: [
        ["Free shipping over", fs === undefined ? null : fs === 0 ? "Free on every order" : money(fs)],
        ["Standard delivery", opt(show(s, "shipping.standard_shipping_cost", (v) => money(v) ?? String(v)))],
        ["Returns window", rd === undefined ? null : `${rd} days`],
        ["Change of mind", opt(show(s, "policies.returns.change_of_mind"))],
        ["Buy now, pay later", list(s, "payments.bnpl_providers").map(label).join(", ") || null],
        ["Running now", offer ? `${offer.name}${offer.discount && !offer.name.toLowerCase().includes(offer.discount.toLowerCase().slice(0, 10)) ? `: ${offer.discount}` : ""}` : "No offer seen this week"],
        ["Tools", tech.length ? `${tech.slice(0, 2).join(", ")}${tech.length > 2 ? ` and ${tech.length - 2} more` : ""}` : null],
      ],
    });
  }
  return out;
}

export function buildIndex(all: Site[], promos: Promo[], notFeatured: Set<string>): IndexEntry[] {
  const fc = facets(all);
  const cs = cards(all, promos, notFeatured);
  return [...all].sort((a, b) => siteName(a).localeCompare(siteName(b))).map((s, pos) => {
    const fs = num(s, "shipping.free_shipping_threshold"), rd = num(s, "policies.returns.period_days"), lp = val(s, "loyalty.program"), p = val(s, "tech_stack.platform");
    return {
      domain: s.domain, name: siteName(s), industry: industryOf(s), pos, search: norm(`${siteName(s)} ${s.domain}`), tags: tagsOf(s, fc),
      row: { p: typeof p === "string" ? p : null, fs: fs ?? null, ret: rd ?? null, bn: list(s, "payments.bnpl_providers"),
        lp: typeof lp === "string" ? lp : null, last: s.last_scanned_at },
      card: cs.get(s.domain)!, last_scanned_at: s.last_scanned_at,
    };
  });
}

// ---------- homepage ----------
function feedItems(subset: Site[], promosAll: Promo[], changes: Change[]): FeedItem[] {
  const byDomain = new Map(subset.map((s) => [s.domain, s]));
  const promos = promotionsFor(promosAll, subset);
  const items: FeedItem[] = [];
  for (const c of changes.filter((c) => c.confirmed)) {
    const s = byDomain.get(c.domain);
    if (!s) continue;
    const d = describeChange(c);
    const cat = c.category.replace(/_/g, " ");
    items.push({ at: c.at, tag: cat.charAt(0).toUpperCase() + cat.slice(1), site: siteName(c.domain), domain: c.domain, i: industryOf(s), ind: industryName(industryOf(s)),
      text: d.text.charAt(0).toUpperCase() + d.text.slice(1), when: `Changed between scans · confirmed ${short(c.at)}`, sig: d.significance });
  }
  const best = new Map<string, Promo>();
  promos.filter((p) => p.live && isDiscount(p) && Date.now() - new Date(p.last_seen).getTime() < 7 * DAY)
    .forEach((p) => { const b = best.get(p.domain); if (!b || maxPct(p) > maxPct(b)) best.set(p.domain, p); });
  for (const p of best.values()) {
    const s = byDomain.get(p.domain)!;
    const isNew = new Date(p.first_seen).getTime() - new Date(s.first_scanned_at).getTime() > 36e5;
    const offer = `${p.name}${p.discount && !p.name.toLowerCase().includes(p.discount.toLowerCase().slice(0, 12)) ? `: ${p.discount}` : ""}`;
    items.push({ at: p.first_seen, tag: isNew ? "Offer first seen this week" : "Offer running", site: siteName(p.domain), domain: p.domain, i: industryOf(s), ind: industryName(industryOf(s)),
      text: offer, when: `First seen ${short(p.first_seen)} · last confirmed ${short(p.last_seen)}${p.ends ? ` · ends ${short(p.ends)}` : ""}`,
      sig: maxPct(p) >= 30 ? "High" : "Medium" });
  }
  return items;
}
/** The feed shows this many items per industry (or overall); older ones are on each store's page. */
export const FEED_MAX = 300;

function home(all: Site[], promosAll: Promo[], changes: Change[], cs: Map<string, Card>, notFeatured: Set<string>) {
  const byDomainAll = new Map(all.map((s) => [s.domain, s]));
  const allStats = groupStats(all, promosAll);
  const bnplSites = all.filter((s) => list(s, "payments.bnpl_providers").length);
  const afterpay = bnplSites.filter((s) => list(s, "payments.bnpl_providers").includes("afterpay")).length;
  const thresholds = all.map((s) => num(s, "shipping.free_shipping_threshold")).filter((x): x is number => x !== undefined);
  const groups = INDUSTRIES.map((i) => ({ i, xs: filterSites(all, i.slug) })).filter((g) => g.xs.length >= 5)
    .map((g) => ({ ...g, st: groupStats(g.xs, promotionsFor(promosAll, g.xs)) }));
  const mostOnSale = [...groups].sort((a, b) => (b.st.onSale.sort ?? 0) - (a.st.onSale.sort ?? 0))[0];
  const cheapestShip = groups.filter((g) => g.st.freeShipping.enough).sort((a, b) => (a.st.freeShipping.sort ?? 0) - (b.st.freeShipping.sort ?? 0))[0];
  const firstScan = new Map(all.map((s) => [s.domain, new Date(s.first_scanned_at).getTime()]));
  const newOffers = new Set(promosAll.filter((p) => p.live && isDiscount(p) && Date.now() - new Date(p.first_seen).getTime() < 7 * DAY
    && new Date(p.first_seen).getTime() - (firstScan.get(p.domain) ?? 0) > 36e5).map((p) => p.domain));
  const deepest = promosAll.filter((p) => p.live && isDiscount(p) && byDomainAll.has(p.domain)).sort((a, b) => maxPct(b) - maxPct(a))[0];
  const findings: { text: string; href: string }[] = [];
  if (mostOnSale) findings.push({ text: `${mostOnSale.i.name} has the most stores on sale right now: ${mostOnSale.st.onSale.text} of ${mostOnSale.xs.length}.`, href: `/promotions?industry=${mostOnSale.i.slug}` });
  if (cheapestShip) findings.push({ text: `${cheapestShip.i.name} has the lowest median free-shipping minimum, at ${cheapestShip.st.freeShipping.text}.`, href: `/benchmarks?industry=${cheapestShip.i.slug}#ship` });
  findings.push(newOffers.size
    ? { text: `${newOffers.size} ${newOffers.size === 1 ? "store has an offer" : "stores have offers"} we first saw in the last 7 days. With tracking this new, some may have been running before we started.`, href: "/promotions" }
    : deepest ? { text: `Deepest discount advertised right now: up to ${maxPct(deepest)}% at ${siteName(deepest.domain)}.`, href: `/sites/${deepest.domain}` }
    : { text: "No discounts are running at the moment.", href: "/promotions" });
  if (bnplSites.length) findings.push({ text: `Afterpay is the most common buy now, pay later option: ${Math.round((100 * afterpay) / bnplSites.length)}% of stores where we found one.`, href: "/payments/afterpay" });

  const overview = feedItems(all, promosAll, changes);
  const rank = (x: FeedItem) => (x.sig === "High" ? 2 : x.sig === "Medium" ? 1 : 0);
  const top = [...overview].sort((a, b) => rank(b) - rank(a) || (a.at < b.at ? 1 : -1)).slice(0, 6);
  const richest = (xs: Site[]) => [...xs].filter((s) => !notFeatured.has(s.domain)).sort((a, b) => Object.keys(b.facts).length - Object.keys(a.facts).length).slice(0, 3);
  const suggestions = [...groups].sort((a, b) => b.xs.length - a.xs.length).slice(0, 3)
    .map((g) => ({ name: g.i.name, sites: richest(g.xs).map(ref) })).filter((g) => g.sites.length >= 2);
  const fc = facets(all);
  const bnplRows: Bar[] = fc.payments.filter((x) => !["apple-pay", "google-pay", "paypal", "shop-pay"].includes(x.value))
    .map((x: any) => ({ label: x.name, n: x.n, text: `${x.n} of ${bnplSites.length}`, href: `/payments/${x.value}` }));
  const tools = fc.tech.filter((x) => !PLUMBING.has(techCategory(x.name))).slice(0, 8).map((x: any) => ({ value: x.value, name: x.name, n: x.n }));
  const complete = all.filter((s) => !notFeatured.has(s.domain) && coreCount(s) === 4).sort((a, b) => a.domain.localeCompare(b.domain));
  const start = (complete[new Date().getUTCDate() % Math.max(1, complete.length)] ?? all[0])?.domain; // a different full record each day
  const FAMOUS = ["lovisa.com.au", "koala.com", "adorebeauty.com.au", "princesspolly.com.au", "petcircle.com.au", "jbhifi.com.au"];
  const tryThese = FAMOUS.map((d) => byDomainAll.get(d)).filter((s): s is Site => !!s && s.domain !== start && coreCount(s) >= 2).slice(0, 3).map(ref);
  return {
    total: all.length, industries: new Set(all.map(industryOf)).size,
    onSale: { text: allStats.onSale.text, sub: allStats.onSale.sub }, afterpay, bnplN: bnplSites.length,
    fsMedian: thresholds.length ? money(median(thresholds))! : "—", fsN: thresholds.length,
    findings, top, anyConfirmed: changes.some((c) => c.confirmed), bnplRows, tools, suggestions,
    start: start ? cs.get(start)! : null, tryThese: tryThese.map((t) => cs.get(t.domain)!),
  };
}

function feed(all: Site[], promosAll: Promo[], changes: Change[], scope: string) {
  const items = feedItems(scoped(all, scope), promosAll, changes).sort((a, b) => (a.at < b.at ? 1 : -1));
  const stores = new Map(items.map((i) => [i.domain, i.site]));
  return { items: items.slice(0, FEED_MAX), total: items.length,
    stores: [...stores.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([domain, name]) => ({ domain, name })) };
}

// ---------- industries ----------
function industryPage(all: Site[], promosAll: Promo[], slug_: string) {
  const sites = all.filter((s) => industryOf(s) === slug_);
  const dom = new Set(sites.map((s) => s.domain));
  const live = promosAll.filter((p) => dom.has(p.domain) && p.live);
  const fs = sites.map((s) => num(s, "shipping.free_shipping_threshold")).filter((x): x is number => x !== undefined);
  const ret = sites.map((s) => num(s, "policies.returns.period_days")).filter((x): x is number => x !== undefined);
  const bnplSites = sites.filter((s) => list(s, "payments.bnpl_providers").length);
  const prov = new Map<string, number>();
  bnplSites.forEach((s) => list(s, "payments.bnpl_providers").forEach((p) => prov.set(p, (prov.get(p) || 0) + 1)));
  const best = new Map<string, Promo>();
  live.filter(isDiscount).forEach((p) => { const b = best.get(p.domain); if (!b || maxPct(p) > maxPct(b)) best.set(p.domain, p); });
  return {
    n: sites.length, latest: latestOf(sites), liveN: live.length, bestN: best.size,
    deals: [...best.values()].sort((a, b) => maxPct(b) - maxPct(a)).slice(0, 8).map((p) => ({ domain: p.domain, store: siteName(p.domain), name: p.name, discount: p.discount })),
    fs: fs.length ? money(median(fs))! : null, fsN: fs.length, ret: ret.length ? median(ret)! : null, retN: ret.length,
    bnplN: bnplSites.length, prov: [...prov.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => ({ label: label(p), n })),
  };
}

// ---------- payments, platforms, policies, tech ----------
function leadFor(all: Site[], test: (s: Site) => boolean) {
  return INDUSTRIES.map((i) => { const xs = filterSites(all, i.slug); return { i, p: pct(xs.filter(test).length, xs.length), n: xs.length }; })
    .filter((x) => x.n >= 5).sort((a, b) => b.p - a.p)[0];
}

function payments(all: Site[], changes: Change[], scope: string) {
  const industry = scope === "all" ? undefined : scope;
  const sites = scoped(all, scope);
  const byDomain = new Map(all.map((s) => [s.domain, s]));
  const bnpl = (s: Site) => list(s, "payments.bnpl_providers");
  const withBnpl = sites.filter((s) => bnpl(s).length);
  const options = facets(sites).payments || [];
  const combos = new Map<string, number>();
  withBnpl.forEach((s) => { const k = bnpl(s).map(label).sort().join(" + "); combos.set(k, (combos.get(k) || 0) + 1); });
  const dom = new Set(sites.map((s) => s.domain));
  const q = industry ? `?industry=${industry}` : "";
  const rows = options.map((o: any) => {
    const n = o.n as number, lead = leadFor(all, o.test);
    return { id: o.value, cells: {
      name: { text: o.name, sort: o.name, href: `/payments/${o.value}${q}` },
      n: { text: String(n), sort: n },
      share: { text: `${pct(n, sites.length)}%`, sort: pct(n, sites.length) },
      bnplShare: WALLETS.map(slug).includes(o.value)
        ? { text: "wallet", sort: null, muted: true }
        : { text: withBnpl.length ? `${pct(n, withBnpl.length)}%` : "–", sort: pct(n, withBnpl.length) },
      lead: { text: lead && !industry ? `${lead.i.name} (${lead.p}%)` : "–", sort: lead?.p ?? null, muted: !lead || !!industry },
    } };
  });
  return {
    n: sites.length, withBnpl: withBnpl.length,
    avg: withBnpl.length ? (withBnpl.reduce((a, s) => a + bnpl(s).length, 0) / withBnpl.length).toFixed(1) : "–",
    top: options[0] ? { name: options[0].name, n: (options[0] as any).n } : null, rows,
    options: options.map((o) => ({ name: o.name, value: o.value })),
    byInd: industry ? [] : INDUSTRIES.map((i) => { const xs = filterSites(all, i.slug); const b = xs.filter((s) => bnpl(s).length).length;
      return { label: i.name, n: pct(b, xs.length), text: `${pct(b, xs.length)}% · ${b} of ${xs.length}`, href: `/payments?industry=${i.slug}` }; })
      .filter((r) => !r.text.endsWith("of 0")),
    combos: [...combos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    changes: changes.filter((c) => c.key === "payments.bnpl_providers" && dom.has(c.domain)).slice(0, 12).map((c) => changeLine(c, byDomain)),
    represented: new Set(withBnpl.map(industryOf)).size,
  };
}

function facetIndex(all: Site[], kind: string, scope: string) {
  const industry = scope === "all" ? undefined : scope;
  const sites = scoped(all, scope);
  const options = facets(sites)[kind] || [];
  const q = industry ? `?industry=${industry}` : "";
  return {
    n: sites.length, options: options.map((o) => ({ name: o.name, value: o.value })),
    rows: options.map((o: any) => {
      const lead = leadFor(all, o.test);
      return { id: o.value, cells: {
        name: { text: o.name, sort: o.name, href: `${facetHref(kind, o.value)}${q}` },
        n: { text: String(o.n), sort: o.n },
        share: { text: `${pct(o.n, sites.length)}%`, sort: pct(o.n, sites.length) },
        lead: { text: lead && !industry ? `${lead.i.name} (${lead.p}%)` : "–", sort: lead?.p ?? null, muted: !lead || !!industry },
      } };
    }),
  };
}

/** One payment option, technology, platform or policy, across every industry; pages filter to one industry. */
function facetDetail(all: Site[], changes: Change[], f: any) {
  const byDomain = new Map(all.map((s) => [s.domain, s]));
  const counts: Record<string, { m: number; n: number }> = { all: { m: all.filter(f.test).length, n: all.length } };
  for (const i of INDUSTRIES) { const xs = filterSites(all, i.slug); counts[i.slug] = { m: xs.filter(f.test).length, n: xs.length }; }
  const value = f.value as string, kind = f.kind as string;
  const ch = changes.filter((c) => {
    if (kind === "payments") return c.key === "payments.bnpl_providers" && JSON.stringify([c.from, c.to]).toLowerCase().includes(value.replace(/-/g, "_"));
    if (kind === "tech") return c.key === "tech_stack.technologies" && JSON.stringify([c.from, c.to]).toLowerCase().includes(String(f.name).toLowerCase());
    return false;
  });
  const prospects = kind === "payments" ? all.filter((s) => !f.test(s) && list(s, "payments.bnpl_providers").length >= 2)
    .sort((a, b) => siteName(a).localeCompare(siteName(b))).map((s) => ({ ...ref(s), i: industryOf(s) })) : [];
  return { kind, value, name: f.name, cat: kind === "tech" ? techCategory(f.name) : null, counts,
    changes: ch.slice(0, 200).map((c) => changeLine(c, byDomain)), prospects };
}

function tech(all: Site[], changesAll: Change[], scope: string) {
  const industry = scope === "all" ? undefined : scope;
  const sites = scoped(all, scope), n = sites.length;
  const byDomain = new Map(all.map((s) => [s.domain, s]));
  const tools = facets(sites).tech as any[];
  const groups = new Map<string, any[]>();
  tools.forEach((t) => { const c = techCategory(t.name); groups.set(c, [...(groups.get(c) || []), t]); });
  const plat = new Map<string, number>();
  sites.forEach((s) => { const p = val(s, "tech_stack.platform"); const k = typeof p === "string" ? p : "Not detected"; plat.set(k, (plat.get(k) || 0) + 1); });
  const dom = new Set(sites.map((s) => s.domain));
  const changes = changesAll.filter((c) => c.confirmed && dom.has(c.domain) && (c.key === "tech_stack.technologies" || c.key === "tech_stack.platform"));
  const lead = (name: string) => {
    if (industry) return null;
    let best: { ind: string; pct: number } | null = null;
    for (const i of INDUSTRIES) {
      const xs = filterSites(all, i.slug);
      if (xs.length < 5) continue;
      const p = pct(xs.filter((s) => ((val(s, "tech_stack.technologies") as string[]) || []).includes(name)).length, xs.length);
      if (!best || p > best.pct) best = { ind: i.name, pct: p };
    }
    return best && best.pct > 0 ? best : null;
  };
  return {
    n, toolsN: tools.length,
    perSite: n ? (sites.reduce((a, s) => a + ((val(s, "tech_stack.technologies") as string[] | undefined)?.length || 0), 0) / n).toFixed(1) : "—",
    cats: TECH_ORDER.filter((c) => groups.has(c)).map((cat) => ({ cat, tools: groups.get(cat)!.map((t) => ({ value: t.value, name: t.name, n: t.n, lead: lead(t.name) })) })),
    plat: [...plat.entries()].sort((a, b) => b[1] - a[1]),
    changesN: changes.length, changes: changes.slice(0, 10).map((c) => changeLine(c, byDomain)),
  };
}

// ---------- benchmarks ----------
function benchmarks(all: Site[], scope: string) {
  const industry = scope === "all" ? undefined : scope;
  const sites = scoped(all, scope);
  const groups = INDUSTRIES.map((i) => ({ i, xs: filterSites(all, i.slug) })).filter((g) => g.xs.length);
  const series = (xs: Site[], key: string) => xs.map((s) => [s, num(s, key)] as const).filter(([, n]) => n !== undefined).sort((a, b) => a[1]! - b[1]!) as [Site, number][];
  const numeric = (id: string, key: string, fmt: (n: number) => string, color?: string, lowIsGood = true) => {
    const s = series(sites, key), m = median(s.map((x) => x[1]));
    const rows: Bar[] = industry
      ? s.map(([x, n]) => ({ label: siteName(x), n, text: fmt(n), href: `/sites/${x.domain}`, color: !color && m !== undefined ? ((lowIsGood ? n <= m : n >= m) ? "var(--accent)" : "var(--accent-light)") : undefined }))
      : groups.map(({ i, xs }) => {
          const v = series(xs, key), md = median(v.map((x) => x[1]));
          const ok = v.length / xs.length >= COVERAGE && md !== undefined;
          return { label: i.name, n: ok ? md! : 0, text: ok ? `${fmt(md!)} · ${v.length} of ${xs.length}` : `Not enough data · ${v.length} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#${id}` };
        });
    return { count: s.length, median: s.length ? fmt(m!) : null,
      low: s.length ? { v: fmt(s[0][1]), name: siteName(s[0][0]) } : null,
      high: s.length ? { v: fmt(s[s.length - 1][1]), name: siteName(s[s.length - 1][0]) } : null, rows };
  };
  const ret = series(sites, "policies.returns.period_days");
  const buckets = new Map<number, number>(); ret.forEach(([, n]) => buckets.set(n, (buckets.get(n) || 0) + 1));
  const bnplSites = sites.filter((s) => list(s, "payments.bnpl_providers").length);
  const fc = facets(sites);
  const loyal = (xs: Site[]) => xs.filter((s) => typeof val(s, "loyalty.program") === "string");
  return {
    n: sites.length, latest: latestOf(sites),
    ship: numeric("ship", "shipping.free_shipping_threshold", (n) => money(n)!),
    fee: numeric("fee", "shipping.standard_shipping_cost", (n) => money(n)!, "var(--blue)"),
    ret: {
      count: ret.length, buckets: [...buckets.entries()].sort((a, b) => b[0] - a[0]),
      names: industry ? Object.fromEntries([...buckets.keys()].map((d) => [d, ret.filter(([, n]) => n === d).map(([s]) => siteName(s)).join(", ")])) : {},
      byInd: industry ? [] : groups.map(({ i, xs }) => {
        const v = series(xs, "policies.returns.period_days"), md = median(v.map((x) => x[1]));
        const ok = v.length / xs.length >= COVERAGE && md !== undefined;
        return { label: i.name, n: ok ? md! : 0, text: ok ? `${md} days · ${v.length} of ${xs.length}` : `Not enough data · ${v.length} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#ret` };
      }),
    },
    pay: {
      count: bnplSites.length,
      rows: fc.payments.filter((x) => !["apple-pay", "google-pay", "paypal", "shop-pay"].includes(x.value))
        .map((x: any) => ({ label: x.name, n: x.n, text: `${pct(x.n, bnplSites.length)}%`, href: `/payments/${x.value}${industry ? `?industry=${industry}` : ""}` })),
      avg: bnplSites.length ? (bnplSites.reduce((a, s) => a + list(s, "payments.bnpl_providers").length, 0) / bnplSites.length).toFixed(1) : "—",
      byInd: industry ? [] : groups.map(({ i, xs }) => { const b = xs.filter((s) => list(s, "payments.bnpl_providers").length).length;
        return { label: i.name, n: pct(b, xs.length), text: `${pct(b, xs.length)}% · ${b} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#pay` }; }),
    },
    loy: {
      count: loyal(sites).length,
      tags: industry ? loyal(sites).map((s) => ({ domain: s.domain, program: String(val(s, "loyalty.program")), name: siteName(s) })) : [],
      byInd: industry ? [] : groups.map(({ i, xs }) => ({ label: i.name, n: pct(loyal(xs).length, xs.length), text: `${pct(loyal(xs).length, xs.length)}% · ${loyal(xs).length} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#loy` })),
    },
    tools: (fc.tech as any[]).filter((t) => !PLUMBING.has(techCategory(t.name))).slice(0, 9).map((t) => ({ value: t.value, name: t.name, pct: pct(t.n, sites.length) })),
  };
}

// ---------- sites list filters ----------
function filterOptions(all: Site[], promosAll: Promo[], scope: string) {
  const sites = scoped(all, scope);
  const fc = facets(sites);
  const has = (s: Site, p: string) => list(s, "payments.bnpl_providers").includes(p);
  const promos = promotionsFor(promosAll, sites);
  const out: Record<string, any> = {};
  for (const k of ["payments", "tech", "platform", "policy"]) out[k] = (fc[k] || []).map((x: any) => ({ value: x.value, name: x.name, n: x.n }));
  out.azNoHumm = sites.filter((s) => has(s, "afterpay") && has(s, "zip") && !has(s, "humm")).length;
  out.bf = new Set(promos.filter((p) => p.live && /black friday|cyber/i.test(`${p.name} ${p.discount}`)).map((p) => p.domain)).size;
  return out;
}

/** Everything the builder publishes: the per-store index and one view per page (and filter). */
export function buildAll(all: Site[], promos: Promo[], changes365: Change[], notFeatured: Set<string>) {
  const index = buildIndex(all, promos, notFeatured);
  const cs = new Map(index.map((x) => [x.domain, x.card]));
  const cut60 = Date.now() - 60 * DAY;
  const changes60 = changes365.filter((c) => new Date(c.at).getTime() > cut60);
  const views: Record<string, unknown> = {};
  const ind: Record<string, number> = {};
  all.forEach((s) => (ind[industryOf(s)] = (ind[industryOf(s)] || 0) + 1));
  views.counts = { all: all.length, ind, industries: Object.keys(ind).length, latest: latestOf(all) };
  views.medians = Object.fromEntries(INDUSTRIES.map((i) => {
    const xs = filterSites(all, i.slug);
    const m = (key: string) => median(xs.map((x) => num(x, key)).filter((n): n is number => n !== undefined)) ?? null;
    return [i.slug, { "shipping.free_shipping_threshold": m("shipping.free_shipping_threshold"), "shipping.standard_shipping_cost": m("shipping.standard_shipping_cost"),
      "policies.returns.period_days": m("policies.returns.period_days") }];
  }));
  views.home = home(all, promos, changes60, cs, notFeatured);
  views.industries = { all: groupStats(all, promos), ind: Object.fromEntries(INDUSTRIES.map((i) => [i.slug, groupStats(filterSites(all, i.slug), promos)])) };
  for (const i of INDUSTRIES) views[`industry:${i.slug}`] = industryPage(all, promos, i.slug);
  for (const sc of SCOPES) {
    views[`feed:${sc}`] = feed(all, promos, changes60, sc);
    views[`payments:${sc}`] = payments(all, changes365, sc);
    views[`tech:${sc}`] = tech(all, changes365, sc);
    views[`benchmarks:${sc}`] = benchmarks(all, sc);
    views[`platform:${sc}`] = facetIndex(all, "platform", sc);
    views[`policy:${sc}`] = facetIndex(all, "policy", sc);
    views[`filters:${sc}`] = filterOptions(all, promos, sc);
  }
  const fc = facets(all);
  views.facets = Object.entries(fc).filter(([k]) => k !== "segment").flatMap(([kind, xs]) => xs.map((x: any) => ({ kind, value: x.value, name: x.name, n: x.n })));
  for (const kind of ["payments", "tech", "platform", "policy"]) for (const f of fc[kind] || []) views[`facet:${kind}:${f.value}`] = facetDetail(all, changes365, f);
  views.compare = {
    suggestions: INDUSTRIES.map((i) => ({ name: i.name, sites: filterSites(all, i.slug).filter((x) => !notFeatured.has(x.domain))
      .sort((a, b) => Object.keys(b.facts).length - Object.keys(a.facts).length).slice(0, 3).map(ref) })).filter((g) => g.sites.length >= 2),
  };
  return { index, views };
}
