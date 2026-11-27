import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import { Bars, JsonLd } from "@/components/ui";
import { filterSites, getSites, Site } from "@/lib/data";
import { dateAU, facets, list, median, money, num, siteName, val } from "@/lib/format";
import { INDUSTRIES, industryName } from "@/lib/industries";
import { COVERAGE } from "@/lib/stats";
import { PLUMBING, techCategory } from "@/lib/tech";
import { SITE_URL } from "@/lib/site";
import { BRAND } from "@/lib/brand";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Australian ecommerce benchmarks: shipping, returns, BNPL, loyalty, by industry",
  description: "How Australian online stores compare on free-shipping thresholds, delivery fees, returns windows, buy now pay later, loyalty programmes and tools, industry by industry. Updated weekly.",
  alternates: { canonical: "/benchmarks" },
};

const COLORS = ["#0E6B62", "#8FC9C0", "#2F5FA7", "#9DB6DC", "#B9B5A8"];

export default async function Benchmarks({ searchParams }: { searchParams: Promise<{ industry?: string; segment?: string }> }) {
  const { industry, segment } = await searchParams;
  const all = await getSites();
  const sites = filterSites(all, industry, segment);
  const groups = INDUSTRIES.map((i) => ({ i, xs: filterSites(all, i.slug) })).filter((g) => g.xs.length);
  const series = (xs: Site[], key: string) => xs.map((s) => [s, num(s, key)] as const).filter(([, n]) => n !== undefined).sort((a, b) => a[1]! - b[1]!) as [Site, number][];
  const latest = sites.reduce((a, s) => (s.last_scanned_at > a ? s.last_scanned_at : a), "");
  const big = (v: string, k: string) => <div><div className="display" style={{ fontSize: 30, fontWeight: 600 }}>{v}</div><div className="tiny muted">{k}</div></div>;
  const pct = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));
  const scope = industry ? industryName(industry).toLowerCase() + " stores" : "stores";

  /** A numeric fact: overall median, then one bar per industry (all industries) or per store (one industry). */
  const numeric = (id: string, title: string, key: string, fmt: (n: number) => string, color?: string, lowIsGood = true) => {
    const s = series(sites, key), m = median(s.map((x) => x[1]));
    const rows = industry
      ? s.map(([x, n]) => ({ label: siteName(x), n, text: fmt(n), href: `/sites/${x.domain}`, color: !color && m !== undefined ? ((lowIsGood ? n <= m : n >= m) ? "var(--accent)" : "var(--accent-light)") : undefined }))
      : groups.map(({ i, xs }) => {
          const v = series(xs, key), md = median(v.map((x) => x[1]));
          const ok = v.length / xs.length >= COVERAGE && md !== undefined;
          return { label: i.name, n: ok ? md! : 0, text: ok ? `${fmt(md!)} · ${v.length} of ${xs.length}` : `Not enough data · ${v.length} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#${id}` };
        });
    return (
      <section id={id} className="card">
        <div className="row" style={{ justifyContent: "space-between" }}><h2>{title}</h2><span className="small muted">{s.length} of {sites.length} {scope} state it</span></div>
        {s.length ? <>
          <div className="row" style={{ gap: 28, margin: "12px 0 16px" }}>{big(fmt(m!), "median")}{big(fmt(s[0][1]), `lowest (${siteName(s[0][0])})`)}{big(fmt(s[s.length - 1][1]), `highest (${siteName(s[s.length - 1][0])})`)}</div>
          <Bars rows={rows} color={color} />
          <div className="tiny muted" style={{ marginTop: 10 }}>{industry ? "Each bar is one store." : `Each bar is an industry's median; it's shown when at least ${Math.round(COVERAGE * 100)}% of its stores state the value. Click one for its stores.`}</div>
        </> : <p className="muted small">No data yet.</p>}
      </section>
    );
  };

  const ret = series(sites, "policies.returns.period_days");
  const buckets = new Map<number, number>(); ret.forEach(([, n]) => buckets.set(n, (buckets.get(n) || 0) + 1));
  const bnplSites = sites.filter((s) => list(s, "payments.bnpl_providers").length);
  const fc = facets(sites);
  const bnpl = fc.payments.filter((x) => !["apple-pay", "google-pay", "paypal", "shop-pay"].includes(x.value));
  const avgProviders = bnplSites.length ? (bnplSites.reduce((a, s) => a + list(s, "payments.bnpl_providers").length, 0) / bnplSites.length).toFixed(1) : "—";
  const loyal = (xs: Site[]) => xs.filter((s) => typeof val(s, "loyalty.program") === "string");
  const tools = (fc.tech as any[]).filter((t) => !PLUMBING.has(techCategory(t.name))).slice(0, 9);

  return (
    <>
      <Header active="/benchmarks" />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Dataset", name: `Australian ecommerce benchmarks${industry ? `: ${industryName(industry)}` : ""}`,
        description: "Free-shipping thresholds, delivery fees, returns windows, buy now pay later adoption and loyalty programmes across Australian online stores, by industry.",
        url: `${SITE_URL}/benchmarks`, spatialCoverage: "Australia", dateModified: latest, creator: { "@type": "Organization", name: `${BRAND}` } }} />
      <main className="wrap page">
        <div className="eyebrow">Benchmarks{industry ? ` · ${industryName(industry)}` : " · All industries"}</div>
        <h1 className="title">How Australian {scope} compare</h1>
        <p className="small muted" style={{ margin: "8px 0 0" }}>{sites.length} stores · facts seen {latest ? dateAU(latest) : "—"} · trends appear after four weekly scans</p>
        <IndustryFilter path="/benchmarks" sites={all} industry={industry} segment={segment} />
        <nav className="tabs" style={{ marginTop: 24 }}><a className="on" href="#ship">Shipping</a><a href="#ret">Returns</a><a href="#pay">Payments</a><a href="#loy">Loyalty</a><a href="#tech">Tech</a><Link href={`/promotions${industry ? `?industry=${industry}` : ""}`}>Promotions</Link></nav>

        <div className="grid g2" style={{ marginTop: 24 }}>
          {numeric("ship", "Free-shipping threshold", "shipping.free_shipping_threshold", (n) => money(n)!)}
          {numeric("fee", "Standard delivery fee", "shipping.standard_shipping_cost", (n) => money(n)!, "var(--blue)")}

          <section id="ret" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Returns window</h2><span className="small muted">{ret.length} of {sites.length} state it</span></div>
            <div style={{ display: "flex", height: 40, borderRadius: 8, overflow: "hidden", marginTop: 16, fontSize: 13, fontWeight: 600 }}>
              {[...buckets.entries()].sort((a, b) => b[0] - a[0]).map(([d, n], i) => (
                <span key={d} style={{ flex: `${n} 1 0`, background: COLORS[i % COLORS.length], color: i % 2 ? "#0A2E2A" : "#fff", display: "flex", alignItems: "center", paddingLeft: 10, whiteSpace: "nowrap", overflow: "hidden" }}>{d} days · {n}</span>
              ))}
            </div>
            {industry ? (
              <div className="small" style={{ marginTop: 14, lineHeight: 1.6, color: "var(--body)" }}>
                {[...buckets.keys()].sort((a, b) => b - a).map((d) => <div key={d}><strong>{d} days:</strong> {ret.filter(([, n]) => n === d).map(([s]) => siteName(s)).join(", ")}</div>)}
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <Bars color="var(--blue)" rows={groups.map(({ i, xs }) => {
                  const v = series(xs, "policies.returns.period_days"), md = median(v.map((x) => x[1]));
                  const ok = v.length / xs.length >= COVERAGE && md !== undefined;
                  return { label: i.name, n: ok ? md! : 0, text: ok ? `${md} days · ${v.length} of ${xs.length}` : `Not enough data · ${v.length} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#ret` };
                })} />
                <div className="tiny muted" style={{ marginTop: 10 }}>Median returns window by industry.</div>
              </div>
            )}
          </section>

          <section id="pay" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Buy now, pay later</h2><span className="small muted">{bnplSites.length} of {sites.length} offer it</span></div>
            <div style={{ marginTop: 14 }}>
              <Bars color="var(--blue)" max={bnplSites.length} rows={bnpl.map((x: any) => ({ label: x.name, n: x.n, text: `${pct(x.n, bnplSites.length)}%`, href: `/explore/payments/${x.value}${industry ? `?industry=${industry}` : ""}` }))} />
            </div>
            <p className="small muted" style={{ margin: "6px 0 0" }}>Share of stores with BNPL that offer each provider. Average: {avgProviders} providers per store.</p>
            {!industry && <div style={{ marginTop: 14 }}><Bars rows={groups.map(({ i, xs }) => { const b = xs.filter((s) => list(s, "payments.bnpl_providers").length).length; return { label: i.name, n: pct(b, xs.length), text: `${pct(b, xs.length)}% · ${b} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#pay` }; })} max={100} /><div className="tiny muted" style={{ marginTop: 6 }}>Share of each industry's stores offering any BNPL.</div></div>}
          </section>

          <section id="loy" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Loyalty programmes</h2><span className="small muted">{sites.length} stores</span></div>
            <div className="display" style={{ fontSize: 30, fontWeight: 600, marginTop: 12 }}>{loyal(sites).length} of {sites.length} <span style={{ fontSize: 16, color: "var(--muted)", fontWeight: 500 }}>have one ({pct(loyal(sites).length, sites.length)}%)</span></div>
            {industry ? (
              <div className="row" style={{ gap: 6, marginTop: 12, fontSize: 13 }}>
                {loyal(sites).map((s) => <Link key={s.domain} href={`/sites/${s.domain}`} className="tag">{val(s, "loyalty.program")} ({siteName(s)})</Link>)}
              </div>
            ) : (
              <div style={{ marginTop: 14 }}><Bars max={100} rows={groups.map(({ i, xs }) => ({ label: i.name, n: pct(loyal(xs).length, xs.length), text: `${pct(loyal(xs).length, xs.length)}% · ${loyal(xs).length} of ${xs.length}`, href: `/benchmarks?industry=${i.slug}#loy` }))} /></div>
            )}
          </section>

          <section id="tech" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Tools in use</h2><Link href={`/tech${industry ? `?industry=${industry}` : ""}`} className="small" style={{ fontWeight: 600 }}>All tools →</Link></div>
            <div className="grid g3" style={{ gap: 12, marginTop: 14 }}>
              {tools.map((t: any) => (
                <Link key={t.value} href={`/tech/${t.value}${industry ? `?industry=${industry}` : ""}`} style={{ border: "1px solid var(--line2)", borderRadius: 10, padding: 12, color: "var(--ink)" }}>
                  <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>{pct(t.n, sites.length)}%</div>
                  <div className="small muted">{t.name}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
