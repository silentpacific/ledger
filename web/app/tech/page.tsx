import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import { Bars, Stat } from "@/components/ui";
import { filterSites, getChanges, getSites } from "@/lib/data";
import { dateAU, describeChange, facets, siteName, val } from "@/lib/format";
import { INDUSTRIES, industryName } from "@/lib/industries";
import { TECH_ORDER, techCategory } from "@/lib/tech";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Ecommerce tools used by Australian online stores, by industry",
  description: "Which email, reviews, loyalty, subscription, search, chat and experimentation tools Australian online stores use, how adoption differs by industry, and who added or dropped each one.",
  alternates: { canonical: "/tech" },
};

export default async function Tech({ searchParams }: { searchParams: Promise<{ industry?: string; segment?: string }> }) {
  const { industry, segment } = await searchParams;
  const [all, changesAll] = await Promise.all([getSites(), getChanges(365)]);
  const sites = filterSites(all, industry, segment);
  const n = sites.length;
  const tools = facets(sites).tech as any[];
  const groups = new Map<string, any[]>();
  tools.forEach((t) => { const c = techCategory(t.name); groups.set(c, [...(groups.get(c) || []), t]); });
  const order = TECH_ORDER.filter((c) => groups.has(c));
  const perSite = n ? (sites.reduce((a, s) => a + ((val(s, "tech_stack.technologies") as string[] | undefined)?.length || 0), 0) / n).toFixed(1) : "—";
  const plat = new Map<string, number>();
  sites.forEach((s) => { const p = val(s, "tech_stack.platform"); const k = typeof p === "string" ? p : "Not detected"; plat.set(k, (plat.get(k) || 0) + 1); });
  const dom = new Set(sites.map((s) => s.domain));
  const changes = changesAll.filter((c) => c.confirmed && dom.has(c.domain) && (c.key === "tech_stack.technologies" || c.key === "tech_stack.platform"));
  // leading industry per tool (highest share of its stores), only when looking at all industries
  const lead = (name: string) => {
    if (industry) return null;
    let best: { ind: string; pct: number } | null = null;
    for (const i of INDUSTRIES) {
      const xs = filterSites(all, i.slug);
      if (xs.length < 5) continue;
      const pct = Math.round((100 * xs.filter((s) => ((val(s, "tech_stack.technologies") as string[]) || []).includes(name)).length) / xs.length);
      if (!best || pct > best.pct) best = { ind: i.name, pct };
    }
    return best && best.pct > 0 ? best : null;
  };
  const q = industry ? `?industry=${industry}` : "";

  return (
    <>
      <Header active="/tech" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "Technology used by Australian online stores", path: "/tech", crumbs: [["Technology"]] })} />
      <main className="wrap page">
        <div className="eyebrow">Tech{industry ? ` · ${industryName(industry)}` : ""}</div>
        <h1 className="title">The tools stores sell with</h1>
        <p className="lede">Email, reviews, loyalty, subscriptions, search, chat and testing tools found on Australian online stores, by industry, with the date each one was added or dropped. We track commerce tools only, not every script on a site.</p>

        <IndustryFilter path="/tech" sites={all} industry={industry} segment={segment} />

        <div className="grid g4" style={{ marginTop: 24 }}>
          <Stat k="Stores" v={n} sub={industry ? industryName(industry) : "all industries"} />
          <Stat k="Tools detected" v={tools.length} sub={`in ${order.length} categories`} />
          <Stat k="Tools per store" v={perSite} sub="average" />
          <Stat k="Tool changes recorded" v={changes.length} sub="confirmed adds and drops" />
        </div>

        <div className="grid g2" style={{ marginTop: 24 }}>
          <section className="card">
            <h2 style={{ marginBottom: 14 }}>Platforms</h2>
            <Bars rows={[...plat.entries()].sort((a, b) => b[1] - a[1]).map(([p, c]) => ({ label: p, n: c, text: `${c} · ${Math.round((100 * c) / Math.max(1, n))}%` }))} max={n} />
          </section>
          <section className="card" style={{ borderStyle: changes.length ? "solid" : "dashed" }}>
            <h2>Recently added or dropped</h2>
            {changes.length === 0
              ? <p className="small muted" style={{ margin: "8px 0 0" }}>No confirmed tool changes yet. A change is listed once the next scan confirms it, with the date and what was added or removed.</p>
              : changes.slice(0, 10).map((c, i) => <div key={i} className="small" style={{ padding: "6px 0", borderTop: "1px solid #F0EEE8" }}><Link href={`/sites/${c.domain}`} style={{ fontWeight: 600 }}>{siteName(c.domain)}</Link> {describeChange(c).text} · <span className="muted">{dateAU(c.at)}</span></div>)}
          </section>
        </div>

        <div className="grid g2" style={{ marginTop: 24 }}>
          {order.map((cat) => (
            <section key={cat} className="card" style={{ padding: 0 }}>
              <h2 style={{ padding: "18px 20px 6px", margin: 0, fontSize: 18 }}>{cat}</h2>
              <table className="t">
                <thead><tr><th style={{ paddingLeft: 20 }}>Tool</th><th style={{ textAlign: "right" }}>Stores</th><th style={{ textAlign: "right" }}>Share</th>{!industry && <th>Most used in</th>}</tr></thead>
                <tbody>
                  {groups.get(cat)!.map((t) => {
                    const l = lead(t.name);
                    return (
                      <tr key={t.value}>
                        <td style={{ paddingLeft: 20 }}><Link href={`/tech/${t.value}${q}`} style={{ fontWeight: 600 }}>{t.name}</Link></td>
                        <td style={{ textAlign: "right" }}>{t.n}</td>
                        <td style={{ textAlign: "right" }}>{Math.round((100 * t.n) / Math.max(1, n))}%</td>
                        {!industry && <td className="muted">{l ? `${l.ind} (${l.pct}%)` : "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>Tools are detected from each store's public homepage code on the monthly scan. "Most used in" only counts industries with at least 5 stores tracked.</p>
      </main>
    </>
  );
}
