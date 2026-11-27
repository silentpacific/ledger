import Link from "next/link";
import Header from "@/components/Header";
import { Bars, Stat } from "@/components/ui";
import IndustryFilter from "@/components/IndustryFilter";
import SitePicker from "@/components/SitePicker";
import FilterSelect from "@/components/FilterSelect";
import StoreLookup, { type Profile } from "@/components/StoreLookup";
import { getCounts, getView } from "@/lib/data";
import { nextWeekly, TRACKING_BEGAN } from "@/lib/schedule";
import { COVERAGE } from "@/lib/stats";
import { dateAU, dayKey } from "@/lib/format";
import { FEED_MAX, type Bar, type Card, type FeedItem, type Ref } from "@/lib/views";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const revalidate = 3600;

type Item = FeedItem;
type HomeView = {
  total: number; industries: number; onSale: { text: string; sub?: string }; afterpay: number; bnplN: number; fsMedian: string; fsN: number;
  findings: { text: string; href: string }[]; top: Item[]; anyConfirmed: boolean; bnplRows: Bar[]; tools: { value: string; name: string; n: number }[];
  suggestions: { name: string; sites: Ref[] }[]; start: Card | null; tryThese: Card[];
};
type FeedView = { items: Item[]; total: number; stores: Ref[] };

const short = (d: string | Date) => dateAU(d, { day: "numeric", month: "short", year: "numeric" });

export default async function Home({ searchParams }: { searchParams: Promise<{ f?: string; industry?: string; segment?: string; site?: string }> }) {
  const { f = "all", industry, segment, site } = await searchParams;
  const [v, fv, counts] = await Promise.all([getView<HomeView>("home"), getView<FeedView>(`feed:${industry || "all"}`), getCounts()]);
  if (!v) return <><Header /><main className="wrap page"><p className="lede">The latest numbers are being worked out. Try again in a minute.</p></main></>;
  const feed = fv ?? { items: [], total: 0, stores: [] };
  const items = site ? feed.items.filter((i) => i.domain === site) : feed.items;
  const shown = items.filter((i) => f === "all" || i.tag.toLowerCase().startsWith(f) || (f === "promotion" && i.tag.includes("ffer")));
  const days = new Map<string, Item[]>();
  shown.forEach((i) => { const k = dayKey(i.at); days.set(k, [...(days.get(k) || []), i]); });
  const FILTERS = [["all", "All kinds"], ["promotion", "Promotions"], ["shipping", "Shipping"], ["payments", "Payments"], ["policies", "Policies"], ["tech", "Tech"]];
  const { top, bnplRows, tools, suggestions, findings } = v;
  const bnplSites = { length: v.bnplN };
  const weekly = nextWeekly();
  const FeedItem = ({ i }: { i: Item }) => (
    <div className="feed-item" style={{ alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <Link href={`/sites/${i.domain}`} style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>{i.site}</Link>
          <span className="tag" style={{ fontSize: 11 }}>{i.tag}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4 }}>{i.text}</div>
        <div className="small muted" style={{ marginTop: 4 }}>{i.ind} · {i.when}</div>
      </div>
      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
        <div className="tiny" style={{ fontWeight: 600, color: i.sig === "High" ? "var(--amber)" : "var(--muted)" }} title="How much this change matters to a shopper or competitor (High, Medium, Low)">Importance: {i.sig}</div>
        <Link href={`/sites/${i.domain}`} className="tiny" style={{ display: "inline-block", marginTop: 6, fontWeight: 600 }}>View store →</Link>
      </div>
    </div>
  );

  return (
    <>
      <Header />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "How Australian online stores sell", path: "/" })} />
      <main className="wrap page">
        <StoreLookup start={v.start} tryThese={v.tryThese}>
          <h1>Australian eCommerce Intelligence</h1>
          <p>Store policies, delivery costs, promotions and technology for {v.total} stores in {v.industries} industries all in one place.
            Every fact is dated and quoted from the store's own site, and every change is recorded.</p>
          <p className="hero-note">
            Offers are checked every week (next {dateAU(weekly, { weekday: "long", day: "numeric", month: "short" })}), everything else monthly.
            Tracking began on {short(TRACKING_BEGAN + "T12:00:00")}, so the history is still short.{" "}
            <Link href="/methodology">How we collect and check facts</Link>. Or <Link href="/industries">browse by industry</Link>.
          </p>
        </StoreLookup>

        {/* market overview */}
        <h2 style={{ margin: "36px 0 0", fontSize: 24 }}>The market right now</h2>
        <div className="grid g4" style={{ marginTop: 16 }}>
          <Stat k="Australian stores monitored" v={v.total} sub={`across ${v.industries} industries`}
            how="Online stores whose terms allow automated reading and whose pages we could read. Stores that ask not to be tracked are left out." />
          <Stat k="Stores with an active offer" v={v.onSale.text} sub={v.onSale.sub}
            how="A discount or gift seen on the store in the latest weekly scan, and not past its advertised end date." />
          <Stat k="Afterpay detected" v={`${v.afterpay} of ${v.bnplN}`} sub="stores where a buy now, pay later option was found"
            how={`Counted among the ${bnplSites.length} stores where we found any buy now, pay later option, from payment logos, scripts and payment pages.`} />
          <Stat k="Median free-shipping minimum" v={v.fsMedian} sub={`${v.fsN} of ${v.total} stores state one`}
            how="The order value above which standard delivery is free, from each store's shipping page or homepage banner. Stores that don't state one are left out." />
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>What the data says</h3>
          {findings.map((x) => (
            <div key={x.text} className="kv"><span>{x.text}</span><Link href={x.href} className="small" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>See the data →</Link></div>
          ))}
          <div className="tiny muted" style={{ marginTop: 8 }}>Worked out from the latest scans; industries with fewer than 5 stores are left out, and medians need at least {Math.round(COVERAGE * 100)}% of stores to state the value.</div>
        </div>

        {/* compare: the main thing to do here */}
        <section className="band" style={{ marginTop: 36 }}>
          <h2>Compare stores side by side</h2>
          <p className="small">Free-shipping minimums, returns windows, buy now pay later, loyalty and live offers, for up to 5 stores from any industry.</p>
          <SitePicker chosen={[]} />
          {suggestions.length > 0 && (
            <div className="row small" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
              <span className="muted">Try:</span>
              {suggestions.map((g) => (
                <Link key={g.name} className="chip" href={`/compare?sites=${g.sites.map((s) => s.domain).join(",")}`}>{g.name}: {g.sites.map((s) => s.name).join(" vs ")}</Link>
              ))}
            </div>
          )}
        </section>

        {/* the most important changes */}
        <div className="split" style={{ marginTop: 36 }}>
          <section className="main" aria-labelledby="top-h">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 id="top-h" style={{ margin: 0, fontSize: 24 }}>What changed this week</h2>
              <a href="#activity" className="small" style={{ fontWeight: 600 }}>All activity ↓</a>
            </div>
            <div className="card" style={{ padding: 0, marginTop: 14 }}>
              {top.length ? top.map((i, n) => <FeedItem key={n} i={i} />) : <div className="empty">Nothing yet. Changes appear here once a later scan confirms them.</div>}
            </div>
            {!v.anyConfirmed && (
              <p className="small muted" style={{ marginTop: 10 }}>Policy, price and payment changes appear once a later scan confirms them; tracking began {short(TRACKING_BEGAN + "T12:00:00")}. Until then, this list shows offers running now.</p>
            )}
          </section>
          <aside className="side" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="card">
              <h2>Buy now, pay later</h2>
              <div className="small muted" style={{ margin: "4px 0 14px" }}>Stores offering each provider, of the {bnplSites.length} with any option found</div>
              <Bars rows={bnplRows} max={bnplSites.length} color="var(--blue)" />
            </section>
            <section className="card">
              <h2 style={{ marginBottom: 12 }}>Most-used tools</h2>
              <div className="grid g2" style={{ gap: 10, fontSize: 14 }}>
                {tools.map((t) => <Link key={t.value} href={`/tech/${t.value}`}>{t.name} · {t.n}</Link>)}
              </div>
              <Link href="/tech" className="small" style={{ display: "inline-block", marginTop: 12, fontWeight: 600 }}>All technology →</Link>
            </section>
          </aside>
        </div>

        {/* the full feed, filterable */}
        <section id="activity" style={{ marginTop: 44 }} aria-labelledby="all-h">
          <h2 id="all-h" style={{ margin: 0, fontSize: 24 }}>All activity</h2>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Every confirmed change and every offer seen in the last 7 days. Filter by industry, kind of change or one store.{feed.total > FEED_MAX ? ` Showing the latest ${FEED_MAX} of ${feed.total}; each store's page has its full history.` : ""}</p>
          <IndustryFilter path="/" counts={counts} industry={industry} keep={{ f: f === "all" ? undefined : f, site }}
            extra={<>
              <FilterSelect label="Kind of change" param="f" value={f === "all" ? "" : f} path="/" query={{ industry, segment, site, f: f === "all" ? undefined : f }}
                options={FILTERS.map(([k, t]) => ({ value: k === "all" ? "" : k, label: t }))} width={170} />
              <FilterSelect label="Store" param="site" value={site} path="/" query={{ industry, segment, site, f: f === "all" ? undefined : f }}
                options={[{ value: "", label: `All stores with activity (${feed.stores.length})` }, ...feed.stores.map((s) => ({ value: s.domain, label: s.name }))]} width={240} />
            </>} />
          {days.size === 0 && <div className="empty" style={{ marginTop: 20 }}>Nothing matches these filters yet. Try “All kinds” or a wider industry or segment; new changes appear after each weekly scan.</div>}
          {[...days.entries()].map(([day, list_]) => (
            <div key={day}>
              <div className="small muted" style={{ fontWeight: 600, margin: "24px 0 10px" }}>{dateAU(day + "T12:00:00", { weekday: "long", day: "numeric", month: "long" })}</div>
              <div className="card" style={{ padding: 0 }}>{list_.map((i, n) => <FeedItem key={n} i={i} />)}</div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
