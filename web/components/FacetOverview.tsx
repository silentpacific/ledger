import Link from "next/link";
import Header from "@/components/Header";
import SortTable, { type SortRow } from "@/components/SortTable";
import DotRows from "@/components/DotRows";
import ComingSoon from "@/components/ComingSoon";
import { HBars, type Pair } from "@/components/charts";
import { JsonLd } from "@/components/ui";
import { pageSchema } from "@/lib/schema";
import { dateAU, facetHref, KIND_HOME } from "@/lib/format";
import type { ChangeLine } from "@/lib/views";
import "@/app/home.css";

export type Matrix = { total: number; all: { value: string; name: string; n: number; pct: number }[]; cols: { value: string; name: string }[];
  rows: { slug: string; name: string; n: number; vals: number[] }[] };
export const SHORT: Record<string, string> = { jewellery: "Jewellery", fashion: "Fashion", beauty: "Beauty", health: "Health", homewares: "Homewares", pet: "Pet",
  "baby-kids": "Baby & kids", "sports-outdoors": "Sports & outdoors", electronics: "Electronics" };

const heat = (vals: number[], v: number) => {
  const mn = Math.min(...vals), mx = Math.max(...vals);
  return `rgba(250,204,21,${(0.08 + 0.62 * (mx === mn ? 0.5 : (v - mn) / (mx - mn))).toFixed(2)})`;
};

/** The redesigned overview for a kind of list (payment options, technologies, platforms, policies), in the Industries page's style:
 * a headline from the data, key figures, a heat-map scorecard by industry, overall bars, where the leader is strongest, and cards. */
export default function FacetOverview({ kind, eyebrow, title, lede, headline, m, figs, side, changes, crumb }: {
  kind: string; eyebrow: string; title: string; lede: string; headline: string; m: Matrix; figs: [string, string, string][];
  side?: { title: string; sub: string; body: React.ReactNode }; changes?: ChangeLine[]; crumb: string;
}) {
  const rows = m.rows.filter((r) => r.n > 0);
  const table: SortRow[] = rows.map((r) => ({ id: r.slug, cells: {
    industry: { text: r.name, sort: r.name, href: `${KIND_HOME[kind]}?industry=${r.slug}` },
    n: { text: String(r.n), sort: r.n },
    ...Object.fromEntries(m.cols.map((c, k) => [c.value, { text: `${r.vals[k]}%`, sort: r.vals[k], bg: heat(rows.map((x) => x.vals[k]), r.vals[k]) }])),
  } }));
  const lead = m.cols[0], second = m.cols[1];
  const dots = (k: number) => rows.map((r) => ({ label: SHORT[r.slug] ?? r.name, value: r.vals[k], text: `${r.vals[k]}%` }));
  return (
    <div className="h i-page">
      <Header active={KIND_HOME[kind]} />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: title, path: KIND_HOME[kind], crumbs: [[crumb]], items: m.all.map((o) => ({ name: o.name, path: facetHref(kind, o.value) })) })} />
      <main>
        <section className="h-col" style={{ paddingTop: 48, paddingBottom: 36 }}>
          <p className="h-eye">{eyebrow}</p>
          <h1 style={{ margin: 0, fontSize: "clamp(36px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-1.6px", fontWeight: 800 }}>{title}</h1>
          <p className="i-stand" style={{ marginTop: 18 }}>{headline}</p>
          <p className="h-lede">{lede}</p>
        </section>

        <section className="h-col" style={{ paddingBottom: 56 }}>
          <div className="i-figs" style={{ gridTemplateColumns: `repeat(${figs.length}, minmax(0, 1fr))` }}>
            {figs.map(([a, b, c]) => <div key={b} className="i-fig"><b>{a}</b><span>{b}</span><small>{c}</small></div>)}
          </div>
        </section>

        <section className="h-col" style={{ paddingBottom: 64 }} aria-labelledby="score-h">
          <div className="i-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div><h2 id="score-h" className="h-h2" style={{ fontSize: 30 }}>By industry</h2>
              <p className="h-lede">Share of each industry's stores. Darker yellow is higher within each column. Click a heading to sort, or an industry to see only its stores.</p></div>
            <ComingSoon label="Export" />
          </div>
          <div className="ov-score" style={{ marginTop: 20 }}>
            <SortTable minWidth={1000} initial="n" initialDesc rows={table}
              cols={[{ key: "industry", label: "Industry" }, { key: "n", label: "Stores" }, ...m.cols.map((c) => ({ key: c.value, label: c.name }))]} />
          </div>
        </section>

        <section className="h-band" aria-labelledby="all-h"><div className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <p className="h-eye">Across all {m.total} stores</p>
          <h2 id="all-h" className="h-h2" style={{ fontSize: 30 }}>{m.all[0] ? `${m.all[0].name} leads, at ${m.all[0].pct}% of stores.` : "Nothing recorded yet."}</h2>
          <div className="i-two" style={side ? { gridTemplateColumns: "1.2fr 1fr" } : { gridTemplateColumns: "1fr" }}>
            <div className="i-panel"><p className="i-pt">Share of all stores</p><p className="i-ps">The {Math.min(12, m.all.length)} most common</p>
              <HBars rows={m.all.slice(0, 12).map((o) => [o.name, o.n] as Pair)} of={m.total} colors={["#0F172A", "#1D4ED8", "#0E7C6B", "#B45309", "#94A3B8", "#FACC15"]} /></div>
            {side && <div className="i-panel"><p className="i-pt">{side.title}</p><p className="i-ps">{side.sub}</p>{side.body}</div>}
          </div>
        </div></section>

        {lead && (
          <section className="h-break" aria-labelledby="lead-h"><div className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }}>
            <p className="h-eye" style={{ color: "#FACC15" }}>Where they're strongest</p>
            <h2 id="lead-h" className="h-h2" style={{ fontSize: 30, color: "#FFFFFF" }}>{(() => {
              const best = [...rows].sort((a, b) => b.vals[0] - a.vals[0])[0];
              return best ? `${lead.name} is most common in ${SHORT[best.slug] ?? best.name}, at ${best.vals[0]}% of stores.` : "";
            })()}</h2>
            <div className="i-two" style={second ? undefined : { gridTemplateColumns: "1fr" }}>
              <div className="i-panel"><p className="i-pt">{lead.name}</p><p className="i-ps">Share of each industry's stores</p>
                <DotRows label={`${lead.name} by industry`} lo={0} hi={100} loText="0%" hiText="100%" rows={dots(0)} /></div>
              {second && <div className="i-panel"><p className="i-pt">{second.name}</p><p className="i-ps">Share of each industry's stores</p>
                <DotRows label={`${second.name} by industry`} lo={0} hi={100} loText="0%" hiText="100%" fill="#FACC15" rows={dots(1)} /></div>}
            </div>
          </div></section>
        )}

        <section className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: changes?.length ? 40 : 80 }} aria-labelledby="ex-h">
          <p className="h-eye">Explore</p>
          <h2 id="ex-h" className="h-h2" style={{ fontSize: 30 }}>Open any one to see every store using it.</h2>
          <div className="ov-chips">
            {m.all.map((o) => (
              <Link key={o.value} href={facetHref(kind, o.value)} className="i-panel ov-chip">
                <b>{o.name}</b><span>{o.n} {o.n === 1 ? "store" : "stores"} · {o.pct}%</span>
              </Link>
            ))}
          </div>
        </section>

        {changes && changes.length > 0 && (
          <section className="h-col" style={{ paddingBottom: 80 }} aria-labelledby="ch-h">
            <h2 id="ch-h" className="h-h2" style={{ fontSize: 24 }}>Recently added or dropped</h2>
            <div className="i-panel" style={{ marginTop: 16, padding: "8px 20px", textAlign: "left" }}>
              {changes.map((c, i) => (
                <p key={i} style={{ margin: 0, padding: "10px 0", borderTop: i ? "1px solid #F1F5F9" : 0, fontSize: 14 }}>
                  <Link href={`/sites/${c.domain}`} style={{ fontWeight: 700, color: "#0F172A" }}>{c.store}</Link> {c.text} · <span style={{ color: "#64748B" }}>{dateAU(c.at)}</span></p>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
