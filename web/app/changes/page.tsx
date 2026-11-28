import Link from "next/link";
import Header from "@/components/Header";
import { Bars, Stat } from "@/components/ui";
import IndustryFilter from "@/components/IndustryFilter";
import SitePicker from "@/components/SitePicker";
import FilterSelect from "@/components/FilterSelect";
import { getCounts, getView } from "@/lib/data";
import { nextWeekly, TRACKING_BEGAN } from "@/lib/schedule";
import { COVERAGE } from "@/lib/stats";
import { dateAU, dayKey } from "@/lib/format";
import { FEED_MAX, type Bar, type Card, type FeedItem, type Ref } from "@/lib/views";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const revalidate = 3600;
export const metadata = { title: "What changed", description: "Every confirmed change and live offer at Australian online stores this week: shipping, returns, payments, promotions and tech.", alternates: { canonical: "/changes" } };

type Item = FeedItem;
type HomeView = {
  total: number; industries: number; onSale: { text: string; sub?: string }; afterpay: number; bnplN: number; fsMedian: string; fsN: number;
  findings: { text: string; href: string }[]; top: Item[]; anyConfirmed: boolean; bnplRows: Bar[]; tools: { value: string; name: string; n: number }[];
  suggestions: { name: string; sites: Ref[] }[]; start: Card | null; tryThese: Card[];
};
type FeedView = { items: Item[]; total: number; stores: Ref[] };

const short = (d: string | Date) => dateAU(d, { day: "numeric", month: "short", year: "numeric" });

export default async function Changes({ searchParams }: { searchParams: Promise<{ f?: string; industry?: string; segment?: string; site?: string; fp?: string }> }) {
  const { f = "all", industry, segment, site, fp } = await searchParams;
  const [v, fv, counts] = await Promise.all([getView<HomeView>("home"), getView<FeedView>(`feed:${industry || "all"}`), getCounts()]);
  if (!v) return <><Header /><main className="wrap page"><p className="lede">The latest numbers are being worked out. Try again in a minute.</p></main></>;
  const feed = fv ?? { items: [], total: 0, stores: [] };
  const items = site ? feed.items.filter((i) => i.domain === site) : feed.items;
  const shown = items.filter((i) => f === "all" || i.tag.toLowerCase().startsWith(f) || (f === "promotion" && i.tag.includes("ffer")));
  const PER = 50, fpages = Math.max(1, Math.ceil(shown.length / PER)), fpage = Math.min(Math.max(1, Number(fp) || 1), fpages);
  const fq = (n: number) => `/changes?${new URLSearchParams(Object.entries({ f: f === "all" ? undefined : f, industry, site, fp: n > 1 ? String(n) : undefined }).filter(([, x]) => x) as [string, string][])}#activity`;
  const days = new Map<string, Item[]>();
  shown.slice((fpage - 1) * PER, fpage * PER).forEach((i) => { const k = dayKey(i.at); days.set(k, [...(days.get(k) || []), i]); });
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
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "What changed at Australian online stores", path: "/changes" })} />
      <main className="wrap page">
        <h1 className="title">What changed</h1>
        <p className="lede">Every confirmed change and every offer seen in the last 7 days, across {v.total} stores. Filter by industry, kind of change or one store.</p>
        {/* the full feed, filterable */}
        <section id="activity" style={{ marginTop: 44 }} aria-labelledby="all-h">
          <h2 id="all-h" style={{ margin: 0, fontSize: 24 }}>All activity</h2>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Every confirmed change and every offer seen in the last 7 days. Filter by industry, kind of change or one store.{feed.total > FEED_MAX ? ` Showing the latest ${FEED_MAX} of ${feed.total}; each store's page has its full history.` : ""}</p>
          <IndustryFilter path="/changes" counts={counts} industry={industry} keep={{ f: f === "all" ? undefined : f, site }}
            extra={<>
              <FilterSelect label="Kind of change" param="f" value={f === "all" ? "" : f} path="/changes" query={{ industry, segment, site, f: f === "all" ? undefined : f }}
                options={FILTERS.map(([k, t]) => ({ value: k === "all" ? "" : k, label: t }))} width={170} />
              <FilterSelect label="Store" param="site" value={site} path="/changes" query={{ industry, segment, site, f: f === "all" ? undefined : f }}
                options={[{ value: "", label: `All stores with activity (${feed.stores.length})` }, ...feed.stores.map((s) => ({ value: s.domain, label: s.name }))]} width={240} />
            </>} />
          {days.size === 0 && <div className="empty" style={{ marginTop: 20 }}>Nothing matches these filters yet. Try “All kinds” or a wider industry or segment; new changes appear after each weekly scan.</div>}
          {[...days.entries()].map(([day, list_]) => (
            <div key={day}>
              <div className="small muted" style={{ fontWeight: 600, margin: "24px 0 10px" }}>{dateAU(day + "T12:00:00", { weekday: "long", day: "numeric", month: "long" })}</div>
              <div className="card" style={{ padding: 0 }}>{list_.map((i, n) => <FeedItem key={n} i={i} />)}</div>
            </div>
          ))}
          {fpages > 1 && (
            <nav className="row small" aria-label="Activity pages" style={{ gap: 6, marginTop: 16, alignItems: "center" }}>
              <span className="muted" style={{ marginRight: 8 }}>Showing {(fpage - 1) * PER + 1}–{Math.min(fpage * PER, shown.length)} of {shown.length}</span>
              {fpage > 1 && <Link scroll={false} className="chip" href={fq(fpage - 1)} rel="prev">Newer</Link>}
              {fpage < fpages && <Link scroll={false} className="chip" href={fq(fpage + 1)} rel="next">Older</Link>}
            </nav>
          )}
        </section>
      </main>
    </>
  );
}
