import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import SortTable from "@/components/SortTable";
import { Bars, Stat } from "@/components/ui";
import { filterSites, getChanges, getSites, industryOf } from "@/lib/data";
import { WALLETS, dateAU, describeChange, facets, label, list, siteName, slug } from "@/lib/format";
import { INDUSTRIES, industryName } from "@/lib/industries";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Payment options at Australian online stores: buy now pay later and wallets",
  description: "Which Australian online stores offer Afterpay, Zip, Klarna, Humm, PayPal Pay in 4 and other payment options, by industry, with recent additions and drops.",
  alternates: { canonical: "/payments" },
};

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export default async function Payments({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { industry } = await searchParams;
  const all = await getSites();
  const sites = filterSites(all, industry);
  const bnpl = (s: (typeof sites)[number]) => list(s, "payments.bnpl_providers");
  const withBnpl = sites.filter((s) => bnpl(s).length);
  const options = facets(sites).payments || [];
  const avg = withBnpl.length ? (withBnpl.reduce((a, s) => a + bnpl(s).length, 0) / withBnpl.length).toFixed(1) : "–";
  const top = options[0];

  // the most common sets of BNPL providers offered together
  const combos = new Map<string, number>();
  withBnpl.forEach((s) => { const k = bnpl(s).map(label).sort().join(" + "); combos.set(k, (combos.get(k) || 0) + 1); });
  const topCombos = [...combos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const dom = new Set(sites.map((s) => s.domain));
  const changes = (await getChanges(365)).filter((c) => c.key === "payments.bnpl_providers" && dom.has(c.domain)).slice(0, 12);
  const q = industry ? `?industry=${industry}` : "";

  const rows = options.map((o: any) => {
    const n = o.n as number;
    const lead = INDUSTRIES.map((i) => { const xs = filterSites(all, i.slug); return { i, p: pct(xs.filter(o.test).length, xs.length), n: xs.length }; })
      .filter((x) => x.n >= 5).sort((a, b) => b.p - a.p)[0];
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

  return (
    <>
      <Header active="/payments" />
      <main className="wrap page">
        <div className="eyebrow">Explore</div>
        <h1 className="title">How Australian online stores take payment</h1>
        <p className="lede">Buy now, pay later providers and wallets shown at checkout or on product pages, across {sites.length} {industry ? `${industryName(industry).toLowerCase()} ` : ""}stores we track. Every figure links to the stores behind it.</p>
        <IndustryFilter path="/payments" sites={all} industry={industry} />

        <div className="grid g4" style={{ marginTop: 28 }}>
          <Stat k="Stores offering buy now, pay later" v={`${pct(withBnpl.length, sites.length)}%`} sub={`${withBnpl.length} of ${sites.length} stores`}
            how="A store counts when its own pages name a buy now, pay later provider (checkout logos, product-page messages or payment pages)." />
          <Stat k="Providers per store" v={avg} sub="average, among stores that offer one" />
          <Stat k="Most offered" v={top ? top.name : "–"} sub={top ? `${(top as any).n} of ${sites.length} stores` : undefined} />
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
                <Bars max={100} rows={INDUSTRIES.map((i) => { const xs = filterSites(all, i.slug); const b = xs.filter((s) => bnpl(s).length).length;
                  return { label: i.name, n: pct(b, xs.length), text: `${pct(b, xs.length)}% · ${b} of ${xs.length}`, href: `/payments?industry=${i.slug}` }; })
                  .filter((r) => !r.text.endsWith("of 0"))} />
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
                  <Link href={`/sites/${c.domain}`} style={{ fontWeight: 600 }}>{siteName(c.domain)}</Link> {describeChange(c).text} · <span className="muted">{dateAU(c.at)}</span>
                </div>))}
          </section>
        </div>
        <p className="tiny muted" style={{ marginTop: 16 }}>{withBnpl.length ? `Industries: ${[...new Set(withBnpl.map((s) => industryName(industryOf(s))))].length} represented. ` : ""}"No provider found" means none is named on the pages we read, not that the store never offers one.</p>
      </main>
    </>
  );
}
