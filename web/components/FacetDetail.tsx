import Link from "next/link";
import Header from "@/components/Header";
import { Bars, Crumbs, JsonLd } from "@/components/ui";
import { filterSites, getChanges, getSites, industryOf, Site } from "@/lib/data";
import { KIND_HOME, KIND_NAMES, facetHref, describeChange, dateAU, facets, label, list, money, num, siteName, slug, val } from "@/lib/format";
import { INDUSTRIES, industryName } from "@/lib/industries";
import { SITE_URL } from "@/lib/site";
import { techCategory } from "@/lib/tech";
import { pageSchema } from "@/lib/schema";

export async function loadFacet(kind: string, value: string, industry?: string) {
  const all = await getSites();
  const sites = filterSites(all, industry);
  const f = (facets(all)[kind] || []).find((x) => x.value === value);
  return { all, sites, f };
}

export function facetTitle(kind: string, name: string) {
  return kind === "payments" ? `Sites offering ${name}` : kind === "tech" ? `Sites using ${name}` : kind === "platform" ? `Sites on ${name}` : kind === "segment" ? name : name;
}

/** One payment option, technology, platform, segment or policy across all industries (or one). */
export default async function FacetDetail({ kind, value, industry }: { kind: string; value: string; industry?: string }) {
  const { all, sites, f } = await loadFacet(kind, value, industry);
  if (!f) return null;
  const base = facetHref(kind, value);
  const matching = sites.filter(f.test).sort((a, b) => siteName(a).localeCompare(siteName(b)));
  const dom = new Set(sites.map((s) => s.domain));
  const changes = (await getChanges(365)).filter((c) => dom.has(c.domain)).filter((c) => {
    if (kind === "payments") return c.key === "payments.bnpl_providers" && JSON.stringify([c.from, c.to]).toLowerCase().includes(value.replace(/-/g, "_"));
    if (kind === "tech") return c.key === "tech_stack.technologies" && JSON.stringify([c.from, c.to]).toLowerCase().includes(f.name.toLowerCase());
    return false;
  });
  const prospects: Site[] = kind === "payments" ? sites.filter((s) => !f.test(s) && list(s, "payments.bnpl_providers").length >= 2) : [];
  const bnplOthers = (s: Site) => list(s, "payments.bnpl_providers").filter((p) => slug(p) !== value).map(label).join(", ") || "—";
  const byInd = INDUSTRIES.map((i) => {
    const xs = filterSites(all, i.slug), m = xs.filter(f.test).length;
    return { label: i.name, n: xs.length ? Math.round((100 * m) / xs.length) : 0, text: `${m} of ${xs.length}`, href: `${base}?industry=${i.slug}` };
  }).filter((r) => r.text !== "0 of 0");
  const scope = industry ? `${industryName(industry).toLowerCase()} stores` : "stores";
  const section: [string, string] = [kind === "tech" ? "Tech" : KIND_NAMES[kind] === "Payment options" ? "Payments" : KIND_NAMES[kind], KIND_HOME[kind]];

  return (
    <>
      <Header active={KIND_HOME[kind]} />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: facetTitle(kind, f.name), path: base,
        crumbs: kind === "tech" ? [section, [techCategory(f.name), "/tech"], [f.name]] : [section, [f.name]],
        items: matching.map((s) => ({ name: siteName(s), path: `/sites/${s.domain}` })) })} />
      <main className="wrap page">
        <Crumbs items={kind === "tech" ? [section, [techCategory(f.name), "/tech"], [f.name]] : [section, [f.name]]} />
        <h1 className="title" style={{ fontSize: 40 }}>{facetTitle(kind, f.name)}</h1>
        <p className="lede">{matching.length} of the {sites.length} Australian {scope} we track{kind === "payments" ? ` show ${f.name} as a payment option` : kind === "tech" ? ` use ${f.name}` : kind === "platform" ? ` run on ${f.name}` : " match"}.</p>
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <Link scroll={false} href={base} className={`chip${!industry ? " on" : ""}`}>All industries</Link>
          {byInd.map((r) => { const s_ = INDUSTRIES.find((i) => i.name === r.label)!.slug; return <Link scroll={false} key={s_} href={r.href} className={`chip${industry === s_ ? " on" : ""}`}>{r.label}</Link>; })}
        </div>

        <div className="grid g2" style={{ marginTop: 24 }}>
          <section className="card">
            <h2 style={{ fontSize: 17, marginBottom: 12 }}>Share of stores, by industry</h2>
            <Bars rows={byInd} max={100} />
          </section>
          <section className="card" style={{ borderStyle: changes.length ? "solid" : "dashed" }}>
            <h2 style={{ fontSize: 17 }}>Recently added or dropped</h2>
            {changes.length === 0
              ? <p className="small muted" style={{ margin: "8px 0 0" }}>{kind === "payments" || kind === "tech" ? "No changes recorded yet. Each scan adds them here with the date and before/after values." : "Changes are listed for payment options and technologies."}</p>
              : changes.slice(0, 10).map((c, i) => <div key={i} className="small" style={{ padding: "6px 0", borderTop: "1px solid #F0EEE8" }}><Link href={`/sites/${c.domain}`} style={{ fontWeight: 600 }}>{siteName(c.domain)}</Link> {describeChange(c).text} · <span className="muted">{dateAU(c.at)}</span></div>)}
          </section>
        </div>

        {kind === "payments" && (
          <section id="prospects" className="card" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 17 }}>Offer other BNPL options, but not {f.name}</h2>
            <p className="small muted" style={{ margin: "6px 0 10px" }}>Likely prospects for a {f.name} sales team</p>
            <div className="row" style={{ gap: 10, fontSize: 14 }}>
              {prospects.length ? prospects.map((s) => <Link key={s.domain} href={`/sites/${s.domain}`}>{siteName(s)}</Link>) : <span className="muted">None right now</span>}
            </div>
          </section>
        )}

        <div className="card scroll" style={{ padding: 0, marginTop: 24 }}>
          <table className="t" style={{ minWidth: 860 }}>
            <thead><tr><th style={{ paddingLeft: 20 }}>Site</th><th>Industry</th><th>Platform</th><th>{kind === "payments" ? "Other BNPL" : "Buy now, pay later"}</th><th style={{ textAlign: "right" }}>Free shipping over</th><th style={{ textAlign: "right" }}>Returns</th></tr></thead>
            <tbody>
              {matching.map((s) => {
                const fs = num(s, "shipping.free_shipping_threshold"), rd = num(s, "policies.returns.period_days");
                return (
                  <tr key={s.domain}>
                    <td style={{ paddingLeft: 20 }}><Link href={`/sites/${s.domain}`} style={{ fontWeight: 600 }}>{siteName(s)}</Link></td>
                    <td className="muted">{industryName(industryOf(s))}{s.segment ? ` · ${s.segment}` : ""}</td>
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
        <p className="tiny muted" style={{ marginTop: 10 }}>"Not stated" means the site doesn't publish it, not that it isn't offered.</p>
      </main>
    </>
  );
}
