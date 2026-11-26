import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Bars, Crumbs, Stat } from "@/components/ui";
import { getPromotions, getSites, industryOf } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";
import { dateAU, isDiscount, label, list, maxPct, median, money, num, siteName, val } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => INDUSTRIES.map((i) => ({ slug: i.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const i = INDUSTRIES.find((x) => x.slug === slug);
  if (!i) return {};
  return {
    title: `${i.name}: Australian online stores compared`,
    description: `Returns, shipping, buy now pay later, loyalty and live promotions across Australian ${i.name.toLowerCase()} stores, dated and sourced.`,
    alternates: { canonical: `/industries/${slug}` },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ind = INDUSTRIES.find((x) => x.slug === slug);
  if (!ind) notFound();
  const [all, promosAll] = await Promise.all([getSites(), getPromotions()]);
  const sites = all.filter((s) => industryOf(s) === slug).sort((a, b) => siteName(a).localeCompare(siteName(b)));
  const dom = new Set(sites.map((s) => s.domain));
  const promos = promosAll.filter((p) => dom.has(p.domain));
  const live = promos.filter((p) => p.live);
  const fs = sites.map((s) => num(s, "shipping.free_shipping_threshold")).filter((x): x is number => x !== undefined);
  const ret = sites.map((s) => num(s, "policies.returns.period_days")).filter((x): x is number => x !== undefined);
  const bnplSites = sites.filter((s) => list(s, "payments.bnpl_providers").length);
  const prov = new Map<string, number>();
  bnplSites.forEach((s) => list(s, "payments.bnpl_providers").forEach((p) => prov.set(p, (prov.get(p) || 0) + 1)));
  const best = new Map<string, any>();
  live.filter(isDiscount).forEach((p) => { const b = best.get(p.domain); if (!b || maxPct(p) > maxPct(b)) best.set(p.domain, p); });
  const deals = [...best.values()].sort((a, b) => maxPct(b) - maxPct(a)).slice(0, 8);
  const latest = sites.reduce((a, s) => (s.last_scanned_at > a ? s.last_scanned_at : a), "");

  return (
    <>
      <Header active="/industries" />
      <main className="wrap page">
        <Crumbs items={[["Industries", "/industries"], [ind.name]]} />
        <h1 className="title">{ind.name}</h1>
        <p className="lede">{ind.why} {sites.length ? `${sites.length} Australian stores tracked so far${latest ? `, last scanned ${dateAU(latest)}` : ""}.` : "The first stores are being scanned now; they'll appear here as soon as their scans finish."}</p>
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <Link className="chip" href={`/?industry=${slug}`}>This week</Link>
          <Link className="chip" href={`/sites?industry=${slug}`}>Sites</Link>
          <Link className="chip" href={`/benchmarks?industry=${slug}`}>Benchmarks</Link>
          <Link className="chip" href={`/promotions?industry=${slug}`}>Promotions calendar</Link>
          <Link className="chip" href={`/tech?industry=${slug}`}>Tech</Link>
        </div>

        {sites.length > 0 && <>
          <div className="grid g4" style={{ marginTop: 28 }}>
            <Stat k="Sites tracked" v={sites.length} />
            <Stat k="Promotions live" v={live.length} sub={`${best.size} sites running a discount`} />
            <Stat k="Median free-shipping threshold" v={fs.length ? money(median(fs))! : "—"} sub={fs.length ? `${fs.length} sites state one` : "not stated yet"} />
            <Stat k="Median returns window" v={ret.length ? `${median(ret)} days` : "—"} sub={ret.length ? `${ret.length} sites state one` : "not stated yet"} />
          </div>

          <div className="grid g2" style={{ marginTop: 24 }}>
            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Buy now, pay later</h2>
              {prov.size ? <Bars color="var(--blue)" max={bnplSites.length} rows={[...prov.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => ({ label: label(p), n, text: `${n} of ${bnplSites.length}` }))} />
                : <p className="small muted">No BNPL options found yet.</p>}
            </section>
            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Biggest offers live now</h2>
              {deals.length ? deals.map((p) => (
                <div key={p.domain} className="kv"><Link href={`/sites/${p.domain}`} className="k" style={{ color: "var(--ink)", fontWeight: 600 }}>{siteName(p.domain)}</Link><span className="v" style={{ fontWeight: 400 }}>{p.name}{p.discount && !p.name.includes(p.discount) ? ` · ${p.discount}` : ""}</span></div>
              )) : <p className="small muted">No discounts seen yet.</p>}
            </section>
          </div>

          <div className="card scroll" style={{ padding: 0, marginTop: 24 }}>
            <table className="t" style={{ minWidth: 900 }}>
              <thead><tr><th style={{ paddingLeft: 20 }}>Store</th><th>Platform</th><th style={{ textAlign: "right" }}>Free shipping over</th><th style={{ textAlign: "right" }}>Returns</th><th>Buy now, pay later</th><th>Loyalty</th><th>Last scan</th></tr></thead>
              <tbody>
                {sites.map((s) => {
                  const f = num(s, "shipping.free_shipping_threshold"), r = num(s, "policies.returns.period_days"), lp = val(s, "loyalty.program");
                  return (
                    <tr key={s.domain}>
                      <td style={{ paddingLeft: 20 }}><Link href={`/sites/${s.domain}`} style={{ fontWeight: 600 }}>{siteName(s)}</Link><div className="tiny muted">{s.domain}</div></td>
                      <td>{val(s, "tech_stack.platform") || "—"}</td>
                      <td style={{ textAlign: "right" }}>{f !== undefined ? money(f) : <span className="muted">Not stated</span>}</td>
                      <td style={{ textAlign: "right" }}>{r !== undefined ? `${r} days` : <span className="muted">Not stated</span>}</td>
                      <td>{list(s, "payments.bnpl_providers").map(label).join(", ") || <span className="muted">Not stated</span>}</td>
                      <td>{typeof lp === "string" ? lp : <span className="muted">—</span>}</td>
                      <td className="muted">{dateAU(s.last_scanned_at, { day: "numeric", month: "short" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>"Not stated" means the store doesn't publish it, not that it isn't offered.</p>
        </>}
      </main>
    </>
  );
}
