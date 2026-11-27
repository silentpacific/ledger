import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import SortTable from "@/components/SortTable";
import { getCounts, getView } from "@/lib/data";
import { KIND_HOME, facetHref } from "@/lib/format";
import { industryName } from "@/lib/industries";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";


/** Overview of one kind of list (platforms, policies): every option, how many stores, where it's most common. */
export default async function FacetIndex({ kind, title, lede, label, industry }: { kind: string; title: string; lede: string; label: string; industry?: string }) {
  const [v, counts] = await Promise.all([getView<{ n: number; options: { name: string; value: string }[]; rows: any[] }>(`${kind}:${industry || "all"}`), getCounts()]);
  const sites = { length: v?.n ?? 0 }, options = v?.options ?? [], rows = v?.rows ?? [];
  return (
    <>
      <Header active={KIND_HOME[kind]} />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: title, path: KIND_HOME[kind], crumbs: [[title]], items: options.map((o) => ({ name: o.name, path: facetHref(kind, o.value) })) })} />
      <main className="wrap page">
        <div className="eyebrow">Explore</div>
        <h1 className="title">{title}</h1>
        <p className="lede">{lede} Across {sites.length} {industry ? `${industryName(industry).toLowerCase()} ` : ""}stores we track.</p>
        <IndustryFilter path={KIND_HOME[kind]} counts={counts} industry={industry} />
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
