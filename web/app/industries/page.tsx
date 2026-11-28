import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import SortTable, { type SortRow } from "@/components/SortTable";
import DotRows from "@/components/DotRows";
import ComingSoon from "@/components/ComingSoon";
import { getView } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";
import { industryPlates } from "@/lib/iso";
import { money } from "@/lib/format";
import { COVERAGE } from "@/lib/stats";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";
import "../home.css";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Industries: Australian online stores compared",
  description: "Nine industries of Australian online stores side by side: free-shipping minimums, delivery fees, returns windows, buy now pay later, offers, Black Friday and platforms.",
  alternates: { canonical: "/industries" },
};

type O = { slug: string; name: string; n: number; fs: number | null; fsCov: number; fee: number | null; feeCov: number; ret: number | null; retCov: number;
  bnpl: number; offer: number; bf: number; shopify: number | null; standOut: string | null };
const SHORT: Record<string, string> = { jewellery: "Jewellery", fashion: "Fashion", beauty: "Beauty", health: "Health", homewares: "Homewares", pet: "Pet",
  "baby-kids": "Baby & kids", "sports-outdoors": "Sports & outdoors", electronics: "Electronics" };
const MIN = Math.round(COVERAGE * 100);

/** Darker yellow = higher within the column; grey = too few stores state it for a fair median. */
const heat = (vals: (number | null)[], v: number | null, ok = true) => {
  if (v === null || !ok) return "#F8FAFC";
  const xs = vals.filter((x): x is number => x !== null), mn = Math.min(...xs), mx = Math.max(...xs);
  return `rgba(250,204,21,${(0.08 + 0.62 * (mx === mn ? 0.5 : (v - mn) / (mx - mn))).toFixed(2)})`;
};

export default async function Industries() {
  const rows = ((await getView<O[]>("overview")) ?? []).filter((r) => r.n > 0);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const col = (k: keyof O) => rows.map((r) => r[k] as number | null);
  const cell = (r: O, k: keyof O, text: string | null, ok = true, cov?: number) => ({
    text: text ?? "—", sort: (r[k] as number | null) ?? null, bg: heat(col(k), r[k] as number | null, ok), muted: !ok,
    sub: ok || cov === undefined ? undefined : `${cov}% state one`,
  });
  const table: SortRow[] = rows.map((r) => ({ id: r.slug, cells: {
    industry: { text: r.name, sort: r.name, href: `/industries/${r.slug}` },
    n: { text: String(r.n), sort: r.n },
    fs: cell(r, "fs", r.fs !== null ? money(r.fs) : null, r.fsCov >= MIN, r.fsCov),
    fee: cell(r, "fee", r.fee !== null ? money(r.fee) : null, r.feeCov >= MIN, r.feeCov),
    ret: cell(r, "ret", r.ret !== null ? `${r.ret} days` : null, r.retCov >= MIN, r.retCov),
    bnpl: cell(r, "bnpl", `${r.bnpl}%`), offer: cell(r, "offer", `${r.offer}%`), bf: cell(r, "bf", `${r.bf}%`),
    shopify: cell(r, "shopify", r.shopify !== null ? `${r.shopify}%` : null),
  } }));
  const okFs = rows.filter((r) => r.fs !== null && r.fsCov >= MIN), okRet = rows.filter((r) => r.ret !== null && r.retCov >= MIN);
  const lowFs = [...okFs].sort((a, b) => a.fs! - b.fs!)[0], minRet = Math.min(...okRet.map((r) => r.ret!));
  const shortRet = okRet.filter((r) => r.ret === minRet).map((r) => SHORT[r.slug] ?? r.name);
  const topBf = [...rows].sort((a, b) => b.bf - a.bf)[0];
  const plates = Object.fromEntries(INDUSTRIES.map((i) => [i.slug, industryPlates({}, i.slug)[0]]));
  const fsVals = rows.map((r) => r.fs).filter((x): x is number => x !== null);
  return (
    <div className="h i-page">
      <Header active="/industries" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "Industries", path: "/industries", crumbs: [["Industries"]], items: rows.map((i) => ({ name: i.name, path: `/industries/${i.slug}` })) })} />
      <main>
        <section className="h-col" style={{ paddingTop: 48, paddingBottom: 40 }}>
          <p className="h-eye">Industries</p>
          <h1 style={{ margin: 0, fontSize: "clamp(36px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-1.6px", fontWeight: 800 }}>Nine industries, side by side.</h1>
          <p className="h-lede" style={{ fontSize: 18 }}>How Australian online stores compare across fashion, homewares, beauty and six more: shipping, returns, payments and offers, from {total} stores' own pages.</p>
        </section>

        <section className="h-col" style={{ paddingBottom: 64 }} aria-labelledby="score-h">
          <div className="i-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div><h2 id="score-h" className="h-h2" style={{ fontSize: 30 }}>The scorecard</h2>
              <p className="h-lede">Darker yellow is higher within each column. Click a heading to sort. Grey means fewer than {MIN}% of that industry's stores state it, too few for a fair median.</p></div>
            <ComingSoon label="Export" />
          </div>
          <div className="ov-score" style={{ marginTop: 20 }}>
            <SortTable minWidth={1100} initial="n" initialDesc rows={table} cols={[
              { key: "industry", label: "Industry" }, { key: "n", label: "Stores" }, { key: "fs", label: "Free-shipping minimum" }, { key: "fee", label: "Delivery fee" },
              { key: "ret", label: "Returns window" }, { key: "bnpl", label: "Buy now, pay later" }, { key: "offer", label: "On offer this week" },
              { key: "bf", label: "Black Friday" }, { key: "shopify", label: "On Shopify" }]} />
          </div>
        </section>

        <section className="h-band" aria-labelledby="sr-h"><div className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <p className="h-eye">Shipping and returns</p>
          <h2 id="sr-h" className="h-h2" style={{ fontSize: 30 }}>{lowFs ? `${SHORT[lowFs.slug]} sets the lowest free-shipping bar.` : ""}{shortRet.length ? ` ${shortRet.join(" and ")} ${shortRet.length > 1 ? "give" : "gives"} the shortest returns.` : ""}</h2>
          <div className="i-two">
            <div className="i-panel"><p className="i-pt">Median free-shipping minimum</p><p className="i-ps">Hollow dot: fewer than {MIN}% of that industry's stores state one</p>
              <DotRows label="Median free-shipping minimum by industry" lo={Math.floor(Math.min(...fsVals, 80) / 10) * 10} hi={Math.ceil(Math.max(...fsVals, 160) / 10) * 10}
                loText={money(Math.floor(Math.min(...fsVals, 80) / 10) * 10)!} hiText={money(Math.ceil(Math.max(...fsVals, 160) / 10) * 10)!}
                rows={rows.map((r) => ({ label: SHORT[r.slug] ?? r.name, value: r.fs, text: r.fs !== null ? money(r.fs)! : "", hollow: r.fsCov < MIN }))} /></div>
            <div className="i-panel"><p className="i-pt">Median returns window</p><p className="i-ps">Days to send an item back</p>
              <DotRows label="Median returns window by industry" lo={0} hi={40} loText="0 days" hiText="40 days" fill="#FACC15"
                rows={rows.map((r) => ({ label: SHORT[r.slug] ?? r.name, value: r.ret, text: r.ret !== null ? `${r.ret} days` : "", hollow: r.retCov < MIN }))} /></div>
          </div>
        </div></section>

        <section className="h-break" aria-labelledby="off-h"><div className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="i-two" style={{ gridTemplateColumns: "0.8fr 1.2fr", alignItems: "center", gap: 48, marginTop: 0 }}>
            <div>
              <p className="h-eye" style={{ color: "#FACC15" }}>Offers this week</p>
              <h2 id="off-h" className="h-h2" style={{ fontSize: 30, color: "#FFFFFF" }}>Nearly every industry is on sale.{topBf ? ` ${SHORT[topBf.slug]} leans hardest into Black Friday.` : ""}</h2>
              <p className="h-lede" style={{ color: "#D1D5DB" }}>Share of each industry's stores running any offer, and the share mentioning Black Friday or Cyber Monday.</p>
              <div className="i-legend" style={{ color: "#D1D5DB", marginTop: 18 }}>
                <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#FFFFFF", marginRight: 6 }} />Any offer</span>
                <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#FACC15", marginRight: 6 }} />Black Friday or Cyber Monday</span>
              </div>
            </div>
            <div className="i-panel" style={{ background: "#1F2937", borderColor: "#4B5563" }}>
              <svg viewBox={`0 0 600 ${rows.length * 38 + 10}`} width="100%" role="img" aria-label={rows.map((r) => `${SHORT[r.slug]}: ${r.offer}% on offer, ${r.bf}% Black Friday`).join("; ")}>
                {rows.map((r, i) => {
                  const y = 8 + i * 38, W = 360;
                  return (
                    <g key={r.slug}>
                      <text x="0" y={y + 17} fontFamily="Inter" fontSize="14" fill="#E5E7EB">{SHORT[r.slug]}</text>
                      <rect x="180" y={y} width={(r.offer / 100) * W} height="11" rx="3" fill="#FFFFFF" />
                      <text x={188 + (r.offer / 100) * W} y={y + 10} fontFamily="Inter" fontSize="12" fontWeight="700" fill="#FFFFFF">{r.offer}%</text>
                      <rect x="180" y={y + 14} width={(r.bf / 100) * W} height="11" rx="3" fill="#FACC15" />
                      <text x={188 + (r.bf / 100) * W} y={y + 24} fontFamily="Inter" fontSize="12" fontWeight="700" fill="#FACC15">{r.bf}%</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div></section>

        <section className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 80 }} aria-labelledby="ex-h">
          <p className="h-eye">Explore an industry</p>
          <h2 id="ex-h" className="h-h2" style={{ fontSize: 30 }}>Open any industry for its charts and every store.</h2>
          <div className="ov-cards">
            {[...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
              <Link key={r.slug} href={`/industries/${r.slug}`} className="i-panel ov-card">
                <svg viewBox="0 0 260 240" width="120" height="111" aria-hidden="true" style={{ flex: "none" }}>
                  {plates[r.slug]?.shapes.map((x, k) => <path key={k} d={x.d} fill={x.f} stroke={x.st} strokeWidth={x.sw} opacity={x.o} strokeLinejoin="round" />)}
                </svg>
                <span><b style={{ display: "block", fontSize: 17 }}>{r.name}</b><span style={{ display: "block", fontSize: 13, color: "#64748B", marginTop: 2 }}>{r.n} stores</span>
                  {r.standOut && <span style={{ display: "block", fontSize: 13, lineHeight: 1.45, color: "#334155", marginTop: 8 }}>{r.standOut}</span>}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
