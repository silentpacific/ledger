import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Stat } from "@/components/ui";
import { getPromotions, getSites, Promo } from "@/lib/data";
import { PROMO_TYPES, dateAU, dayKey, isDiscount, maxPct, siteName } from "@/lib/format";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Australian jewellery promotions calendar: who's on sale, when and how deep",
  description: "Every promotion on Australian online jewellery stores on one timeline: who's on sale now, discount depth, how long sales run, and Black Friday compared.",
  alternates: { canonical: "/promotions" },
};

const DATES: [string, string][] = [
  ["Black Friday", "2026-11-27"], ["Cyber Monday", "2026-11-30"], ["Christmas Day", "2026-12-25"], ["Boxing Day", "2026-12-26"],
  ["Valentine's Day", "2027-02-14"], ["Mother's Day", "2027-05-09"], ["End of financial year", "2027-06-30"],
  ["Father's Day", "2027-09-05"], ["Black Friday", "2027-11-26"],
];
const DAY = 864e5;

export default async function Promotions({ searchParams }: { searchParams: Promise<{ m?: string; type?: string; view?: string }> }) {
  const sp = await searchParams;
  const [promos, sites] = await Promise.all([getPromotions(), getSites()]);
  const today = dayKey(new Date().toISOString());
  const month = /^\d{4}-\d{2}$/.test(sp.m || "") ? sp.m! : today.slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const start = Date.UTC(y, mo - 1, 1), end = Date.UTC(y, mo, 1), days = Math.round((end - start) / DAY);
  const prevM = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7), nextM = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  const year = sp.view === "year";
  const w0 = year ? Date.UTC(y, 0, 1) : start, w1 = year ? Date.UTC(y + 1, 0, 1) : end, span = w1 - w0;
  const nowT = Date.now();

  const span_ = (p: Promo) => {
    const a = new Date(p.starts || p.first_seen).getTime();
    const b = p.ends ? new Date(p.ends).getTime() + DAY : p.live ? nowT : new Date(p.last_seen).getTime() + DAY;
    return [a, Math.max(b, a + DAY)] as const;
  };
  const byType = sp.type && PROMO_TYPES[sp.type];
  const rows = promos.filter((p) => (byType ? p.type === sp.type : isDiscount(p)))
    .map((p) => ({ p, s: span_(p) })).filter(({ s }) => s[1] > w0 && s[0] < w1)
    .sort((a, b) => siteName(a.p.domain).localeCompare(siteName(b.p.domain)) || maxPct(b.p) - maxPct(a.p));
  // one row per site in the month view: its deepest offer
  const shown = year ? rows : [...new Map(rows.map((r) => [r.p.domain, r] as const)).values()]
    .map((r) => rows.filter((x) => x.p.domain === r.p.domain).sort((a, b) => maxPct(b.p) - maxPct(a.p))[0]);

  const live = promos.filter((p) => p.live);
  const liveSites = new Set(live.map((p) => p.domain));
  const discountSites = new Set(live.filter(isDiscount).map((p) => p.domain));
  const deepest = live.filter(isDiscount).sort((a, b) => maxPct(b) - maxPct(a))[0];
  const bf = new Set(live.filter((p) => /black friday/i.test(`${p.name} ${p.discount}`)).map((p) => p.domain));
  const typeCounts = Object.entries(PROMO_TYPES).map(([k, n]) => [k, n, new Set(live.filter((p) => p.type === k).map((p) => p.domain)).size] as const).filter(([, , c]) => c > 0);
  const todayX = ((nowT - w0) / span) * 100;
  const ticks = year ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : Array.from({ length: days }, (_, i) => String(i + 1));
  const q = (o: Record<string, string | undefined>) => "/promotions?" + new URLSearchParams(Object.entries({ m: month, type: sp.type, view: sp.view, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <Header active="/promotions" />
      <main className="wrap page">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow">Promotions calendar · Jewellery</div>
            <h1 className="title">{year ? y : dateAU(new Date(start + DAY), { month: "long", year: "numeric" })}</h1>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <Link aria-label="Previous" className="chip" href={q({ m: year ? `${y - 1}-${String(mo).padStart(2, "0")}` : prevM })}>‹</Link>
            <Link aria-label="Next" className="chip" href={q({ m: year ? `${y + 1}-${String(mo).padStart(2, "0")}` : nextM })}>›</Link>
            <Link className={`chip${!year ? " on" : ""}`} href={q({ view: undefined })}>Month</Link>
            <Link className={`chip${year ? " on" : ""}`} href={q({ view: "year" })}>Year</Link>
          </div>
        </div>

        <div className="grid g4" style={{ marginTop: 24 }}>
          <Stat k="Sites with a promotion live" v={`${liveSites.size} of ${sites.length}`} />
          <Stat k="Running a discount or gift" v={discountSites.size} />
          <Stat k="Deepest advertised" v={deepest ? `Up to ${maxPct(deepest)}%` : "—"} sub={deepest ? siteName(deepest.domain) : ""} />
          <Stat k='Branded "Black Friday"' v={`${bf.size} sites`} />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 24 }}>
          <Link className={`chip${!sp.type ? " on" : ""}`} href={q({ type: undefined })}>Discounts &amp; gifts</Link>
          {typeCounts.map(([k, n, c]) => <Link key={k} className={`chip${sp.type === k ? " on" : ""}`} href={q({ type: k })}>{n} · {c}</Link>)}
        </div>

        <div className="card scroll" style={{ marginTop: 16 }}>
          {shown.length === 0 ? <div className="muted">No promotions recorded in this period.</div> : (
            <div style={{ minWidth: 980 }}>
              <div style={{ display: "flex", fontSize: 11, color: "var(--muted)", paddingBottom: 6, borderBottom: "1px solid var(--line2)" }}>
                <span style={{ flex: "0 0 170px" }} />
                <span style={{ flex: "1 1 auto", display: "grid", gridTemplateColumns: `repeat(${ticks.length}, minmax(0,1fr))`, textAlign: year ? "left" : "center" }}>{ticks.map((t) => <span key={t}>{t}</span>)}</span>
                <span style={{ flex: "0 0 280px", paddingLeft: 14 }}>{year ? "Promotion" : "Headline offer"}</span>
              </div>
              {shown.slice(0, 80).map(({ p, s }, i) => {
                const a = Math.max(s[0], w0), b = Math.min(s[1], w1);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", height: 36, borderBottom: "1px solid #F4F2EC", fontSize: 13 }}>
                    <Link href={`/sites/${p.domain}`} style={{ flex: "0 0 170px", color: "var(--ink)", fontWeight: 500 }}>{siteName(p.domain)}</Link>
                    <span style={{ flex: "1 1 auto", position: "relative", height: 18 }}>
                      {todayX > 0 && todayX < 100 && <span style={{ position: "absolute", top: -9, bottom: -9, left: `${todayX}%`, width: 2, background: "#D97A1F" }} />}
                      <span title={`${dateAU(s[0])} – ${p.live && !p.ends ? "still running" : dateAU(s[1] - DAY)}`} style={{ position: "absolute", top: 0, height: 18, borderRadius: 4, left: `${((a - w0) / span) * 100}%`, width: `${Math.max(0.8, ((b - a) / span) * 100)}%`, background: p.starts ? "var(--accent)" : "var(--accent-light)" }} />
                    </span>
                    <span title={p.discount || ""} style={{ flex: "0 0 280px", paddingLeft: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}{p.discount && maxPct(p) && !p.name.includes(String(maxPct(p))) ? ` · ${p.discount}` : ""}</span>
                  </div>
                );
              })}
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
