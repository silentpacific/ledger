import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Crumbs, JsonLd } from "@/components/ui";
import { getChanges, getJewellery as getSites, Site } from "@/lib/data";
import { KIND_NAMES, describeChange, dateAU, facets, list, money, num, siteName, slug, val, label } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const fc = facets(await getSites());
  return Object.entries(fc).flatMap(([kind, items]) => items.map((x) => ({ kind, value: x.value })));
}

async function load(kind: string, value: string) {
  const sites = await getSites();
  const f = (facets(sites)[kind] || []).find((x) => x.value === value);
  return { sites, f };
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string; value: string }> }): Promise<Metadata> {
  const { kind, value } = await params;
  const { sites, f } = await load(kind, value);
  if (!f) return { title: "Not found" };
  const n = sites.filter(f.test).length;
  const what = kind === "payments" ? `offer ${f.name}` : kind === "tech" ? `use ${f.name}` : kind === "platform" ? `run on ${f.name}` : kind === "segment" ? `are ${f.name}` : `have ${f.name.toLowerCase()}`;
  return {
    robots: n < 2 ? { index: false, follow: true } : undefined,
    title: `Australian jewellery stores that ${what} (${n})`,
    description: `${n} of ${sites.length} Australian online jewellery stores ${what}. See which ones, who added or dropped it recently, and how they compare.`,
    alternates: { canonical: `/explore/${kind}/${value}` },
  };
}

export default async function ExploreList({ params }: { params: Promise<{ kind: string; value: string }> }) {
  const { kind, value } = await params;
  const { sites, f } = await load(kind, value);
  if (!f) notFound();
  const fc = facets(sites);
  const matching = sites.filter(f.test).sort((a, b) => siteName(a).localeCompare(siteName(b)));
  const changes = (await getChanges(365)).filter((c) => {
    if (kind === "payments") return c.key === "payments.bnpl_providers" && JSON.stringify([c.from, c.to]).toLowerCase().includes(value.replace(/-/g, "_"));
    if (kind === "tech") return c.key === "tech_stack.technologies" && JSON.stringify([c.from, c.to]).toLowerCase().includes(f.name.toLowerCase());
    return false;
  });
  // vendors' view: sites offering competing providers but not this one
  const prospects: Site[] = kind === "payments"
    ? sites.filter((s) => !f.test(s) && list(s, "payments.bnpl_providers").length >= 2) : [];
  const bnplOthers = (s: Site) => list(s, "payments.bnpl_providers").filter((p) => slug(p) !== value).map(label).join(", ") || "—";

  return (
    <>
      <Header active="/explore" />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: f.name, numberOfItems: matching.length,
        itemListElement: matching.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: siteName(s), url: `${SITE_URL}/sites/${s.domain}` })) }} />
      <div className="wrap page" style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
        <nav aria-label="Explore by" style={{ flex: "1 1 220px", maxWidth: 260, fontSize: 14 }}>
          {Object.entries(fc).map(([k, items]) => (
            <div key={k} style={{ marginBottom: 20 }}>
              <div className="tiny muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{KIND_NAMES[k]}</div>
              {items.slice(0, 8).map((x: any) => {
                const on = k === kind && x.value === value;
                return <Link key={x.value} href={`/explore/${k}/${x.value}`} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderRadius: 6, color: "var(--ink)", background: on ? "var(--accent-soft)" : "transparent", fontWeight: on ? 600 : 400 }}><span>{x.name}</span><span className="muted">{x.n}</span></Link>;
              })}
            </div>
          ))}
        </nav>

        <main style={{ flex: "999 1 560px", minWidth: 0 }}>
          <Crumbs items={[["Explore", "/explore"], [KIND_NAMES[kind], "/explore"], [f.name]]} />
          <h1 className="title" style={{ fontSize: 40 }}>{kind === "payments" ? `Sites offering ${f.name}` : kind === "tech" ? `Sites using ${f.name}` : kind === "platform" ? `Sites on ${f.name}` : f.name}</h1>
          <p className="lede">{matching.length} of the {sites.length} Australian jewellery sites we track{kind === "payments" ? ` show ${f.name} as a payment option` : kind === "tech" ? ` use ${f.name}` : kind === "segment" ? " are in this segment" : kind === "platform" ? ` run on ${f.name}` : " match"}.</p>

          <div className="grid g2" style={{ marginTop: 24 }}>
            <section className="card" style={{ borderStyle: changes.length ? "solid" : "dashed" }}>
              <h2 style={{ fontSize: 17 }}>Recently added or dropped</h2>
              {changes.length === 0
                ? <p className="small muted" style={{ margin: "8px 0 0" }}>{kind === "payments" || kind === "tech" ? "No changes recorded yet. Each weekly scan adds them here with the date and before/after values." : "Changes are listed for payment options and technologies."}</p>
                : changes.slice(0, 8).map((c, i) => <div key={i} className="small" style={{ padding: "6px 0", borderTop: "1px solid #F0EEE8" }}><Link href={`/sites/${c.domain}`} style={{ fontWeight: 600 }}>{siteName(c.domain)}</Link> {describeChange(c).text} · <span className="muted">{dateAU(c.at)}</span></div>)}
            </section>
            {kind === "payments" ? (
              <section id="prospects" className="card">
                <h2 style={{ fontSize: 17 }}>Offer other BNPL options, but not {f.name}</h2>
                <p className="small muted" style={{ margin: "6px 0 10px" }}>Likely prospects for a {f.name} sales team</p>
                <div className="row" style={{ gap: 8, fontSize: 14 }}>
                  {prospects.length ? prospects.map((s) => <Link key={s.domain} href={`/sites/${s.domain}`}>{siteName(s)}</Link>) : <span className="muted">None right now</span>}
                </div>
              </section>
            ) : (
              <section className="card">
                <h2 style={{ fontSize: 17 }}>Share of tracked sites</h2>
                <div className="display" style={{ fontSize: 36, fontWeight: 600, marginTop: 8 }}>{Math.round((matching.length / Math.max(1, sites.length)) * 100)}%</div>
                <div className="bar" style={{ marginTop: 8 }}><span className="t"><span className="f" style={{ width: `${(matching.length / Math.max(1, sites.length)) * 100}%` }} /></span></div>
              </section>
            )}
          </div>

          <div className="card scroll" style={{ padding: 0, marginTop: 24 }}>
            <table className="t" style={{ minWidth: 760 }}>
              <thead><tr><th style={{ paddingLeft: 20 }}>Site</th><th>Segment</th><th>Platform</th><th>{kind === "payments" ? "Other BNPL" : "Buy now, pay later"}</th><th style={{ textAlign: "right" }}>Free shipping over</th><th style={{ textAlign: "right" }}>Returns</th></tr></thead>
              <tbody>
                {matching.map((s) => {
                  const fs = num(s, "shipping.free_shipping_threshold"), rd = num(s, "policies.returns.period_days");
                  return (
                    <tr key={s.domain}>
                      <td style={{ paddingLeft: 20 }}><Link href={`/sites/${s.domain}`} style={{ fontWeight: 600 }}>{siteName(s)}</Link></td>
                      <td className="muted">{s.segment || "—"}</td>
                      <td>{val(s, "tech_stack.platform") || "—"}</td>
                      <td>{kind === "payments" ? bnplOthers(s) : list(s, "payments.bnpl_providers").map(label).join(", ") || <span className="muted">Not stated</span>}</td>
                      <td style={{ textAlign: "right" }}>{fs !== undefined ? money(fs) : <span className="muted">Not stated</span>}</td>
                      <td style={{ textAlign: "right" }}>{rd !== undefined ? `${rd} days` : <span className="muted">Not stated</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>"Not stated" means the site doesn't publish it, not that it isn't offered. Every value links to its source quote on the site's page.</p>
        </main>
      </div>
    </>
  );
}
