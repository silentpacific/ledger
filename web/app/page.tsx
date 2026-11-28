import Link from "next/link";
import Header from "@/components/Header";
import { JsonLd } from "@/components/ui";
import Scene from "@/components/home/Scene";
import QuoteFact from "@/components/home/QuoteFact";
import ChangeExample from "@/components/home/ChangeExample";
import Plates from "@/components/home/Plates";
import NormalTabs, { type NormalRow } from "@/components/home/NormalTabs";
import Locked from "@/components/home/Locked";
import HeroLookup from "@/components/home/HeroLookup";
import { getCounts, getView } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";
import { pageSchema } from "@/lib/schema";
import type { FeedItem } from "@/lib/views";
import "./home.css";

export const revalidate = 3600;

type HomeView = {
  total: number; industries: number; onSale: { text: string; sub?: string }; afterpay: number; bnplN: number; bnplPct?: number; retMode?: number | null;
  top: FeedItem[]; totals?: { facts: number; changes: number; promotions: number } | null;
  retHist?: { slug: string; name: string; n: number; median: number | null; bins: [number, number][] } | null;
};
type Cell = { text: string };
type IndustriesView = { ind: Record<string, { sites: Cell; freeShipping: Cell; returns: Cell; bnpl: Cell; onSale: Cell }> };

const fmt = (n: number) => n.toLocaleString("en-AU");
const SHORT: Record<string, string> = { jewellery: "Jewellery", fashion: "Fashion", beauty: "Beauty", health: "Health", homewares: "Homewares", pet: "Pet",
  "baby-kids": "Baby & kids", "sports-outdoors": "Sports & outdoors", electronics: "Electronics" };
const icon = (d: React.ReactNode) => (
  <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(250,204,21,.12)", border: "1px solid rgba(250,204,21,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  </span>
);

export default async function Home() {
  const [v, iv, counts] = await Promise.all([getView<HomeView>("home"), getView<IndustriesView>("industries"), getCounts()]);
  if (!v) return <><Header /><main className="wrap page"><p className="lede">The latest numbers are being worked out. Try again in a minute.</p></main></>;
  const ind = counts?.ind ?? {};
  const pct = v.bnplPct ?? (v.total ? Math.round((100 * v.bnplN) / v.total) : 0);
  const nums = [
    [fmt(v.total), "stores tracked", "#0F172A"], [String(v.industries), "industries", "#0F172A"],
    ...(v.totals ? [[fmt(v.totals.facts), "dated facts on record", "#FACC15"], [fmt(v.totals.changes), "changes noted", "#FACC15"], [fmt(v.totals.promotions), "promotions logged", "#FACC15"]] : []),
  ];
  const rows: NormalRow[] = INDUSTRIES.filter((i) => iv?.ind?.[i.slug]).map((i) => {
    const g = iv!.ind[i.slug];
    return { slug: i.slug, name: SHORT[i.slug] ?? i.name, n: Number(g.sites.text), fs: g.freeShipping.text, ret: g.returns.text, bnpl: g.bnpl.text, sale: g.onSale.text };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const h = v.retHist;
  const X = (d: number) => 70 + Math.min(d, 100) * 10, H = (n: number) => Math.max(3, (n / Math.max(...(h?.bins ?? [[0, 1]]).map((b) => b[1]))) * 234);
  const ex = h ? [...h.bins].sort((a, b) => b[1] - a[1]).slice(0, 3).map((b) => b[0]).sort((a, b) => a - b) : [];
  const faqs: [string, string][] = [
              ["What is SentientLogs?", `A record of how Australian online stores sell: returns, shipping, payments, promotions and tech, read from each store's own pages and dated. It covers ${v.total} stores across ${v.industries} industries.`],
              ["Where does the data come from, and how do you know it's right?", "From each store's public pages. A fact counts only when two separate reads agree and the exact sentence is on the page, and every fact links to that quote."],
              ["How often is it updated?", "Promotions, products and content every week; policies, shipping, payments and tech on the 1st of each month. Every fact shows the date it was read."],
              ["Which stores do you track? Can I suggest one?", `${v.total} Australian online stores across ${v.industries} industries. Use the suggest-a-store box at the bottom of any page; we add stores whose terms allow it.`],
              ["Do you show sales, traffic or revenue?", "No. Only what a shopper can see on the store's own site. We don't estimate private numbers."],
              ["Is collecting this allowed?", "We read only public pages, obey robots.txt and skip stores whose terms forbid automated reading."],
              ["Is it free?", "Yes, everything is free right now. From early 2027 we plan to start charging for access to some parts of the data, such as change history and exports."],
              ["Can I get alerts when a competitor changes something?", "Not yet. When we introduce paid Premium accounts, we hope to include custom alerts, for example when a store you follow changes its returns, shipping, payments or promotions."],
              ["Do you cover stores outside Australia?", "Not yet. New Zealand and other countries are planned."],
            ];
  const month = new Date(counts?.latest || Date.now()).toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "Australia/Sydney" });
  const moves = v.top.filter((i) => i.tag !== "Offer").slice(0, 6);
  const shownMoves = moves.length ? moves : v.top.slice(0, 6);

  return (
    <div className="h">
      <Header />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "How Australian online stores sell", path: "/" })} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <main>
        <Scene f={{ total: v.total, onSale: v.onSale.text, bnplPct: pct, afterpay: v.afterpay, retMode: v.retMode ?? null }} />

        <section aria-labelledby="snap-h" style={{ borderTop: "1px solid #EEF2F6", borderBottom: "1px solid #EEF2F6" }}>
          <h2 id="snap-h" style={{ margin: "40px 0 0", textAlign: "center", fontSize: 15, fontWeight: 600, color: "#B45309" }}>{month} snapshot</h2>
          <div className="h-col h-nums" style={{ paddingTop: 22, paddingBottom: 44, display: "grid", gridTemplateColumns: `repeat(${nums.length}, minmax(0, ${nums.length < 4 ? "240px" : "1fr"}))`, justifyContent: "center", gap: 16 }}>
            {nums.map(([n, l]) => (
              <div key={l} style={{ minWidth: 0, textAlign: "center", border: "1px solid #4B5563", borderRadius: 14, padding: "20px 14px", background: "#FFFFFF", boxShadow: "0 2px 8px rgba(15,23,42,.08)" }}>
                <div style={{ fontSize: "clamp(28px, 2.7vw, 42px)", fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1.1 }}>{n}</div>
                <div style={{ fontSize: 14, color: "#64748B", marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        {h && h.bins.length > 2 && (
          <section className="h-break" aria-labelledby="problem-h"><div className="h-col h-sec">
            <p className="h-eye" style={{ color: "#FACC15" }}>How SentientLogs can help</p>
            <h2 id="problem-h" className="h-h2" style={{ color: "#FFFFFF" }}><span className="h-line">Three {(SHORT[h.slug] ?? h.name).toLowerCase()} stores. </span><span className="h-line">Three returns windows.</span><br />Which one should you choose?</h2>
            <p className="h-lede" style={{ color: "#D1D5DB" }}>You'd have to check every store to know. We did: {h.n} {(SHORT[h.slug] ?? h.name).toLowerCase()} stores state a returns window, and the median is {h.median} days.</p>
            <svg viewBox="0 0 1100 330" width="100%" style={{ display: "block", marginTop: 34, maxWidth: 1100 }} role="img"
              aria-label={`Bar chart of returns windows at ${h.n} ${(SHORT[h.slug] ?? h.name).toLowerCase()} stores. ${h.bins.map(([d, n]) => `${n} give ${d} days`).join("; ")}.`}>
              <line x1="60" y1="280" x2="1080" y2="280" stroke="#6B7280" />
              {[0, 7, 14, 21, 30, 60, 90].map((d) => <text key={d} x={X(d)} y="302" textAnchor="middle" fontFamily="Inter" fontSize="12" fill="#D1D5DB">{d}</text>)}
              <text x="1080" y="322" textAnchor="end" fontFamily="Inter" fontSize="12" fill="#D1D5DB">days to return{h.bins.some(([d]) => d > 100) ? " · windows over 100 days shown at 100" : ""}</text>
              {h.median != null && <><line x1={X(h.median)} y1="20" x2={X(h.median)} y2="280" stroke="#FFFFFF" strokeDasharray="4 4" />
                <text x={X(h.median) + 10} y="34" fontFamily="Inter" fontSize="13" fontWeight="700" fill="#FFFFFF">Median: {h.median} days</text></>}
              {h.bins.map(([d, n]) => (
                <g key={d}>
                  <rect x={X(d) - 7} y={280 - H(n)} width="14" height={H(n)} rx="3" fill={ex.includes(d) ? "#FACC15" : "#6B7280"} />
                  {n >= 4 && <text x={X(d)} y={272 - H(n)} textAnchor="middle" fontFamily="Inter" fontSize="12" fontWeight="700" fill="#F3F4F6">{n}</text>}
                </g>
              ))}
            </svg>
            <div className="h-grid4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16, marginTop: 20 }}>
              {ex.map((d, k) => (
                <div key={d} style={{ background: "rgba(255,255,255,.06)", border: "1px solid #4B5563", borderRadius: 14, color: "#FFFFFF", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, color: "#D1D5DB" }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#FACC15", marginRight: 8 }} />Store {"ABC"[k]}</span>
                  <b style={{ fontSize: 26, letterSpacing: "-.5px" }}>{d} days</b>
                </div>
              ))}
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 13, color: "#9CA3AF" }}>From the latest scans. Stores A, B and C stand for the three most common windows; no store is named. <Link href={`/benchmarks?industry=${h.slug}`} style={{ color: "#FFFFFF", fontWeight: 600 }}>See the benchmarks</Link></p>
          </div></section>
        )}

        <section style={{ borderTop: "1px solid #EEF2F6", overflow: "hidden" }} aria-label="How it works"><QuoteFact /></section>

        <section className="h-band" style={{ overflow: "hidden" }} aria-labelledby="moves-h">
          <h2 id="moves-h" className="sr">Market moves</h2>
          <ChangeExample />
          {shownMoves.length > 0 && (
            <div className="h-col" style={{ paddingBottom: 112 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800 }}>Spotted in the latest scans</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 12 }}>
                {shownMoves.map((i, n) => (
                  <div key={n} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#B45309" }}>{i.tag} · a {(SHORT[i.i] ?? i.ind).toLowerCase()} store</p>
                    <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{i.text}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>{i.when}</p>
                  </div>
                ))}
              </div>
              <Link href="/changes" className="h-link" style={{ display: "inline-block", marginTop: 18 }}>See every change, with store names</Link>
            </div>
          )}
        </section>

        <section className="h-col h-sec" aria-labelledby="ind-h" style={{ textAlign: "center" }}>
          <p className="h-eye">Industries</p>
          <h2 id="ind-h" className="h-h2">Nine industries, side by side.</h2>
          <p className="h-lede" style={{ margin: "14px auto 0", maxWidth: 620 }}>{v.total} Australian online stores. Pick an industry to see how its stores compare on returns, shipping, payments and promotions.</p>
          <Plates counts={ind} />
        </section>

        {rows.length > 0 && (
          <section className="h-band" aria-labelledby="normal-h">
            <div className="h-col h-sec" style={{ paddingTop: 80, paddingBottom: 80 }}>
              <h2 id="normal-h" className="h-h2">Snapshot of your industry</h2>
              <NormalTabs rows={rows} />
            </div>
          </section>
        )}


        <section className="h-dark" aria-labelledby="why-h">
          <div className="h-col h-sec" style={{ paddingTop: 96, paddingBottom: 96 }}>
            <p className="h-eye" style={{ color: "#FACC15", textAlign: "center" }}>Why SentientLogs</p>
            <h2 id="why-h" className="h-h2" style={{ color: "#FFFFFF", maxWidth: 720, margin: "0 auto 40px", textAlign: "center" }}>Facts you can check, not guesses you have to trust.</h2>
            <div className="h-grid4">
              {[
                [<><path d="M7 7h4v4c0 3-1.5 5-4 6" /><path d="M14 7h4v4c0 3-1.5 5-4 6" /></>, "Quoted and dated", "Every fact links to the store's own words and the day we read them."],
                [<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></>, "Changes over time", "Not a snapshot: we record what changed, and when."],
                [<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>, "The whole market", `${v.total} stores across ${v.industries} industries, not just your own.`],
                [<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>, "Nothing to install", "It works from a store's name or address. Look one up now."],
              ].map(([d, t, l]) => (
                <div key={t as string} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 18, padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {icon(d)}
                  <div style={{ fontWeight: 800, fontSize: 19, marginTop: 22 }}>{t}</div>
                  <div style={{ fontSize: 15, color: "#CBD5E1", marginTop: 8, lineHeight: 1.55 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="h-band" aria-labelledby="price-h">
          <div className="h-col h-sec" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", gap: 64, alignItems: "center" }}>
            <div>
              <p className="h-eye">Pricing</p>
              <h2 id="price-h" className="h-h2">Free shows what's true now. Paid shows how it got there.</h2>
              <p className="h-lede" style={{ marginBottom: 22 }}>Every store's current facts are free. Premium and Pro add change history, alerts and exports, for up to 5 people.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {[["Free", "Current facts for every store", "#E2E8F0"], ["Premium", "History and alerts", "#FACC15"], ["Pro", "Exports and full benchmarks", "#E2E8F0"]].map(([n, l, b]) => (
                  <div key={n} style={{ background: "#FFFFFF", border: `1px solid ${b}`, borderRadius: 14, padding: 16 }}><b>{n}</b><p style={{ margin: "6px 0 0", fontSize: 13, color: "#475569" }}>{l}</p></div>
                ))}
              </div>
              <Link href="/pricing" className="h-link" style={{ display: "inline-block", marginTop: 22 }}>See plans</Link>
            </div>
            <Locked feature="returns_history" plan="Premium" title="See how this changed over 12 months">
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748B" }}>Returns window · 12 months</p>
              <svg viewBox="0 0 520 170" width="100%" style={{ display: "block", marginTop: 14 }}><path d="M10 50 H300 V120 H510" fill="none" stroke="#0F172A" strokeWidth="3" /><path d="M10 150 H510" stroke="#E2E8F0" /><circle cx="300" cy="120" r="7" fill="#FACC15" /></svg>
            </Locked>
          </div>
        </section>

        <section className="h-col h-sec" aria-labelledby="faq-h" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 64 }}>
          <h2 id="faq-h" className="h-h2">FAQs</h2>
          <div>
            {faqs.map(([q, a], n, all) => (
              <details key={q} style={{ borderTop: "1px solid #E2E8F0", borderBottom: n === all.length - 1 ? "1px solid #E2E8F0" : undefined, padding: "18px 0" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 17 }}>{q}</summary>
                <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.55 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="h-dark" aria-labelledby="cta-h">
          <div className="h-col" style={{ paddingTop: 70, paddingBottom: 70, display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "space-between" }}>
            <h2 id="cta-h" className="h-h2" style={{ color: "#FFFFFF" }}>See where your store stands.</h2>
            <div style={{ flex: "0 1 560px", width: "100%" }}><HeroLookup dark /></div>
          </div>
        </section>
      </main>
    </div>
  );
}
