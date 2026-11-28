import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import SortTable from "@/components/SortTable";
import { getCounts, getView } from "@/lib/data";
import { KIND_HOME, facetHref } from "@/lib/format";
import { industryName } from "@/lib/industries";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";
import "@/app/home.css";
import FacetOverview, { type Matrix } from "@/components/FacetOverview";


/** Overview of one kind of list (platforms, policies): every option, how many stores, where it's most common. */
export default async function FacetIndex({ kind, title, lede, label, industry }: { kind: string; title: string; lede: string; label: string; industry?: string }) {
  const [v, counts] = await Promise.all([getView<{ n: number; options: { name: string; value: string }[]; rows: any[] }>(`${kind}:${industry || "all"}`), getCounts()]);
  const sites = { length: v?.n ?? 0 }, options = v?.options ?? [], rows = v?.rows ?? [];
  if (!industry) {
    const m = await getView<Matrix>(`matrix:${kind}`);
    if (m && m.all[0]) {
      const [a1, a2, a3] = m.all;
      const isPlat = kind === "platform";
      return FacetOverview({ kind, crumb: title, eyebrow: title, title: isPlat ? "The platforms Australian online stores run on" : "What Australian online stores promise",
        headline: isPlat ? `${a1.name} runs ${a1.pct}% of the stores we track.${a2 ? ` ${a2.name} is next, at ${a2.pct}%.` : ""}`
          : `${a1.name} is the most common policy, at ${a1.pct}% of stores.${a2 ? ` ${a2.name} follows at ${a2.pct}%.` : ""}`,
        lede: `${lede} Across ${m.total} stores we track.`, m,
        figs: [a1, a2, a3].filter(Boolean).map((o) => [`${o.pct}%`, o.name, `${o.n} of ${m.total} stores`] as [string, string, string])
          .concat([[String(m.all.length), isPlat ? "platforms seen" : "policies tracked", "across every store"]]) });
    }
  }
  return (
    <div className="h ov">
      <Header active={KIND_HOME[kind]} />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: title, path: KIND_HOME[kind], crumbs: [[title]], items: options.map((o) => ({ name: o.name, path: facetHref(kind, o.value) })) })} />
      <main className="wrap page">
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
    </div>
  );
}
