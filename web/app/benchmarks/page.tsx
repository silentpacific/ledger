import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import { Bars, JsonLd } from "@/components/ui";
import { getCounts, getView } from "@/lib/data";
import type { Bar } from "@/lib/views";
import { dateAU, money } from "@/lib/format";
import { industryName } from "@/lib/industries";
import { COVERAGE } from "@/lib/stats";
import { SITE_URL } from "@/lib/site";
import { BRAND } from "@/lib/brand";
import { pageSchema } from "@/lib/schema";
import "../home.css";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Australian ecommerce benchmarks: shipping, returns, BNPL, loyalty, by industry",
  description: "How Australian online stores compare on free-shipping thresholds, delivery fees, returns windows, buy now pay later, loyalty programmes and tools, industry by industry. Updated weekly.",
  alternates: { canonical: "/benchmarks" },
};

const COLORS = ["#0E6B62", "#8FC9C0", "#2F5FA7", "#9DB6DC", "#B9B5A8"];

type OvRow = { slug: string; name: string; n: number; fs: number | null; fsCov: number; ret: number | null; retCov: number };
export default async function Benchmarks({ searchParams }: { searchParams: Promise<{ industry?: string; segment?: string }> }) {
  const { industry, segment } = await searchParams;
  type Num = { count: number; median: string | null; low: { v: string; name: string } | null; high: { v: string; name: string } | null; rows: Bar[] };
  type V = { n: number; latest: string; ship: Num; fee: Num;
    ret: { count: number; buckets: [number, number][]; names: Record<string, string>; byInd: Bar[] };
    pay: { count: number; rows: Bar[]; avg: string; byInd: Bar[] };
    loy: { count: number; tags: { domain: string; program: string; name: string }[]; byInd: Bar[] };
    tools: { value: string; name: string; pct: number }[] };
  const [v, counts, ov] = await Promise.all([getView<V>(`benchmarks:${industry || "all"}`), getCounts(), getView<OvRow[]>("overview")]);
  if (!v) return null;
  const sites = { length: v.n }, latest = v.latest;
  const big = (x: string, k: string) => <div><div className="display" style={{ fontSize: 30, fontWeight: 600 }}>{x}</div><div className="tiny muted">{k}</div></div>;
  const pct = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));
  const scope = industry ? industryName(industry).toLowerCase() + " stores" : "stores";
  /** A numeric fact: overall median, then one bar per industry (all industries) or per store (one industry). */
  const numeric = (id: string, title: string, d: Num, color?: string) => (
    <section id={id} className="card">
      <div className="row" style={{ justifyContent: "space-between" }}><h2>{title}</h2><span className="small muted">{d.count} of {sites.length} {scope} state it</span></div>
      {d.count ? <>
        <div className="row" style={{ gap: 28, margin: "12px 0 16px" }}>{big(d.median!, "median")}{big(d.low!.v, `lowest (${d.low!.name})`)}{big(d.high!.v, `highest (${d.high!.name})`)}</div>
        <Bars rows={d.rows} color={color} />
        <div className="tiny muted" style={{ marginTop: 10 }}>{industry ? "Each bar is one store." : `Each bar is an industry's median; it's shown when at least ${Math.round(COVERAGE * 100)}% of its stores state the value. Click one for its stores.`}</div>
      </> : <p className="muted small">No data yet.</p>}
    </section>
  );
  const buckets = new Map(v.ret.buckets);
  const bnplSites = { length: v.pay.count }, bnpl = v.pay.rows, avgProviders = v.pay.avg, tools = v.tools;
  return (
    <div className="h ov">
      <Header active="/benchmarks" />
      <JsonLd data={pageSchema({ name: "How Australian stores compare", path: "/benchmarks", crumbs: [["Benchmarks"]] })} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Dataset", name: `Australian ecommerce benchmarks${industry ? `: ${industryName(industry)}` : ""}`,
        description: "Free-shipping thresholds, delivery fees, returns windows, buy now pay later adoption and loyalty programmes across Australian online stores, by industry.",
        url: `${SITE_URL}/benchmarks`, spatialCoverage: "Australia", dateModified: latest, creator: { "@type": "Organization", name: `${BRAND}` } }} />
      <main className="wrap page">
        <div className="eyebrow">Benchmarks{industry ? ` · ${industryName(industry)}` : " · All industries"}</div>
        <h1 className="title">How Australian {scope} compare</h1>
        {!industry && ov && (() => {
          const ok = ov.filter((r) => r.n > 0 && r.fs !== null && r.fsCov >= 60), okR = ov.filter((r) => r.n > 0 && r.ret !== null && r.retCov >= 60);
          const lo = [...ok].sort((a, b) => a.fs! - b.fs!)[0], hi = [...ok].sort((a, b) => b.fs! - a.fs!)[0], minR = Math.min(...okR.map((r) => r.ret!));
          const short = okR.filter((r) => r.ret === minR).map((r) => r.name.split(" & ")[0]);
          return lo && hi ? <div className="ov-dark" style={{ marginTop: 24 }}><p className="h-eye" style={{ color: "#FACC15" }}>What stands out</p><p className="i-stand" style={{ margin: 0, color: "#FFFFFF" }}>Free-shipping minimums run from {money(lo.fs)} in {lo.name.split(" & ")[0].toLowerCase()} to {money(hi.fs)} in {hi.name.split(" & ")[0].toLowerCase()}.{short.length ? ` ${short.join(" and ")} ${short.length > 1 ? "give" : "gives"} the shortest returns, at ${minR} days.` : ""}</p></div> : null;
        })()}
        <p className="small muted" style={{ margin: "8px 0 0" }}>{sites.length} stores · facts seen {latest ? dateAU(latest) : "—"} · trends appear after four weekly scans</p>
        <IndustryFilter path="/benchmarks" counts={counts} industry={industry} />
        <nav className="tabs" style={{ marginTop: 24 }}><a className="on" href="#ship">Shipping</a><a href="#ret">Returns</a><a href="#pay">Payments</a><a href="#loy">Loyalty</a><a href="#tech">Tech</a><Link href={`/promotions${industry ? `?industry=${industry}` : ""}`}>Promotions</Link></nav>

        <div className="grid g2" style={{ marginTop: 24 }}>
          {numeric("ship", "Free-shipping threshold", v.ship)}
          {numeric("fee", "Standard delivery fee", v.fee, "var(--blue)")}

          <section id="ret" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Returns window</h2><span className="small muted">{v.ret.count} of {sites.length} state it</span></div>
            <div style={{ display: "flex", height: 40, borderRadius: 8, overflow: "hidden", marginTop: 16, fontSize: 13, fontWeight: 600 }}>
              {[...buckets.entries()].sort((a, b) => b[0] - a[0]).map(([d, n], i) => (
                <span key={d} style={{ flex: `${n} 1 0`, background: COLORS[i % COLORS.length], color: i % 2 ? "#0A2E2A" : "#fff", display: "flex", alignItems: "center", paddingLeft: 10, whiteSpace: "nowrap", overflow: "hidden" }}>{d} days · {n}</span>
              ))}
            </div>
            {industry ? (
              <div className="small" style={{ marginTop: 14, lineHeight: 1.6, color: "var(--body)" }}>
                {[...buckets.keys()].sort((a, b) => b - a).map((d) => <div key={d}><strong>{d} days:</strong> {v.ret.names[d]}</div>)}
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <Bars color="var(--blue)" rows={v.ret.byInd} />
                <div className="tiny muted" style={{ marginTop: 10 }}>Median returns window by industry.</div>
              </div>
            )}
          </section>

          <section id="pay" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Buy now, pay later</h2><span className="small muted">{bnplSites.length} of {sites.length} offer it</span></div>
            <div style={{ marginTop: 14 }}>
              <Bars color="var(--blue)" max={bnplSites.length} rows={bnpl} />
            </div>
            <p className="small muted" style={{ margin: "6px 0 0" }}>Share of stores with BNPL that offer each provider. Average: {avgProviders} providers per store.</p>
            {!industry && <div style={{ marginTop: 14 }}><Bars rows={v.pay.byInd} max={100} /><div className="tiny muted" style={{ marginTop: 6 }}>Share of each industry's stores offering any BNPL.</div></div>}
          </section>

          <section id="loy" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Loyalty programmes</h2><span className="small muted">{sites.length} stores</span></div>
            <div className="display" style={{ fontSize: 30, fontWeight: 600, marginTop: 12 }}>{v.loy.count} of {sites.length} <span style={{ fontSize: 16, color: "var(--muted)", fontWeight: 500 }}>have one ({pct(v.loy.count, sites.length)}%)</span></div>
            {industry ? (
              <div className="row" style={{ gap: 6, marginTop: 12, fontSize: 13 }}>
                {v.loy.tags.map((s) => <Link key={s.domain} href={`/sites/${s.domain}`} className="tag">{s.program} ({s.name})</Link>)}
              </div>
            ) : (
              <div style={{ marginTop: 14 }}><Bars max={100} rows={v.loy.byInd} /></div>
            )}
          </section>

          <section id="tech" className="card">
            <div className="row" style={{ justifyContent: "space-between" }}><h2>Tools in use</h2><Link href={`/tech${industry ? `?industry=${industry}` : ""}`} className="small" style={{ fontWeight: 600 }}>All tools →</Link></div>
            <div className="grid g3" style={{ gap: 12, marginTop: 14 }}>
              {tools.map((t) => (
                <Link key={t.value} href={`/tech/${t.value}${industry ? `?industry=${industry}` : ""}`} style={{ border: "1px solid var(--line2)", borderRadius: 10, padding: 12, color: "var(--ink)" }}>
                  <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>{t.pct}%</div>
                  <div className="small muted">{t.name}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
