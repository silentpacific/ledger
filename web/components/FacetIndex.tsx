import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import SortTable from "@/components/SortTable";
import { filterSites, getSites } from "@/lib/data";
import { KIND_HOME, facetHref, facets } from "@/lib/format";
import { INDUSTRIES, industryName } from "@/lib/industries";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

/** Overview of one kind of list (platforms, policies): every option, how many stores, where it's most common. */
export default async function FacetIndex({ kind, title, lede, label, industry }: { kind: string; title: string; lede: string; label: string; industry?: string }) {
  const all = await getSites();
  const sites = filterSites(all, industry);
  const options = facets(sites)[kind] || [];
  const q = industry ? `?industry=${industry}` : "";
  const rows = options.map((o: any) => {
    const lead = INDUSTRIES.map((i) => { const xs = filterSites(all, i.slug); return { i, p: pct(xs.filter(o.test).length, xs.length), n: xs.length }; })
      .filter((x) => x.n >= 5).sort((a, b) => b.p - a.p)[0];
    return { id: o.value, cells: {
      name: { text: o.name, sort: o.name, href: `${facetHref(kind, o.value)}${q}` },
      n: { text: String(o.n), sort: o.n },
      share: { text: `${pct(o.n, sites.length)}%`, sort: pct(o.n, sites.length) },
      lead: { text: lead && !industry ? `${lead.i.name} (${lead.p}%)` : "–", sort: lead?.p ?? null, muted: !lead || !!industry },
    } };
  });
  return (
    <>
      <Header active={KIND_HOME[kind]} />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: title, path: KIND_HOME[kind], crumbs: [[title]], items: options.map((o) => ({ name: o.name, path: facetHref(kind, o.value) })) })} />
      <main className="wrap page">
        <div className="eyebrow">Explore</div>
        <h1 className="title">{title}</h1>
        <p className="lede">{lede} Across {sites.length} {industry ? `${industryName(industry).toLowerCase()} ` : ""}stores we track.</p>
        <IndustryFilter path={KIND_HOME[kind]} sites={all} industry={industry} />
        <section className="card" style={{ marginTop: 28 }}>
          {rows.length ? (
            <SortTable minWidth={640} initial="n" initialDesc rows={rows} cols={[
              { key: "name", label }, { key: "n", label: "Stores", align: "right" },
              { key: "share", label: "Share of stores", align: "right" }, { key: "lead", label: "Most common in" }]} />
          ) : <div className="empty">Nothing recorded for these stores yet.</div>}
        </section>
        <p className="tiny muted" style={{ marginTop: 12 }}>Counts come from each store's latest scan. A store that doesn't state something isn't counted.</p>
      </main>
    </>
  );
}
