import Link from "next/link";
import Header from "@/components/Header";
import { Bars, Stat } from "@/components/ui";
import IndustryFilter from "@/components/IndustryFilter";
import SitePicker from "@/components/SitePicker";
import StoreLookup, { type Profile } from "@/components/StoreLookup";
import { filterSites, getChanges, getPromotions, getSites, industryOf, promotionsFor, Promo, Site } from "@/lib/data";
import { INDUSTRIES, industryName } from "@/lib/industries";
import { nextMonthly, nextWeekly, TRACKING_BEGAN } from "@/lib/schedule";
import { COVERAGE, groupStats } from "@/lib/stats";
import { PLUMBING, TECH_ORDER, techCategory } from "@/lib/tech";
import { dateAU, dayKey, describeChange, facets, label, list, maxPct, median, money, num, show, siteName, isDiscount, val } from "@/lib/format";

export const revalidate = 3600;

type Item = { at: string; tag: string; site: string; domain: string; ind: string; text: string; when: string; sig: string };

const DAY = 864e5;
// never put these forward as examples (Curasept is Rahul's client: ask before featuring it)
const NOT_FEATURED = new Set(["curasept.com.au"]);
const short = (d: string | Date) => dateAU(d, { day: "numeric", month: "short", year: "numeric" });

export default async function Home({ searchParams }: { searchParams: Promise<{ f?: string; industry?: string; segment?: string; site?: string }> }) {
  const { f = "all", industry, segment, site } = await searchParams;
  const [all, promosAll, changes] = await Promise.all([getSites(), getPromotions(), getChanges(60)]);
  const byDomainAll = new Map(all.map((s) => [s.domain, s]));
  const allStats = groupStats(all, promosAll);
  const latest = all.reduce((a, s) => (s.last_scanned_at > a ? s.last_scanned_at : a), "");

  // ---- market numbers (all stores) ----
  const bnplSites = all.filter((s) => list(s, "payments.bnpl_providers").length);
  const afterpay = bnplSites.filter((s) => list(s, "payments.bnpl_providers").includes("afterpay")).length;
  const thresholds = all.map((s) => num(s, "shipping.free_shipping_threshold")).filter((x): x is number => x !== undefined);

  // ---- one-line findings, worked out from the data ----
  const groups = INDUSTRIES.map((i) => ({ i, xs: filterSites(all, i.slug) })).filter((g) => g.xs.length >= 5)
    .map((g) => ({ ...g, st: groupStats(g.xs, promotionsFor(promosAll, g.xs)) }));
  const mostOnSale = [...groups].sort((a, b) => (b.st.onSale.sort ?? 0) - (a.st.onSale.sort ?? 0))[0];
  const cheapestShip = groups.filter((g) => g.st.freeShipping.enough).sort((a, b) => (a.st.freeShipping.sort ?? 0) - (b.st.freeShipping.sort ?? 0))[0];
  const firstScan = new Map(all.map((s) => [s.domain, new Date(s.first_scanned_at).getTime()]));
  const newOffers = new Set(promosAll.filter((p) => p.live && isDiscount(p) && Date.now() - new Date(p.first_seen).getTime() < 7 * DAY
    && new Date(p.first_seen).getTime() - (firstScan.get(p.domain) ?? 0) > 36e5).map((p) => p.domain));
  const deepest = promosAll.filter((p) => p.live && isDiscount(p) && byDomainAll.has(p.domain)).sort((a, b) => maxPct(b) - maxPct(a))[0];
  const findings: { text: string; href: string }[] = [];
  if (mostOnSale) findings.push({ text: `${mostOnSale.i.name} has the most stores on sale right now: ${mostOnSale.st.onSale.text} of ${mostOnSale.xs.length}.`, href: `/promotions?industry=${mostOnSale.i.slug}` });
  if (cheapestShip) findings.push({ text: `${cheapestShip.i.name} has the lowest median free-shipping minimum, at ${cheapestShip.st.freeShipping.text}.`, href: `/benchmarks?industry=${cheapestShip.i.slug}#ship` });
  findings.push(newOffers.size
    ? { text: `${newOffers.size} ${newOffers.size === 1 ? "store has an offer" : "stores have offers"} we first saw in the last 7 days. With tracking this new, some may have been running before we started.`, href: "/promotions" }
    : deepest ? { text: `Deepest discount advertised right now: up to ${maxPct(deepest)}% at ${siteName(deepest.domain)}.`, href: `/sites/${deepest.domain}` }
    : { text: "No discounts are running at the moment.", href: "/promotions" });
  if (bnplSites.length) findings.push({ text: `Afterpay is the most common buy now, pay later option: ${Math.round((100 * afterpay) / bnplSites.length)}% of stores where we found one.`, href: "/explore/payments/afterpay" });

  // ---- the activity feed (filterable) ----
  const scoped = filterSites(all, industry, segment);
  const sites = site ? scoped.filter((s) => s.domain === site) : scoped;
  const byDomain = new Map(sites.map((s) => [s.domain, s]));
  const promos = promotionsFor(promosAll, sites);
  const items: Item[] = [];
  for (const c of changes.filter((c) => c.confirmed)) {
    const s = byDomain.get(c.domain);
    if (!s) continue;
    const d = describeChange(c);
    const cat = c.category.replace(/_/g, " ");
    items.push({ at: c.at, tag: cat.charAt(0).toUpperCase() + cat.slice(1), site: siteName(c.domain), domain: c.domain, ind: industryName(industryOf(s)),
      text: d.text.charAt(0).toUpperCase() + d.text.slice(1), when: `Changed between scans · confirmed ${short(c.at)}`, sig: d.significance });
  }
  const best = new Map<string, Promo>();
  promos.filter((p) => p.live && isDiscount(p) && Date.now() - new Date(p.last_seen).getTime() < 7 * DAY)
    .forEach((p) => { const b = best.get(p.domain); if (!b || maxPct(p) > maxPct(b)) best.set(p.domain, p); });
  for (const p of best.values()) {
    const s = byDomain.get(p.domain)!;
    const isNew = new Date(p.first_seen).getTime() - new Date(s.first_scanned_at).getTime() > 36e5;
    const offer = `${p.name}${p.discount && !p.name.toLowerCase().includes(p.discount.toLowerCase().slice(0, 12)) ? `: ${p.discount}` : ""}`;
    items.push({ at: p.first_seen, tag: isNew ? "Offer first seen this week" : "Offer running", site: siteName(p.domain), domain: p.domain, ind: industryName(industryOf(s)),
      text: offer, when: `First seen ${short(p.first_seen)} · last confirmed ${short(p.last_seen)}${p.ends ? ` · ends ${short(p.ends)}` : ""}`,
      sig: maxPct(p) >= 30 ? "High" : "Medium" });
  }
  const rank = (x: Item) => (x.sig === "High" ? 2 : x.sig === "Medium" ? 1 : 0);
  const top = [...items].sort((a, b) => rank(b) - rank(a) || (a.at < b.at ? 1 : -1)).slice(0, 6);
  const shown = items.filter((i) => f === "all" || i.tag.toLowerCase().startsWith(f) || (f === "promotion" && i.tag.includes("ffer")));
  const days = new Map<string, Item[]>();
  shown.sort((a, b) => (a.at < b.at ? 1 : -1)).forEach((i) => { const k = dayKey(i.at); days.set(k, [...(days.get(k) || []), i]); });
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ f: f === "all" ? undefined : f, industry, segment, site, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return `/${p ? `?${p}` : ""}#activity`;
  };
  const FILTERS = [["all", "All"], ["promotion", "Promotions"], ["shipping", "Shipping"], ["payments", "Payments"], ["policies", "Policies"], ["tech", "Tech"]];

  // ---- compare entry ----
  const options = [...all].sort((a, b) => siteName(a).localeCompare(siteName(b))).map((s) => ({ domain: s.domain, name: siteName(s), industry: industryName(industryOf(s)) }));
  const richest = (xs: Site[]) => [...xs].filter((s) => !NOT_FEATURED.has(s.domain)).sort((a, b) => Object.keys(b.facts).length - Object.keys(a.facts).length).slice(0, 3);
  const suggestions = [...groups].sort((a, b) => b.xs.length - a.xs.length).slice(0, 3)
    .map((g) => ({ name: g.i.name, sites: richest(g.xs) })).filter((g) => g.sites.length >= 2);
  const fc = facets(all);
  const bnplRows = fc.payments.filter((x) => !["apple-pay", "google-pay", "paypal", "shop-pay"].includes(x.value))
    .map((x: any) => ({ label: x.name, n: x.n, text: `${x.n} of ${bnplSites.length}`, href: `/explore/payments/${x.value}` }));
  const tools = fc.tech.filter((x) => !PLUMBING.has(techCategory(x.name))).slice(0, 8);
  const weekly = nextWeekly(), monthly = nextMonthly();

  // ---- the hero's store records ----
  const liveBest = new Map<string, Promo>();
  promosAll.filter((p) => p.live).forEach((p) => { const b = liveBest.get(p.domain); if (!b || maxPct(p) > maxPct(b) || (!isDiscount(b) && isDiscount(p))) liveBest.set(p.domain, p); });
  const coreCount = (s: Site) => ["shipping.free_shipping_threshold", "shipping.standard_shipping_cost", "policies.returns.period_days",
    "policies.returns.change_of_mind"].filter((k) => show(s, k) !== "Not stated").length;
  const profiles: Profile[] = [...all].sort((a, b) => siteName(a).localeCompare(siteName(b))).map((s) => {
    const fs = num(s, "shipping.free_shipping_threshold"), rd = num(s, "policies.returns.period_days");
    const offer = liveBest.get(s.domain);
    const tech = ((val(s, "tech_stack.technologies") as string[] | undefined) || []).filter((t) => !PLUMBING.has(techCategory(t)))
      .sort((a, b) => TECH_ORDER.indexOf(techCategory(a)) - TECH_ORDER.indexOf(techCategory(b))); // commerce tools before ad pixels
    const opt = (v: string) => (v === "Not stated" ? null : v);
    const peers = all.filter((x) => x.domain !== s.domain && industryOf(x) === industryOf(s) && !NOT_FEATURED.has(x.domain))
      .sort((a, b) => coreCount(b) - coreCount(a)).slice(0, 2).map((x) => x.domain);
    return {
      domain: s.domain, name: siteName(s), industry: industryName(industryOf(s)), checked: short(s.last_scanned_at), peers,
      rows: [
        ["Free shipping over", fs === undefined ? null : fs === 0 ? "Free on every order" : money(fs)],
        ["Standard delivery", opt(show(s, "shipping.standard_shipping_cost", (v) => money(v) ?? String(v)))],
        ["Returns window", rd === undefined ? null : `${rd} days`],
        ["Change of mind", opt(show(s, "policies.returns.change_of_mind"))],
        ["Buy now, pay later", list(s, "payments.bnpl_providers").map(label).join(", ") || null],
        ["Running now", offer ? `${offer.name}${offer.discount && !offer.name.toLowerCase().includes(offer.discount.toLowerCase().slice(0, 10)) ? `: ${offer.discount}` : ""}` : "No offer seen this week"],
        ["Tools", tech.length ? `${tech.slice(0, 2).join(", ")}${tech.length > 2 ? ` and ${tech.length - 2} more` : ""}` : null],
      ] as [string, string | null][],
    };
  });
  const complete = all.filter((s) => !NOT_FEATURED.has(s.domain) && coreCount(s) === 4).sort((a, b) => a.domain.localeCompare(b.domain));
  const start = (complete[new Date().getUTCDate() % Math.max(1, complete.length)] ?? all[0]).domain; // a different full record each day
  const FAMOUS = ["lovisa.com.au", "koala.com", "adorebeauty.com.au", "princesspolly.com.au", "petcircle.com.au", "jbhifi.com.au"];
  const tryThese = FAMOUS.map((d) => byDomainAll.get(d)).filter((s): s is Site => !!s && s.domain !== start && coreCount(s) >= 2)
    .slice(0, 3).map((s) => ({ domain: s.domain, name: siteName(s) }));

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
      <main className="wrap page">
        <StoreLookup profiles={profiles} start={start} tryThese={tryThese}>
          <h1>Look up how any Australian online store sells.</h1>
          <p>Shipping costs, returns rules, payment options, offers and tools for {all.length} stores in {new Set(all.map(industryOf)).size} industries.
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
          <Stat k="Australian stores monitored" v={all.length} sub={`across ${new Set(all.map(industryOf)).size} industries`}
            how="Online stores whose terms allow automated reading and whose pages we could read. Stores that ask not to be tracked are left out." />
          <Stat k="Stores with an active offer" v={allStats.onSale.text} sub={allStats.onSale.sub}
            how="A discount or gift seen on the store in the latest weekly scan, and not past its advertised end date." />
          <Stat k="Afterpay detected" v={`${afterpay} of ${bnplSites.length}`} sub="stores where a buy now, pay later option was found"
            how={`Counted among the ${bnplSites.length} stores where we found any buy now, pay later option, from payment logos, scripts and payment pages.`} />
          <Stat k="Median free-shipping minimum" v={thresholds.length ? money(median(thresholds))! : "—"} sub={`${thresholds.length} of ${all.length} stores state one`}
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
        <section className="card" style={{ marginTop: 28, background: "var(--accent-soft)", borderColor: "transparent" }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Compare stores side by side</h2>
          <p className="small" style={{ margin: "6px 0 0", color: "var(--body)" }}>Free-shipping minimums, returns windows, buy now pay later, loyalty and live offers, for up to 5 stores from any industry.</p>
          <SitePicker options={options} chosen={[]} />
          {suggestions.length > 0 && (
            <div className="row small" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
              <span className="muted">Try:</span>
              {suggestions.map((g) => (
                <Link key={g.name} className="chip" href={`/compare?sites=${g.sites.map((s) => s.domain).join(",")}`}>{g.name}: {g.sites.map((s) => siteName(s)).join(" vs ")}</Link>
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
            {!changes.some((c) => c.confirmed) && (
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
                {tools.map((t: any) => <Link key={t.value} href={`/tech/${t.value}`}>{t.name} · {t.n}</Link>)}
              </div>
              <Link href="/tech" className="small" style={{ display: "inline-block", marginTop: 12, fontWeight: 600 }}>All technology →</Link>
            </section>
          </aside>
        </div>

        {/* the full feed, filterable */}
        <section id="activity" style={{ marginTop: 44 }} aria-labelledby="all-h">
          <h2 id="all-h" style={{ margin: 0, fontSize: 24 }}>All activity</h2>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Every confirmed change and every offer seen in the last 7 days. Filter by industry, kind of change or one store.</p>
          <IndustryFilter path="/" sites={all} industry={industry} segment={segment} keep={{ f: f === "all" ? undefined : f }} />
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            {FILTERS.map(([k, t]) => <Link key={k} href={q({ f: k === "all" ? undefined : k })} className={`chip${f === k ? " on" : ""}`}>{t}</Link>)}
          </div>
          <form action="/#activity" className="row" style={{ gap: 8, marginTop: 12, alignItems: "center" }}>
            {f !== "all" && <input type="hidden" name="f" value={f} />}
            {industry && <input type="hidden" name="industry" value={industry} />}
            {segment && <input type="hidden" name="segment" value={segment} />}
            <label htmlFor="feed-site" className="small muted">One store:</label>
            <select id="feed-site" name="site" className="field" style={{ height: 36, width: 260 }} defaultValue={site || ""}>
              <option value="">All {scoped.length} stores</option>
              {[...scoped].sort((a, b) => siteName(a).localeCompare(siteName(b))).map((s) => <option key={s.domain} value={s.domain}>{siteName(s)}</option>)}
            </select>
            <button className="chip" type="submit" style={{ cursor: "pointer" }}>Show</button>
            {site && <Link className="small" href={q({ site: undefined })}>Clear</Link>}
          </form>
          {days.size === 0 && <div className="empty" style={{ marginTop: 20 }}>Nothing in this view yet.</div>}
          {[...days.entries()].map(([day, list_]) => (
            <div key={day}>
              <div className="small muted" style={{ fontWeight: 600, margin: "24px 0 10px", textTransform: "uppercase" }}>{dateAU(day + "T12:00:00", { weekday: "long", day: "numeric", month: "long" })}</div>
              <div className="card" style={{ padding: 0 }}>{list_.map((i, n) => <FeedItem key={n} i={i} />)}</div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
