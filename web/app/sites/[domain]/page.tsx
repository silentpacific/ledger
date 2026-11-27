import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Crumbs, JsonLd } from "@/components/ui";
import { getChanges, getProducts, getPromotions, getSite, getView } from "@/lib/data";
import { CARDS, dateAU, describeChange, fact, fmt, list, median, money, num, show, siteName, val } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { industryName } from "@/lib/industries";
import { BRAND } from "@/lib/brand";
import { pageSchema, storeSchema } from "@/lib/schema";

export const revalidate = 3600;
export const dynamicParams = true;

// Store pages are built the first time someone opens them (then refreshed hourly), not all at once on every deploy.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain } = await params;
  const s = await getSite(domain);
  if (!s) return { title: "Store not found" };
  const n = siteName(s);
  const bits = [num(s, "policies.returns.period_days") && `${num(s, "policies.returns.period_days")}-day returns`,
    num(s, "shipping.free_shipping_threshold") !== undefined && `free shipping over ${money(num(s, "shipping.free_shipping_threshold"))}`,
    list(s, "payments.bnpl_providers").length && `${list(s, "payments.bnpl_providers").length} BNPL options`].filter(Boolean).join(", ");
  return {
    title: `${n}: returns, shipping, Afterpay & promotions (updated ${dateAU(s.last_scanned_at)})`,
    description: `${n} (${s.domain}) facts, dated and sourced: ${bits || "returns, shipping, payments, loyalty and promotions"}. Tracked weekly by ${BRAND}.`,
    alternates: { canonical: `/sites/${s.domain}` },
  };
}

const YEAR_START = (y: number) => Date.UTC(y, 0, 1);

export default async function SitePage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const [s, promos, changes, products, medians] = await Promise.all([getSite(domain), getPromotions([domain]), getChanges(365, [domain]),
    getProducts(domain), getView<Record<string, Record<string, number | null>>>("medians")]);
  if (!s) notFound();
  const name = siteName(s);

  // how it compares with the market: the industry's medians, worked out after each scan
  const market = (key: string) => medians?.[s.industry || "jewellery"]?.[key] ?? undefined;
  const cmp = [
    { label: "Free-shipping threshold", key: "shipping.free_shipping_threshold", unit: "$", better: "lower" },
    { label: "Standard delivery fee", key: "shipping.standard_shipping_cost", unit: "$", better: "lower" },
    { label: "Returns window", key: "policies.returns.period_days", unit: "days", better: "higher" },
  ].map((c) => ({ ...c, mine: num(s, c.key), med: market(c.key) }));
  const bnplCount = list(s, "payments.bnpl_providers").length;

  // promotions timeline for the current year
  const year = new Date().getUTCFullYear();
  const y0 = YEAR_START(year), y1 = YEAR_START(year + 1), span = y1 - y0;
  const bars = promos.map((p) => {
    const a = new Date(p.starts || p.first_seen).getTime();
    const b = p.ends ? new Date(p.ends).getTime() + 864e5 : p.live ? Date.now() : new Date(p.last_seen).getTime() + 864e5;
    return { p, a: Math.max(a, y0), b: Math.min(b, y1), known: !!p.starts };
  }).filter((x) => x.b > x.a && x.b > y0 && x.a < y1).sort((x, y) => x.a - y.a);
  const live = promos.filter((p) => p.live);

  const stores = num(s, "site_identity.store_count");
  const states = val(s, "site_identity.states_with_stores");

  return (
    <>
      <Header active="/sites" />
      <JsonLd data={pageSchema({ type: "ProfilePage", name: `${name}: returns, shipping, payments and promotions`, path: `/sites/${s.domain}`,
        crumbs: [["Industries", "/industries"], [industryName(s.industry), `/industries/${s.industry || "jewellery"}`], [name]],
        dateModified: s.last_scanned_at, extra: [{ ...storeSchema(s, name), mainEntityOfPage: { "@id": `${SITE_URL}/sites/${s.domain}#page` } }] })} />
      <main className="wrap page">
        <Crumbs items={[["Industries", "/industries"], [industryName(s.industry), `/industries/${s.industry || "jewellery"}`], [name]]} />
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
          <div>
            <h1 className="title">{name}</h1>
            <div className="row" style={{ gap: 8, marginTop: 10, fontSize: 13 }}>
              <a className="chip" href={s.homepage_url || `https://${s.domain}`} rel="nofollow noopener" target="_blank">{s.domain}</a>
              {s.segment && <Link className="chip" href={`/sites?segment=${encodeURIComponent(s.segment)}`}>{s.segment}</Link>}
              {val(s, "tech_stack.platform") && <span className="chip">{val(s, "tech_stack.platform")}</span>}
              {stores !== undefined && <span className="chip">{stores} stores{Array.isArray(states) && states.length ? ` · ${states.map((x: string) => x.toUpperCase()).join(", ")}` : ""}</span>}
            </div>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <span className="small muted">Tracked since {dateAU(s.first_scanned_at)} · last scan {dateAU(s.last_scanned_at)}</span>
            <Link className="btn" href={`/compare?sites=${s.domain}`}>Compare with others</Link>
          </div>
        </div>

        <nav className="tabs" aria-label="Sections" style={{ marginTop: 28 }}>
          <a className="on" href="#overview">Overview</a><a href="#compare">How it compares</a><a href="#changes">Changes</a>
          <a href="#promos">Promotions</a><a href="#products">Products</a>
        </nav>

        <section id="overview" className="grid g3" style={{ marginTop: 24 }}>
          {CARDS.map((c) => {
            const rows = c.rows.filter(([k]) => fact(s, k));
            if (!rows.length) return null;
            const quotes = rows.map(([k, l]) => ({ l, f: fact(s, k)! })).filter((x) => x.f.q || x.f.u);
            return (
              <div key={c.id} className="card">
                <h2 style={{ marginBottom: 12, fontSize: 17 }}>{c.title}</h2>
                {rows.map(([k, l, as]) => (
                  <div key={k} className="kv"><span className="k">{l}</span><span className="v">{show(s, k, as)}</span></div>
                ))}
                <details style={{ marginTop: 10 }}>
                  <summary className="tiny muted" style={{ cursor: "pointer" }}>Seen {dateAU(rows.map(([k]) => fact(s, k)!.at).sort().pop()!)} · sources &amp; quotes</summary>
                  <div style={{ marginTop: 8 }}>
                    {quotes.map(({ l, f }) => (
                      <div key={l} className="tiny" style={{ padding: "6px 0", borderTop: "1px solid #F0EEE8" }}>
                        <strong>{l}:</strong> {f.q ? <>“{f.q}”</> : <span className="muted">read by code from the page</span>}
                        {f.u && <> · <a href={f.u} rel="nofollow noopener" target="_blank">source</a></>}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })}
        </section>

        <section id="compare" style={{ marginTop: 40 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 24 }}>How {name} compares</h2>
          <div className="grid g4">
            {cmp.map((c) => {
              const fmtv = (v?: number) => v === undefined ? "Not stated" : c.unit === "$" ? money(v)! : `${v} ${c.unit}`;
              const good = c.mine !== undefined && c.med !== undefined && (c.better === "lower" ? c.mine <= c.med : c.mine >= c.med);
              const m = Math.max(c.mine ?? 0, c.med ?? 0, 1);
              return (
                <div key={c.key} className="card">
                  <div className="small muted">{c.label}</div>
                  <div className="display" style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>{fmtv(c.mine)}</div>
                  <div className="bar" style={{ marginTop: 10 }}><span className="l" style={{ flexBasis: 70 }}>{name.length > 9 ? "This store" : name}</span><span className="t"><span className="f" style={{ width: `${((c.mine ?? 0) / m) * 100}%`, background: good ? "var(--accent)" : "#D97A1F" }} /></span></div>
                  <div className="bar"><span className="l" style={{ flexBasis: 70 }}>Median</span><span className="t"><span className="f" style={{ width: `${((c.med ?? 0) / m) * 100}%`, background: "#B9B5A8" }} /></span></div>
                  <div className="tiny muted">{industryName(s.industry)} median {fmtv(c.med)}</div>
                </div>
              );
            })}
            <div className="card">
              <div className="small muted">Buy now, pay later options</div>
              <div className="display" style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>{bnplCount || "None found"}</div>
              <div className="small" style={{ marginTop: 8 }}>{show(s, "payments.bnpl_providers")}</div>
            </div>
          </div>
        </section>

        <section id="changes" style={{ marginTop: 40 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 24 }}>Changes</h2>
          {changes.length === 0 ? (
            <div className="empty">No changes recorded yet. History for {name} started on {dateAU(s.first_scanned_at)}; changes appear here once a later scan sees them, each with the before and after values.</div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {changes.map((c, i) => {
                const d = describeChange(c);
                return (
                  <div key={i} className="feed-item">
                    <span className="tag">{c.category.replace(/_/g, " ")}</span>
                    <div style={{ flex: 1 }}><div>{name} {d.text}</div><div className="small muted">{dateAU(c.at)} · {c.confirmed ? "confirmed on the next scan" : "waiting for the next scan to confirm"}</div></div>
                    <span className="tiny" style={{ fontWeight: 600, color: d.significance === "High" ? "var(--amber)" : "var(--muted)" }}>{d.significance}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section id="promos" style={{ marginTop: 40 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>Promotions in {year}</h2>
            <span className="small muted">{live.length} live now · {promos.length} recorded</span>
          </div>
          {bars.length === 0 ? <div className="empty" style={{ marginTop: 12 }}>No promotions recorded for {year} yet.</div> : (
            <div className="card scroll" style={{ marginTop: 12 }}>
              <div style={{ minWidth: 760 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", marginLeft: 240, fontSize: 12, color: "var(--muted)", borderBottom: "1px solid var(--line2)", paddingBottom: 6 }}>
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => <span key={m}>{m}</span>)}
                </div>
                {bars.slice(0, 40).map(({ p, a, b, known }, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", height: 34, borderBottom: "1px solid #F4F2EC" }}>
                    <span title={p.discount || ""} style={{ flex: "0 0 240px", fontSize: 13, paddingRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ flex: "1 1 auto", position: "relative", height: 16 }}>
                      <span title={`${dateAU(a)} – ${dateAU(b)}`} style={{ position: "absolute", top: 0, height: 16, borderRadius: 4, left: `${((a - y0) / span) * 100}%`, width: `${Math.max(0.6, ((b - a) / span) * 100)}%`, background: p.live ? "var(--accent)" : known ? "var(--accent-light)" : "#C9CCD3" }} />
                    </span>
                  </div>
                ))}
                <div className="tiny muted" style={{ marginTop: 10 }}>Dark: live now. Light: dates stated by the store. Grey: dates from when we saw it. Hover a bar for its dates.</div>
              </div>
            </div>
          )}
        </section>

        <section id="products" style={{ marginTop: 40 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 24 }}>Watch list</h2>
          {products.length === 0 ? <div className="empty">No product prices for this store yet.</div> : (
            <div className="card scroll" style={{ padding: 0 }}>
              <table className="t" style={{ minWidth: 640 }}>
                <thead><tr><th style={{ paddingLeft: 20 }}>Product</th><th>Category</th><th style={{ textAlign: "right" }}>Price</th><th>Price history</th></tr></thead>
                <tbody>
                  {products.slice(0, 60).map((p, i) => {
                    const ps = p.prices || [];
                    const cur = ps[ps.length - 1];
                    const prev = ps.length > 1 ? ps[ps.length - 2] : undefined;
                    return (
                      <tr key={i}>
                        <td style={{ paddingLeft: 20 }}>{p.url ? <a href={p.url} rel="nofollow noopener" target="_blank" style={{ color: "var(--ink)" }}>{p.title}</a> : p.title}</td>
                        <td className="muted">{p.type || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{cur?.price != null ? money(Number(cur.price)) : "—"}{cur?.compare_at && Number(cur.compare_at) > Number(cur.price) ? <div className="tiny muted" style={{ textDecoration: "line-through" }}>{money(Number(cur.compare_at))}</div> : null}</td>
                        <td className="muted small">{prev ? `Was ${money(Number(prev.price))} until ${dateAU(cur.from)}` : `Unchanged since ${dateAU(cur?.from || p.first_seen)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 10 }}>The top products in each of the store's main categories, checked weekly. Prices are read from the store's own product data.</p>
        </section>
      </main>
    </>
  );
}
