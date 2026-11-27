import Link from "next/link";
import Header from "@/components/Header";
import StoreTable, { Pager } from "@/components/StoreTable";
import { Bars, Crumbs, JsonLd } from "@/components/ui";
import { getView, listSites, PAGE_SIZE } from "@/lib/data";
import { KIND_HOME, KIND_NAMES, facetHref, dateAU, label, slug } from "@/lib/format";
import { INDUSTRIES, industryName } from "@/lib/industries";
import type { ChangeLine } from "@/lib/views";
import { pageSchema } from "@/lib/schema";

export type FacetView = {
  kind: string; value: string; name: string; cat: string | null; counts: Record<string, { m: number; n: number }>;
  changes: ChangeLine[]; prospects: { domain: string; name: string; i: string }[];
};
/** The worked-out numbers for one payment option, technology, platform or policy (null if we've never seen it). */
export const loadFacet = (kind: string, value: string) => getView<FacetView>(`facet:${kind}:${value}`);

export function facetTitle(kind: string, name: string) {
  return kind === "payments" ? `Sites offering ${name}` : kind === "tech" ? `Sites using ${name}` : kind === "platform" ? `Sites on ${name}` : name;
}

/** One payment option, technology, platform or policy across all industries (or one); the stores table is paged. */
export default async function FacetDetail({ kind, value, industry, page = 1 }: { kind: string; value: string; industry?: string; page?: number }) {
  const [f, list] = await Promise.all([loadFacet(kind, value), listSites({ industry, tags: [`${kind}:${value}`], page })]);
  if (!f) return null;
  const base = facetHref(kind, value);
  const scope = f.counts[industry || "all"] ?? { m: 0, n: 0 };
  const inScope = <T extends { i: string }>(xs: T[]) => (industry ? xs.filter((x) => x.i === industry) : xs);
  const changes = inScope(f.changes), prospects = inScope(f.prospects);
  const byInd = INDUSTRIES.map((i) => ({ i, c: f.counts[i.slug] ?? { m: 0, n: 0 } })).filter(({ c }) => c.n > 0)
    .map(({ i, c }) => ({ slug: i.slug, label: i.name, n: Math.round((100 * c.m) / c.n), text: `${c.m} of ${c.n}`, href: `${base}?industry=${i.slug}` }));
  const scopeName = industry ? `${industryName(industry).toLowerCase()} stores` : "stores";
  const section: [string, string] = [kind === "tech" ? "Tech" : KIND_NAMES[kind] === "Payment options" ? "Payments" : KIND_NAMES[kind], KIND_HOME[kind]];
  const crumbs: [string, string?][] = kind === "tech" ? [section, [f.cat || "Other", "/tech"], [f.name]] : [section, [f.name]];
  const href = (p: number) => `${base}?${new URLSearchParams(Object.entries({ industry, page: p > 1 ? String(p) : undefined }).filter(([, x]) => x) as [string, string][])}`;
  return (
    <>
      <Header active={KIND_HOME[kind]} />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: facetTitle(kind, f.name), path: base, crumbs,
        items: list.rows.map((s) => ({ name: s.name, path: `/sites/${s.domain}` })) })} />
      <main className="wrap page">
        <Crumbs items={crumbs} />
        <h1 className="title" style={{ fontSize: 40 }}>{facetTitle(kind, f.name)}</h1>
        <p className="lede">{scope.m} of the {scope.n} Australian {scopeName} we track{kind === "payments" ? ` show ${f.name} as a payment option` : kind === "tech" ? ` use ${f.name}` : kind === "platform" ? ` run on ${f.name}` : " match"}.</p>
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <Link scroll={false} href={base} className={`chip${!industry ? " on" : ""}`}>All industries</Link>
          {byInd.map((r) => <Link scroll={false} key={r.slug} href={r.href} className={`chip${industry === r.slug ? " on" : ""}`}>{r.label}</Link>)}
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
              : changes.slice(0, 10).map((c, i) => <div key={i} className="small" style={{ padding: "6px 0", borderTop: "1px solid #F0EEE8" }}><Link href={`/sites/${c.domain}`} style={{ fontWeight: 600 }}>{c.store}</Link> {c.text} · <span className="muted">{dateAU(c.at)}</span></div>)}
          </section>
        </div>
        {kind === "payments" && (
          <section id="prospects" className="card" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 17 }}>Offer other BNPL options, but not {f.name}</h2>
            <p className="small muted" style={{ margin: "6px 0 10px" }}>Likely prospects for a {f.name} sales team{prospects.length > 60 ? ` (the first 60 of ${prospects.length})` : ""}</p>
            <div className="row" style={{ gap: 10, fontSize: 14 }}>
              {prospects.length ? prospects.slice(0, 60).map((s) => <Link key={s.domain} href={`/sites/${s.domain}`}>{s.name}</Link>) : <span className="muted">None right now</span>}
            </div>
          </section>
        )}
        <h2 style={{ margin: "28px 0 0", fontSize: 22 }}>{list.total} {list.total === 1 ? "store" : "stores"}</h2>
        <StoreTable rows={list.rows} loyalty={false} minWidth={860} bnplLabel={kind === "payments" ? "Other BNPL" : "Buy now, pay later"}
          bnpl={kind === "payments" ? (r) => r.bn.filter((p) => slug(p) !== value).map(label).join(", ") || "—" : undefined} />
        <Pager page={page} total={list.total} size={PAGE_SIZE} href={href} />
        <p className="tiny muted" style={{ marginTop: 10 }}>"Not stated" means the site doesn't publish it, not that it isn't offered.</p>
      </main>
    </>
  );
}
