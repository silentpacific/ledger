import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { JsonLd } from "@/components/ui";
import { getView, listSitesSorted, PAGE_SIZE } from "@/lib/data";
import StoreTable, { Pager } from "@/components/StoreTable";
import { INDUSTRIES } from "@/lib/industries";
import { dateAU } from "@/lib/format";
import { pageSchema } from "@/lib/schema";
import { Columns, Donut, HBars, medianBand, Split, type Pair } from "@/components/charts";
import ComingSoon from "@/components/ComingSoon";
import Locked from "@/components/home/Locked";
import "../../home.css";

export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => INDUSTRIES.map((i) => ({ slug: i.slug }));

const SHORT: Record<string, string> = { jewellery: "jewellery", fashion: "fashion", beauty: "beauty", health: "health", homewares: "homewares", pet: "pet",
  "baby-kids": "baby & kids", "sports-outdoors": "sports & outdoors", electronics: "electronics" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const i = INDUSTRIES.find((x) => x.slug === slug);
  if (!i) return {};
  return {
    title: `${i.name}: Australian online stores compared`,
    description: `Free-shipping minimums, delivery fees, returns, buy now pay later, platforms and this week's promotions across Australian ${i.name.toLowerCase()} stores, dated and sourced.`,
    alternates: { canonical: `/industries/${slug}` },
  };
}

type V = {
  n: number; latest: string; fs: string | null; fsN: number; ret: number | null; retN: number; bnplN: number; prov: { label: string; n: number }[];
  fsBins?: Pair[]; feeBins?: Pair[]; retBins?: Pair[]; fee?: string | null; feeN?: number; com?: Pair[]; payer?: Pair[]; platforms?: Pair[]; platformN?: number;
  offerN?: number; bf?: number; depth?: Pair[]; kinds?: Pair[];
};
const pc = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const AMBER = ["#CBD5E1", "#FDE68A", "#FCD34D", "#FBBF24", "#F59E0B", "#D97706", "#B45309"];

export default async function IndustryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; sort?: string; dir?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const ind = INDUSTRIES.find((x) => x.slug === slug);
  if (!ind) notFound();
  const [v, list] = await Promise.all([getView<V>(`industry:${slug}`), listSitesSorted({ industry: slug, page, sort: sp.sort, dir: sp.dir })]);
  const n = v?.n ?? 0, latest = v?.latest ?? "", short = SHORT[slug] ?? ind.name.toLowerCase();
  const com = v?.com ?? [], payer = v?.payer ?? [], retBins = v?.retBins ?? [];
  const comCond = com.find((c) => c[0] === "With conditions")?.[1] ?? 0, comN = com.reduce((a, c) => a + c[1], 0);
  const shopper = payer.find((c) => c[0] === "Shopper")?.[1] ?? 0, payerN = payer.reduce((a, c) => a + c[1], 0);
  const upTo14 = (retBins[0]?.[1] ?? 0) + (retBins[1]?.[1] ?? 0);
  const topProv = v?.prov?.[0], plats = v?.platforms ?? [], platN = v?.platformN ?? 0, topPlat = plats[0];
  const offerN = v?.offerN ?? 0;
  return (
    <div className="h i-page">
      <Header active="/industries" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: ind.name, path: `/industries/${slug}`, crumbs: [["Industries", "/industries"], [ind.name]], items: list.rows.map((s) => ({ name: s.name, path: `/sites/${s.domain}` })) })} />
      <main>
        <section className="h-col" style={{ paddingTop: 40, paddingBottom: 36 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}><Link href="/industries" style={{ color: "#64748B" }}>Industries</Link> / {ind.name}</p>
          <div className="i-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "clamp(36px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-1.6px", fontWeight: 800 }}>{ind.name}</h1>
              <p className="h-lede" style={{ marginTop: 12 }}>{n ? `${n} Australian ${short} stores, read every week.${latest ? ` Figures from the latest scans, ${dateAU(latest)}.` : ""}` : "The first stores are being scanned now; they'll appear here as soon as their scans finish."}</p>
            </div>
            <div className="i-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/compare" className="h-btn" style={{ height: 46, fontSize: 15 }}>Compare {short} stores</Link>
              <ComingSoon label="Export" />
            </div>
          </div>
        </section>

        {v && n > 0 && <>
          <section className="h-col" style={{ paddingBottom: 56 }}>
            <div className="i-figs">
              {[[v.fs ?? "—", "median free-shipping minimum", `${v.fsN} of ${n} state one`], [v.fee ?? "—", "median delivery fee", `${v.feeN ?? 0} of ${n} state one`],
                [v.ret != null ? `${v.ret} days` : "—", "median returns window", `${v.retN} of ${n} state one`], [`${pc(v.bnplN, n)}%`, "offer buy now, pay later", `${v.bnplN} of ${n} stores`],
                [`${pc(offerN, n)}%`, "ran an offer this week", `${offerN} of ${n} stores`]].map(([a, b, c]) => (
                <div key={b} className="i-fig"><b>{a}</b><span>{b}</span><small>{c}</small></div>
              ))}
            </div>
          </section>

          {v.fsBins && (
            <section className="h-band" aria-labelledby="ship-h"><div className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }}>
              <p className="h-eye">Shipping</p>
              <h2 id="ship-h" className="h-h2" style={{ fontSize: 30 }}>{v.fs ? `Half of ${short} stores set free shipping at ${v.fs} or less.` : `Few ${short} stores state a free-shipping minimum.`}</h2>
              <p className="h-lede">{v.fsN} of {n} stores state a minimum.{v.fee ? ` The usual delivery fee below it is ${v.fee}.` : ""}</p>
              <div className="i-two">
                <div className="i-panel"><p className="i-pt">Free-shipping minimum</p><p className="i-ps">{v.fsN} of {n} stores state one{v.fs ? ` · median ${v.fs}` : ""}</p>
                  <Columns data={v.fsBins} hi={medianBand(v.fsBins)} label="Free-shipping minimums" /></div>
                <div className="i-panel"><p className="i-pt">Standard delivery fee</p><p className="i-ps">{v.feeN} of {n} stores state one{v.fee ? ` · median ${v.fee}` : ""}</p>
                  <Columns data={v.feeBins ?? []} hi={medianBand(v.feeBins ?? [])} label="Delivery fees" /></div>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 13, color: "#64748B" }}>Yellow marks the band that holds the middle store.</p>
            </div></section>
          )}

          {retBins.length > 0 && (
            <section className="h-break" aria-labelledby="ret-h"><div className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }}>
              <p className="h-eye" style={{ color: "#FACC15" }}>Returns</p>
              <h2 id="ret-h" className="h-h2" style={{ fontSize: 30, color: "#FFFFFF" }}>{v.ret != null ? `${v.ret} days is the typical returns window${v.retN && pc(upTo14, v.retN) >= 20 ? `, but ${pc(upTo14, v.retN)}% give 14 days or less` : ""}.` : "Returns windows"}</h2>
              <p className="h-lede" style={{ color: "#D1D5DB" }}>{comN ? `${pc(comCond, comN)}% allow change-of-mind returns only with conditions` : ""}{comN && payerN ? ", and " : ""}{payerN ? `${pc(shopper, payerN)}% make the shopper pay return postage` : ""}{comN || payerN ? "." : ""}</p>
              <div className="i-two" style={{ gridTemplateColumns: "1.15fr 1fr" }}>
                <div className="i-panel"><p className="i-pt">Returns window</p><p className="i-ps">{v.retN} of {n} stores state one{v.ret != null ? ` · median ${v.ret} days` : ""}</p>
                  <Columns data={retBins} hi={medianBand(retBins)} label="Returns windows in days" /></div>
                <div className="i-panel" style={{ display: "flex", flexDirection: "column", gap: 26 }}>
                  {com.length > 0 && <div><p className="i-pt">Change-of-mind returns</p><p className="i-ps">{comN} stores state a rule</p><Split parts={com} colors={["#0F172A", "#0E7C6B", "#B45309", "#FACC15"]} /></div>}
                  {payer.length > 0 && <div><p className="i-pt">Who pays return postage</p><p className="i-ps">{payerN} stores state it</p><Split parts={payer} colors={["#0F172A", "#94A3B8", "#0E7C6B"]} /></div>}
                </div>
              </div>
            </div></section>
          )}

          <section className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }} aria-labelledby="pay-h">
            <p className="h-eye">Payments and platform</p>
            <h2 id="pay-h" className="h-h2" style={{ fontSize: 30 }}>{topProv ? `${topProv.label} is at ${pc(topProv.n, n)}% of ${short} stores.` : "Payments"}{topPlat && platN ? ` ${topPlat[0]} runs ${pc(topPlat[1], platN)}%.` : ""}</h2>
            <div className="i-two" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
              <div className="i-panel"><p className="i-pt">Buy now, pay later providers</p><p className="i-ps">Share of all {n} {short} stores · {v.bnplN} offer at least one</p>
                {v.prov.length ? <HBars rows={v.prov.slice(0, 6).map((p) => [p.label, p.n] as Pair)} of={n} colors={["#0F172A", "#1D4ED8", "#0E7C6B", "#B45309", "#94A3B8", "#FACC15"]} />
                  : <p className="i-ps" style={{ marginTop: 16 }}>No buy now, pay later options found yet.</p>}</div>
              <div className="i-panel"><p className="i-pt">Store platform</p><p className="i-ps">{platN} of {n} stores where we could tell</p>
                {plats.length ? <Donut parts={plats} colors={["#0F172A", "#FACC15", "#0E7C6B", "#1D4ED8", "#B45309", "#94A3B8"]} centre={`${pc(plats[0][1], platN)}%`} sub={plats[0][0]} />
                  : <p className="i-ps" style={{ marginTop: 16 }}>Not detected yet.</p>}</div>
            </div>
          </section>

          {v.depth && offerN > 0 && (
            <section className="h-break" aria-labelledby="promo-h"><div className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 64 }}>
              <p className="h-eye" style={{ color: "#FACC15" }}>Promotions this week</p>
              <h2 id="promo-h" className="h-h2" style={{ fontSize: 30, color: "#FFFFFF" }}>{pc(offerN, n)}% of {short} stores ran an offer.{v.bf ? ` ${v.bf} mentioned Black Friday or Cyber Monday.` : ""}</h2>
              <div className="i-two" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
                <div className="i-panel"><p className="i-pt">Deepest discount advertised</p><p className="i-ps">{offerN} stores with an offer, by their biggest percentage off</p>
                  <Columns data={v.depth} colors={AMBER} label="Deepest advertised discount" /></div>
                <div className="i-panel"><p className="i-pt">Kinds of offer</p><p className="i-ps">Stores running each kind this week</p>
                  <HBars rows={v.kinds ?? []} of={Math.max(1, ...(v.kinds ?? []).map((k) => k[1]))} colors="#F59E0B" track="#FEF3C7" pct={false} /></div>
              </div>
              <Link href={`/promotions?industry=${slug}`} className="h-link" style={{ display: "inline-block", marginTop: 20, color: "#FFFFFF" }}>See every {short} promotion</Link>
            </div></section>
          )}

          <section className="h-col h-sec" style={{ paddingTop: 64, paddingBottom: 40 }} aria-labelledby="time-h">
            <div className="i-two" style={{ alignItems: "center", gap: 48, marginTop: 0 }}>
              <div><p className="h-eye">Over time</p><h2 id="time-h" className="h-h2" style={{ fontSize: 30 }}>How {short}'s free-shipping minimum and returns window have moved.</h2>
                <p className="h-lede">Every change is dated, so you can see when the market shifted and who moved first.</p></div>
              <Locked feature={`industry_trends_${slug}`} plan="Premium" title={`See 12 months of ${short} trends`}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748B" }}>Median free-shipping minimum · 12 months</p>
                <svg viewBox="0 0 520 150" width="100%" style={{ display: "block", marginTop: 12 }}><path d="M10 60 L90 60 L170 70 L250 70 L330 50 L410 55 L510 40" fill="none" stroke="#0F172A" strokeWidth="3" /><path d="M10 130 H510" stroke="#E2E8F0" /></svg>
              </Locked>
            </div>
          </section>

          <section className="h-col" style={{ paddingTop: 40, paddingBottom: 80 }} aria-labelledby="stores-h">
            <p className="h-eye">Stores</p>
            <h2 id="stores-h" className="h-h2" style={{ fontSize: 30 }}>All {n} {short} stores</h2>
            <div className="i-panel i-table" style={{ padding: "4px 12px", marginTop: 20, textAlign: "left" }}><StoreTable rows={list.rows} industry={false} sort={{ key: sp.sort, dir: sp.dir, href: (k, d) => `/industries/${slug}?sort=${k}&dir=${d}#stores-h` }} /></div>
            <Pager page={page} total={list.total} size={PAGE_SIZE} href={(p) => `/industries/${slug}?${new URLSearchParams(Object.entries({ page: p > 1 ? String(p) : "", sort: sp.sort ?? "", dir: sp.dir ?? "" }).filter(([, x]) => x))}#stores-h`} />
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748B" }}>"Not stated" means the store doesn't publish it, not that it isn't offered.</p>
          </section>
        </>}
      </main>
    </div>
  );
}
