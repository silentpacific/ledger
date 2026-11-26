import Link from "next/link";
import Header from "@/components/Header";
import { Bars, Stat } from "@/components/ui";
import { getChanges, getJewellery as getSites, getJewelleryPromotions as getPromotions, Promo } from "@/lib/data";
import { dateAU, dayKey, describeChange, facets, list, maxPct, median, num, siteName, slug, isDiscount } from "@/lib/format";

export const revalidate = 3600;

type Item = { at: string; tag: string; site: string; domain: string; text: string; meta: string; sig: string };

export default async function Home({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "all" } = await searchParams;
  const [sites, promos, changes] = await Promise.all([getSites(), getPromotions(), getChanges(60)]);
  const byDomain = new Map(sites.map((s) => [s.domain, s]));

  const thresholds = sites.map((s) => num(s, "shipping.free_shipping_threshold")).filter((x): x is number => x !== undefined);
  const bnplSites = sites.filter((s) => list(s, "payments.bnpl_providers").length);
  const afterpay = bnplSites.filter((s) => list(s, "payments.bnpl_providers").includes("afterpay")).length;
  const latest = sites.reduce((a, s) => (s.last_scanned_at > a ? s.last_scanned_at : a), "");

  // feed: confirmed fact changes, plus promotions seen this past week
  const weekAgo = Date.now() - 7 * 864e5;
  const items: Item[] = [];
  for (const c of changes.filter((c) => c.confirmed)) {
    if (!byDomain.has(c.domain)) continue;
    const d = describeChange(c);
    const cat = c.category.replace(/_/g, " ");
    items.push({ at: c.at, tag: cat.charAt(0).toUpperCase() + cat.slice(1), site: siteName(c.domain), domain: c.domain, text: d.text, meta: "Confirmed on the next scan", sig: d.significance });
  }
  const livePromos = promos.filter((p) => p.live && isDiscount(p) && new Date(p.last_seen).getTime() > weekAgo && byDomain.has(p.domain));
  const best = new Map<string, Promo>();
  livePromos.forEach((p) => { const b = best.get(p.domain); if (!b || maxPct(p) > maxPct(b)) best.set(p.domain, p); });
  for (const p of [...best.values()].sort((a, b) => maxPct(b) - maxPct(a))) {
    const site = byDomain.get(p.domain)!;
    const isNew = new Date(p.first_seen).getTime() - new Date(site.first_scanned_at).getTime() > 36e5;
    items.push({ at: p.first_seen, tag: "Promotion", site: siteName(p.domain), domain: p.domain,
      text: `${isNew ? "started" : "is running"} ${p.name}${p.discount && !p.name.toLowerCase().includes(p.discount.toLowerCase().slice(0, 12)) ? `: ${p.discount}` : ""}`,
      meta: `Seen ${dateAU(p.last_seen, { day: "numeric", month: "short" })}${p.ends ? ` · ends ${dateAU(p.ends, { day: "numeric", month: "short" })}` : ""}`,
      sig: maxPct(p) >= 30 ? "High" : "Medium" });
  }
  const shown = items.filter((i) => f === "all" || i.tag.toLowerCase().startsWith(f));
  const groups = new Map<string, Item[]>();
  shown.sort((a, b) => (a.at < b.at ? 1 : -1)).forEach((i) => { const k = dayKey(i.at); groups.set(k, [...(groups.get(k) || []), i]); });

  const bfBest = new Map<string, Promo>();
  promos.filter((p) => p.live && /black friday|cyber/i.test(`${p.name} ${p.discount}`) && maxPct(p) > 0)
    .forEach((p) => { const b = bfBest.get(p.domain); if (!b || maxPct(p) > maxPct(b)) bfBest.set(p.domain, p); });
  const bf = [...bfBest.values()].sort((a, b) => maxPct(b) - maxPct(a)).slice(0, 6);
  const fc = facets(sites);
  const bnplRows = fc.payments.filter((x) => !["apple-pay", "google-pay", "paypal", "shop-pay"].includes(x.value))
    .map((x: any) => ({ label: x.name, n: x.n, href: `/explore/payments/${x.value}` }));
  const tools = fc.tech.filter((x) => !["shopify", "woocommerce", "wordpress", "google-tag-manager"].includes(x.value)).slice(0, 8);
  const FILTERS = [["all", "All"], ["promotion", "Promotions"], ["shipping", "Shipping"], ["payments", "Payments"], ["policies", "Policies"], ["tech", "Tech"]];

  return (
    <>
      <Header active="/" />
      <main className="wrap page">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow">Australian jewellery ecommerce</div>
            <h1 className="title">This week</h1>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Last scan {latest ? dateAU(latest, { weekday: "short", day: "numeric", month: "short" }) : "—"} · weekly scans every Monday</p>
        </div>

        <div className="grid g4" style={{ marginTop: 28 }}>
          <Stat k="Sites tracked" v={sites.length} sub="Australian jewellery stores" />
          <Stat k="Promotions recorded" v={promos.length} sub="live now and past, with dates" />
          <Stat k="Offer Afterpay" v={`${afterpay} of ${bnplSites.length}`} sub="sites where a BNPL option was found" />
          <Stat k="Median free-shipping threshold" v={thresholds.length ? `$${median(thresholds)}` : "—"} sub={thresholds.length ? `range $${Math.min(...thresholds)} – $${Math.max(...thresholds)} · ${thresholds.length} sites` : ""} />
        </div>

        <div className="split" style={{ marginTop: 40 }}>
          <section className="main" aria-labelledby="feed-h">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 id="feed-h" style={{ margin: 0, fontSize: 24 }}>What changed</h2>
              <div className="row" style={{ gap: 8 }}>
                {FILTERS.map(([k, t]) => <Link key={k} href={k === "all" ? "/" : `/?f=${k}`} className={`chip${f === k ? " on" : ""}`}>{t}</Link>)}
              </div>
            </div>
            {groups.size === 0 && <div className="empty" style={{ marginTop: 20 }}>Nothing in this category yet. Changes appear here once a later scan confirms them.</div>}
            {[...groups.entries()].map(([day, list_]) => (
              <div key={day}>
                <div className="small muted" style={{ fontWeight: 600, margin: "24px 0 10px", textTransform: "uppercase" }}>{dateAU(day + "T12:00:00", { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="card" style={{ padding: 0 }}>
                  {list_.map((i, n) => (
                    <div key={n} className="feed-item">
                      <span className="tag">{i.tag}</span>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={{ fontSize: 15 }}><Link href={`/sites/${i.domain}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{i.site}</Link> {i.text}</div>
                        <div className="small muted" style={{ marginTop: 4 }}>{i.meta}</div>
                      </div>
                      <span className="tiny" style={{ fontWeight: 600, color: i.sig === "High" ? "var(--amber)" : "var(--muted)" }}>{i.sig}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!changes.some((c) => c.confirmed) && (
              <p className="small muted" style={{ marginTop: 14 }}>Policy, price and payment changes appear here once a later weekly scan confirms them. Tracking began on 26 November 2026.</p>
            )}
          </section>

          <aside className="side" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {bf.length > 0 && (
              <section className="card">
                <h2>Black Friday tracker</h2>
                <div className="small muted" style={{ margin: "4px 0 14px" }}>Deepest advertised discount, live now</div>
                <Bars max={Math.max(...bf.map(maxPct))} rows={bf.map((p) => ({ label: siteName(p.domain), n: maxPct(p), text: `${maxPct(p)}%`, href: `/sites/${p.domain}` }))} />
                <Link href="/promotions" className="small" style={{ fontWeight: 600 }}>Open the promotions calendar →</Link>
              </section>
            )}
            <section className="card">
              <h2>Buy now, pay later</h2>
              <div className="small muted" style={{ margin: "4px 0 14px" }}>Sites offering each provider (of {bnplSites.length})</div>
              <Bars rows={bnplRows} max={bnplSites.length} color="var(--blue)" />
            </section>
            <section className="card">
              <h2 style={{ marginBottom: 12 }}>Most-used tools (of {sites.length} sites)</h2>
              <div className="grid g2" style={{ gap: 10, fontSize: 14 }}>
                {tools.map((t: any) => <Link key={t.value} href={`/explore/tech/${t.value}`}>{t.name} · {t.n}</Link>)}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
