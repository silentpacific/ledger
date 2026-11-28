import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import SortTable from "@/components/SortTable";
import { Bars, Stat } from "@/components/ui";
import { getCounts, getView } from "@/lib/data";
import type { ChangeLine } from "@/lib/views";
import { dateAU } from "@/lib/format";
import { industryName } from "@/lib/industries";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";
import "../home.css";
import FacetOverview, { type Matrix } from "@/components/FacetOverview";
import { HBars, type Pair } from "@/components/charts";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Payment options at Australian online stores: buy now pay later and wallets",
  description: "Which Australian online stores offer Afterpay, Zip, Klarna, Humm, PayPal Pay in 4 and other payment options, by industry, with recent additions and drops.",
  alternates: { canonical: "/payments" },
};

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export default async function Payments({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { industry } = await searchParams;
  type V = { n: number; withBnpl: number; avg: string; top: { name: string; n: number } | null; rows: any[]; options: { name: string; value: string }[];
    byInd: any[]; combos: [string, number][]; changes: ChangeLine[]; represented: number };
  const [v, counts] = await Promise.all([getView<V>(`payments:${industry || "all"}`), getCounts()]);
  if (!v) return null;
  if (!industry) {
    const m = await getView<Matrix>("matrix:payments");
    if (m) {
      const p = pct(v.withBnpl, v.n);
      return FacetOverview({ kind: "payments", crumb: "Payments", eyebrow: "Payments", title: "How Australian online stores take payment",
        headline: `${p}% of stores offer buy now, pay later.${v.top ? ` ${v.top.name} is the most common, at ${pct(v.top.n, v.n)}% of all stores.` : ""}`,
        lede: `Buy now, pay later providers and wallets shown at checkout or on product pages, across ${v.n} stores we track. Every figure links to the stores behind it.`,
        m, changes: v.changes,
        figs: [[`${p}%`, "offer buy now, pay later", `${v.withBnpl} of ${v.n} stores`], [v.avg, "providers per store", "among stores that offer one"],
          [v.top?.name ?? "—", "most offered", v.top ? `${v.top.n} of ${v.n} stores` : ""], [String(v.n - v.withBnpl), "no provider found", "none named on the pages we read"]],
        side: v.combos.length ? { title: "Offered together", sub: "The most common sets of buy now, pay later providers",
          body: <HBars rows={v.combos.map(([k, n]) => [k, n] as Pair)} of={Math.max(...v.combos.map((c) => c[1]))} colors="#FACC15" track="#FEF3C7" pct={false} /> } : undefined });
    }
  }
  const sites = { length: v.n }, withBnpl = { length: v.withBnpl }, options = v.options, avg = v.avg, top = v.top, rows = v.rows;
  const topCombos = v.combos, changes = v.changes;
  return (
    <div className="h ov">
      <Header active="/payments" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "How Australian online stores take payment", path: "/payments", crumbs: [["Payments"]], items: options.map((o) => ({ name: o.name, path: `/payments/${o.value}` })) })} />
      <main className="wrap page">
                <h1 className="title">How Australian online stores take payment</h1>
        <p className="lede">Buy now, pay later providers and wallets shown at checkout or on product pages, across {sites.length} {industry ? `${industryName(industry).toLowerCase()} ` : ""}stores we track. Every figure links to the stores behind it.</p>
        <IndustryFilter path="/payments" counts={counts} industry={industry} />

        <div className="grid g4" style={{ marginTop: 28 }}>
          <Stat k="Stores offering buy now, pay later" v={`${pct(withBnpl.length, sites.length)}%`} sub={`${withBnpl.length} of ${sites.length} stores`}
            how="A store counts when its own pages name a buy now, pay later provider (checkout logos, product-page messages or payment pages)." />
          <Stat k="Providers per store" v={avg} sub="average, among stores that offer one" />
          <Stat k="Most offered" v={top ? top.name : "–"} sub={top ? `${top.n} of ${sites.length} stores` : undefined} />
          <Stat k="No provider found" v={String(sites.length - withBnpl.length)} sub="stores where none is named on the pages we read" />
        </div>

        <section className="card" style={{ marginTop: 36 }}>
          <h2>Every payment option we've seen</h2>
          <p className="small muted" style={{ margin: "6px 0 14px" }}>Sort by any column. "Share of BNPL stores" counts only stores that offer at least one buy now, pay later option.</p>
          <SortTable minWidth={720} initial="n" initialDesc cols={[
            { key: "name", label: "Payment option" }, { key: "n", label: "Stores", align: "right" }, { key: "share", label: "Share of all stores", align: "right" },
            { key: "bnplShare", label: "Share of BNPL stores", align: "right" }, { key: "lead", label: "Most common in" }]} rows={rows} />
        </section>

        <div className="grid g2" style={{ marginTop: 36 }}>
          {!industry && (
            <section className="card">
              <h2>Buy now, pay later by industry</h2>
              <div style={{ marginTop: 14 }}>
                <Bars max={100} rows={v.byInd} />
              </div>
            </section>
          )}
          <section className="card">
            <h2>Offered together</h2>
            <p className="small muted" style={{ margin: "6px 0 10px" }}>The most common sets of buy now, pay later providers a store offers.</p>
            {topCombos.length ? topCombos.map(([k, n]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v">{n} {n === 1 ? "store" : "stores"}</span></div>)
              : <div className="empty">No stores with a buy now, pay later option yet.</div>}
          </section>
          <section className="card">
            <h2>Recently added or dropped</h2>
            {changes.length === 0
              ? <div className="empty" style={{ marginTop: 10 }}>No changes recorded yet. Each scan adds them here, dated, with the before and after.</div>
              : changes.map((c, i) => (
                <div key={i} className="small" style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line2)" : 0 }}>
                  <Link href={`/sites/${c.domain}`} style={{ fontWeight: 600 }}>{c.store}</Link> {c.text} · <span className="muted">{dateAU(c.at)}</span>
                </div>))}
          </section>
        </div>
        <p className="tiny muted" style={{ marginTop: 16 }}>{withBnpl.length ? `Industries: ${v.represented} represented. ` : ""}"No provider found" means none is named on the pages we read, not that the store never offers one.</p>
      </main>
    </div>
  );
}
