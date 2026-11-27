import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import SortTable, { SortRow } from "@/components/SortTable";
import { getCounts, getView } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";
import { COVERAGE, STAT_COLUMNS, type groupStats } from "@/lib/stats";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Industries we cover",
  description: "Australian online stores compared industry by industry: who's on sale, free-shipping thresholds, returns windows, buy now pay later and the tools they use.",
  alternates: { canonical: "/industries" },
};

export default async function Industries() {
  type St = ReturnType<typeof groupStats>;
  const [v, counts] = await Promise.all([getView<{ all: St; ind: Record<string, St> }>("industries"), getCounts()]);
  if (!v) return null;
  const rows: SortRow[] = INDUSTRIES.filter((i) => v.ind[i.slug]).map((i) => {
    const st = v.ind[i.slug];
    return { id: i.slug, cells: {
      industry: { text: i.name, sort: i.name, href: `/industries/${i.slug}`, sub: i.why },
      ...Object.fromEntries(STAT_COLUMNS.map(([k]) => [k, { ...st[k], muted: !st[k].enough }])),
    } };
  });
  const all = v.all;
  return (
    <>
      <Header active="/industries" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "Industries", path: "/industries", crumbs: [["Industries"]], items: INDUSTRIES.map((i) => ({ name: i.name, path: `/industries/${i.slug}` })) })} />
      <main className="wrap page">
        <h1 className="title">Industries</h1>
        <p className="lede">{counts.all} Australian online stores across {INDUSTRIES.length} industries, compared like for like. Click a column to sort; open an industry for its stores, feed, benchmarks and promotions.</p>
        <div style={{ marginTop: 28 }}>
          <SortTable cols={[{ key: "industry", label: "Industry" }, ...STAT_COLUMNS.map(([k, l]) => ({ key: k, label: l, align: k === "topTool" ? "left" as const : "right" as const }))]}
            rows={rows} minWidth={1080} />
        </div>
        <p className="small muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
          Across all industries: {all.onSale.text} of stores have an active offer, median free-shipping threshold {all.freeShipping.text.toLowerCase()}, median returns window {all.returns.text}.
          {" "}A median is shown only when at least {Math.round(COVERAGE * 100)}% of an industry's stores publish the value; otherwise it says "Not enough data". "Stores with an active offer" counts discounts and gifts seen in the latest weekly scan and not past their advertised end date.
        </p>
        <p className="small muted" style={{ marginTop: 8 }}>Want an industry that isn't listed? <Link href="/contact" style={{ fontWeight: 600 }}>Tell us</Link>, or suggest a store below.</p>
      </main>
    </>
  );
}
