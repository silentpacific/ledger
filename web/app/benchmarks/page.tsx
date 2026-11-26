import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Bars, JsonLd } from "@/components/ui";
import { getJewellery as getSites } from "@/lib/data";
import { dateAU, facets, list, median, money, num, siteName, val } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Australian jewellery ecommerce benchmarks: shipping, returns, BNPL, loyalty",
  description: "How Australian online jewellery stores compare on free-shipping thresholds, delivery fees, returns windows, buy now pay later, loyalty programmes and tools. Updated weekly.",
  alternates: { canonical: "/benchmarks" },
};

export default async function Benchmarks({ searchParams }: { searchParams: Promise<{ segment?: string }> }) {
  const { segment } = await searchParams;
  const all = await getSites();
  const sites = segment ? all.filter((s) => s.segment === segment) : all;
  const segs = [...new Set(all.map((s) => s.segment).filter(Boolean))].sort() as string[];
  const series = (key: string) => sites.map((s) => [s, num(s, key)] as const).filter(([, n]) => n !== undefined).sort((a, b) => a[1]! - b[1]!) as [any, number][];
  const fs = series("shipping.free_shipping_threshold"), fee = series("shipping.standard_shipping_cost");
  const fsMed = median(fs.map((x) => x[1])), feeMed = median(fee.map((x) => x[1]));
  const ret = series("policies.returns.period_days");
  const buckets = new Map<number, number>(); ret.forEach(([, n]) => buckets.set(n, (buckets.get(n) || 0) + 1));
  const bnplSites = sites.filter((s) => list(s, "payments.bnpl_providers").length);
  const fc = facets(sites);
  const bnpl = fc.payments.filter((x) => !["apple-pay", "google-pay", "paypal", "shop-pay"].includes(x.value));
  const avgProviders = bnplSites.length ? (bnplSites.reduce((a, s) => a + list(s, "payments.bnpl_providers").length, 0) / bnplSites.length).toFixed(1) : "—";
  const loyal = sites.filter((s) => typeof val(s, "loyalty.program") === "string");
  const tools = fc.tech.filter((x) => !["shopify", "woocommerce", "wordpress"].includes(x.value)).slice(0, 9);
  const latest = sites.reduce((a, s) => (s.last_scanned_at > a ? s.last_scanned_at : a), "");
  const big = (v: string, k: string) => <div><div className="display" style={{ fontSize: 30, fontWeight: 600 }}>{v}</div><div className="tiny muted">{k}</div></div>;
  const COLORS = ["#0E6B62", "#8FC9C0", "#2F5FA7", "#9DB6DC", "#B9B5A8"];

  return (
    <>
      <Header active="/benchmarks" />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Dataset", name: "Australian jewellery ecommerce benchmarks",
        description: "Free-shipping thresholds, delivery fees, returns windows, buy now pay later adoption and loyalty programmes across Australian online jewellery stores.",
        url: `${SITE_URL}/benchmarks`, spatialCoverage: "Australia", dateModified: latest, creator: { "@type": "Organization", name: "Ledger" } }} />
      <main className="wrap page">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow">Benchmarks · Jewellery</div>
            <h1 className="title">How Australian jewellery stores compare</h1>
            <p className="small muted" style={{ margin: "8px 0 0" }}>{sites.length} sites · facts seen {latest ? dateAU(latest) : "—"} · trends appear after four weekly scans</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/benchmarks" className={`chip${!segment ? " on" : ""}`}>All segments</Link>
            {segs.map((g) => <Link key={g} href={`/benchmarks?segment=${encodeURIComponent(g)}`} className={`chip${segment === g ? " on" : ""}`}>{g}</Link>)}
          </div>
        </div>
        <nav className="tabs" style={{ marginTop: 24 }}><a className="on" href="#ship">Shipping</a><a href="#ret">Returns</a><a href="#pay">Payments</a><a href="#loy">Loyalty</a><a href="#tech">Tech</a><Link href="/promotions">Promotions</Link></nav>

        <div className="grid g2" style={{ marginTop: 24 }}>
          <section id="ship" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Free-shipping threshold</h2><span className="small muted">{fs.length} sites</span></div>
            {fs.length ? <>
              <div className="row" style={{ gap: 28, margin: "12px 0 16px" }}>{big(money(fsMed)!, "median")}{big(money(fs[0][1])!, `lowest (${siteName(fs[0][0])})`)}{big(money(fs[fs.length - 1][1])!, "highest")}</div>
              <Bars rows={fs.map(([s, n]) => ({ label: siteName(s), n, text: money(n)!, href: `/sites/${s.domain}`, color: n <= fsMed! ? "var(--accent)" : "var(--accent-light)" }))} />
              <div className="tiny muted" style={{ marginTop: 10 }}>Darker bars: at or below the median. {sites.length - fs.length} sites don't state a threshold.</div>
            </> : <p className="muted small">No data for this segment.</p>}
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Standard delivery fee</h2><span className="small muted">{fee.length} sites</span></div>
            {fee.length ? <>
              <div className="row" style={{ gap: 28, margin: "12px 0 16px" }}>{big(money(feeMed)!, "median")}{big(money(fee[0][1])!, `lowest (${siteName(fee[0][0])})`)}{big(money(fee[fee.length - 1][1])!, `highest (${siteName(fee[fee.length - 1][0])})`)}</div>
              <Bars color="var(--blue)" rows={fee.map(([s, n]) => ({ label: siteName(s), n, text: money(n)!, href: `/sites/${s.domain}` }))} />
            </> : <p className="muted small">No data for this segment.</p>}
          </section>

          <section id="ret" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Returns window</h2><span className="small muted">{ret.length} sites</span></div>
            <div style={{ display: "flex", height: 40, borderRadius: 8, overflow: "hidden", marginTop: 16, fontSize: 13, fontWeight: 600 }}>
              {[...buckets.entries()].sort((a, b) => b[0] - a[0]).map(([d, n], i) => (
                <span key={d} style={{ flex: `${n} 1 0`, background: COLORS[i % COLORS.length], color: i % 2 ? "#0A2E2A" : "#fff", display: "flex", alignItems: "center", paddingLeft: 10, whiteSpace: "nowrap", overflow: "hidden" }}>{d} days · {n}</span>
              ))}
            </div>
            <div className="small" style={{ marginTop: 14, lineHeight: 1.6, color: "var(--body)" }}>
              {[...buckets.keys()].sort((a, b) => b - a).map((d) => <div key={d}><strong>{d} days:</strong> {ret.filter(([, n]) => n === d).map(([s]) => siteName(s)).join(", ")}</div>)}
            </div>
          </section>

          <section id="pay" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Buy now, pay later</h2><span className="small muted">{bnplSites.length} sites with BNPL</span></div>
            <div style={{ marginTop: 14 }}>
              <Bars color="var(--blue)" max={bnplSites.length} rows={bnpl.map((x: any) => ({ label: x.name, n: x.n, text: `${Math.round((x.n / Math.max(1, bnplSites.length)) * 100)}%`, href: `/explore/payments/${x.value}` }))} />
            </div>
            <p className="small muted" style={{ margin: "6px 0 0" }}>Average: {avgProviders} providers per site.</p>
          </section>

          <section id="loy" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Loyalty programmes</h2><span className="small muted">{sites.length} sites</span></div>
            <div className="display" style={{ fontSize: 30, fontWeight: 600, marginTop: 12 }}>{loyal.length} of {sites.length} <span style={{ fontSize: 16, color: "var(--muted)", fontWeight: 500 }}>have one ({Math.round((loyal.length / Math.max(1, sites.length)) * 100)}%)</span></div>
            <div className="row" style={{ gap: 6, marginTop: 12, fontSize: 13 }}>
              {loyal.map((s) => <Link key={s.domain} href={`/sites/${s.domain}`} className="tag">{val(s, "loyalty.program")} ({siteName(s)})</Link>)}
            </div>
          </section>

          <section id="tech" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Tools in use</h2><span className="small muted">{sites.length} sites</span></div>
            <div className="grid g3" style={{ gap: 12, marginTop: 14 }}>
              {tools.map((t: any) => (
                <Link key={t.value} href={`/explore/tech/${t.value}`} style={{ border: "1px solid var(--line2)", borderRadius: 10, padding: 12, color: "var(--ink)" }}>
                  <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>{Math.round((t.n / Math.max(1, sites.length)) * 100)}%</div>
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
