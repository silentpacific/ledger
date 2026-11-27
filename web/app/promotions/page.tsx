import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Stat } from "@/components/ui";
import IndustryFilter from "@/components/IndustryFilter";
import { getCounts, promoCalendar } from "@/lib/data";
import { industryName } from "@/lib/industries";
import { PROMO_TYPES, dateAU, dayKey } from "@/lib/format";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Australian ecommerce promotions calendar: who's on sale, when and how deep",
  description: "Every promotion on Australian online stores, across industries, on one timeline: who's on sale now, discount depth, how long sales run, and Black Friday compared.",
  alternates: { canonical: "/promotions" },
};

const DATES: [string, string][] = [
  ["Black Friday", "2026-11-27"], ["Cyber Monday", "2026-11-30"], ["Christmas Day", "2026-12-25"], ["Boxing Day", "2026-12-26"],
  ["Valentine's Day", "2027-02-14"], ["Mother's Day", "2027-05-09"], ["End of financial year", "2027-06-30"],
  ["Father's Day", "2027-09-05"], ["Black Friday", "2027-11-26"],
];
const DAY = 864e5;

export default async function Promotions({ searchParams }: { searchParams: Promise<{ m?: string; type?: string; view?: string; industry?: string; segment?: string; p?: string }> }) {
  const sp = await searchParams;
  const today = dayKey(new Date().toISOString());
  const month = /^\d{4}-\d{2}$/.test(sp.m || "") ? sp.m! : today.slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const start = Date.UTC(y, mo - 1, 1), end = Date.UTC(y, mo, 1), days = Math.round((end - start) / DAY);
  const prevM = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7), nextM = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  const year = sp.view === "year";
  const w0 = year ? Date.UTC(y, 0, 1) : start, w1 = year ? Date.UTC(y + 1, 0, 1) : end, span = w1 - w0;
  const nowT = Date.now();
  const byType = sp.type && PROMO_TYPES[sp.type] ? sp.type : undefined;
  // worked out in the database (web_promo_calendar): rows to draw (at most 200), pill counts and the stats
  const [cal, counts] = await Promise.all([promoCalendar(new Date(w0), new Date(w1), sp.industry, byType, year), getCounts()]);
  // 100 rows a page (the database sends the first 200)
  const ROWS = 100, pages = Math.ceil(Math.min(cal.rows.length, 200) / ROWS), pg = Math.min(Math.max(1, Number(sp.p) || 1), Math.max(1, pages));
  const shown = cal.rows.slice((pg - 1) * ROWS, pg * ROWS).map((p) => ({ p, s: [new Date(p.a).getTime(), new Date(p.b).getTime()] as const }));
  const discountCount = cal.discount_stores;
  const typeCounts = Object.entries(PROMO_TYPES).map(([k, n]) => [k, n, cal.types[k] || 0] as const)
    .filter(([k, , c]) => c > 0 || sp.type === k);
  const todayX = ((nowT - w0) / span) * 100;
  const ticks = year ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : Array.from({ length: days }, (_, i) => String(i + 1));
  const q = (o: Record<string, string | undefined>) => "/promotions?" + new URLSearchParams(Object.entries({ m: month, type: sp.type, view: sp.view, industry: sp.industry, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <Header active="/promotions" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "Promotions calendar", path: "/promotions", crumbs: [["Promotions"]], items: [...new Map(shown.map((r) => [r.p.domain, r.p.store])).entries()].map(([d, name]) => ({ name, path: `/sites/${d}` })) })} />
      <main className="wrap page">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow">Promotions calendar · {sp.industry ? industryName(sp.industry) : "All industries"}</div>
            <h1 className="title">{year ? y : dateAU(new Date(start + DAY), { month: "long", year: "numeric" })}</h1>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <Link scroll={false} aria-label="Previous" className="chip" href={q({ m: year ? `${y - 1}-${String(mo).padStart(2, "0")}` : prevM })}>‹</Link>
            <Link scroll={false} aria-label="Next" className="chip" href={q({ m: year ? `${y + 1}-${String(mo).padStart(2, "0")}` : nextM })}>›</Link>
            <Link scroll={false} className={`chip${!year ? " on" : ""}`} href={q({ view: undefined })}>Month</Link>
            <Link scroll={false} className={`chip${year ? " on" : ""}`} href={q({ view: "year" })}>Year</Link>
          </div>
        </div>

        <IndustryFilter path="/promotions" counts={counts} industry={sp.industry} keep={{ m: sp.m, type: sp.type, view: sp.view }} />

        <div className="grid g4" style={{ marginTop: 24 }}>
          <Stat k="Sites with a promotion live" v={`${cal.live_sites} of ${cal.sites}`} />
          <Stat k="Running a discount or gift" v={cal.discount_sites} />
          <Stat k="Deepest advertised" v={cal.deepest ? `Up to ${cal.deepest.pct}%` : "—"} sub={cal.deepest ? cal.deepest.store : ""} />
          <Stat k='Branded "Black Friday"' v={`${cal.bf_sites} sites`} />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 24 }}>
          <Link scroll={false} className={`chip${!sp.type ? " on" : ""}`} href={q({ type: undefined })}>Discounts &amp; gifts · {discountCount}</Link>
          {typeCounts.map(([k, n, c]) => <Link scroll={false} key={k} className={`chip${sp.type === k ? " on" : ""}`} href={q({ type: k })}>{n} · {c}</Link>)}
        </div>

        <div className="card scroll" style={{ marginTop: 16 }}>
          {shown.length === 0 ? <div className="muted">No promotions recorded in this period.</div> : (
            <div style={{ minWidth: 980 }}>
              <div style={{ display: "flex", fontSize: 11, color: "var(--muted)", paddingBottom: 6, borderBottom: "1px solid var(--line2)" }}>
                <span style={{ flex: "0 0 170px" }} />
                <span style={{ flex: "1 1 auto", display: "grid", gridTemplateColumns: `repeat(${ticks.length}, minmax(0,1fr))`, textAlign: year ? "left" : "center" }}>{ticks.map((t) => <span key={t}>{t}</span>)}</span>
                <span style={{ flex: "0 0 280px", paddingLeft: 14 }}>{year ? "Promotion" : "Headline offer"}</span>
              </div>
              {shown.map(({ p, s }, i) => {
                const a = Math.max(s[0], w0), b = Math.min(s[1], w1);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", height: sp.industry ? 36 : 42, borderBottom: "1px solid #F4F2EC", fontSize: 13 }}>
                    <Link href={`/sites/${p.domain}`} style={{ flex: "0 0 170px", color: "var(--ink)", fontWeight: 500, lineHeight: 1.15, overflow: "hidden" }}>{p.store}{!sp.industry && <span className="tiny muted" style={{ display: "block", fontWeight: 400 }}>{industryName(p.industry)}</span>}</Link>
                    <span style={{ flex: "1 1 auto", position: "relative", height: 18 }}>
                      {todayX > 0 && todayX < 100 && <span style={{ position: "absolute", top: -9, bottom: -9, left: `${todayX}%`, width: 2, background: "#D97A1F" }} />}
                      <span title={`${dateAU(s[0])} – ${p.live && !p.ends ? "still running" : dateAU(s[1] - DAY)}`} style={{ position: "absolute", top: 0, height: 18, borderRadius: 4, left: `${((a - w0) / span) * 100}%`, width: `${Math.max(0.8, ((b - a) / span) * 100)}%`, background: p.starts ? "var(--accent)" : "var(--accent-light)" }} />
                    </span>
                    <span title={p.discount || ""} style={{ flex: "0 0 280px", paddingLeft: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}{p.discount && p.pct && !p.name.includes(String(p.pct)) ? ` · ${p.discount}` : ""}</span>
                  </div>
                );
              })}
              {cal.shown > ROWS && (
                <div className="row small" style={{ gap: 8, marginTop: 12, alignItems: "center" }}>
                  <span className="muted">Showing {(pg - 1) * ROWS + 1}–{(pg - 1) * ROWS + shown.length} of {cal.shown}, by industry and store{cal.shown > 200 ? " (the first 200 can be paged; pick an industry or a kind of offer to narrow it)" : ""}.</span>
                  {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} scroll={false} className={`chip${n === pg ? " on" : ""}`} href={q({ p: n > 1 ? String(n) : undefined })}>{n}</Link>)}
                </div>
              )}
              <div className="row tiny muted" style={{ gap: 20, marginTop: 12 }}>
                <span><span style={{ display: "inline-block", width: 14, height: 10, borderRadius: 2, background: "var(--accent)", verticalAlign: "middle" }} /> Dates stated by the store</span>
                <span><span style={{ display: "inline-block", width: 14, height: 10, borderRadius: 2, background: "var(--accent-light)", verticalAlign: "middle" }} /> Dates from when we saw it (tracking began 26 Nov 2026)</span>
                <span><span style={{ display: "inline-block", width: 2, height: 12, background: "#D97A1F", verticalAlign: "middle" }} /> Today</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid g2" style={{ marginTop: 24 }}>
          <section className="card">
            <h2 style={{ marginBottom: 12 }}>Key retail dates ahead</h2>
            {DATES.filter(([, d]) => d >= today).slice(0, 7).map(([n, d]) => (
              <div key={n + d} className="kv"><span>{n}</span><span className="muted">{dateAU(d + "T12:00:00", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span></div>
            ))}
          </section>
          <section className="card">
            <h2 style={{ marginBottom: 12 }}>How this builds up</h2>
            <p className="small" style={{ margin: 0, lineHeight: 1.6, color: "var(--body)" }}>Each weekly scan records when an offer first appears and when it disappears, so start and end dates fill in over time. Some stores publish their past offers with dates in their offer terms; those appear in the year view.</p>
            <Link href={q({ view: "year" })} className="small" style={{ display: "inline-block", marginTop: 12, fontWeight: 600 }}>See the full year →</Link>
          </section>
        </div>
      </main>
    </>
  );
}
