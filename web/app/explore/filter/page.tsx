import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Crumbs } from "@/components/ui";
import { getJewellery as getSites } from "@/lib/data";
import { KIND_NAMES, facets, label, list, money, num, siteName, val } from "@/lib/format";

export const metadata: Metadata = { title: "Filtered list", robots: { index: false, follow: true } };

export default async function Filter({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const sites = await getSites();
  const fc = facets(sites);
  const chosen = (["payments", "tech", "policy", "platform", "segment"] as const)
    .map((k) => (q[k] ? fc[k].find((x) => x.value === q[k]) : undefined)).filter(Boolean) as any[];
  const matching = sites.filter((s) => chosen.every((f) => f.test(s))).sort((a, b) => siteName(a).localeCompare(siteName(b)));
  return (
    <>
      <Header active="/explore" />
      <main className="wrap page">
        <Crumbs items={[["Explore", "/explore"], ["Filtered list"]]} />
        <h1 className="title" style={{ fontSize: 40 }}>{matching.length} {matching.length === 1 ? "site" : "sites"}</h1>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          {chosen.length ? chosen.map((f) => <Link key={f.kind + f.value} className="chip on" href={`/explore/${f.kind}/${f.value}`}>{KIND_NAMES[f.kind].replace(/s$/, "")}: {f.name}</Link>) : <span className="muted">No filters chosen: showing every site.</span>}
          <Link className="chip" href="/explore">Change filters</Link>
        </div>
        <div className="card scroll" style={{ padding: 0, marginTop: 20 }}>
          <table className="t" style={{ minWidth: 760 }}>
            <thead><tr><th style={{ paddingLeft: 20 }}>Site</th><th>Segment</th><th>Platform</th><th>Buy now, pay later</th><th style={{ textAlign: "right" }}>Free shipping over</th><th style={{ textAlign: "right" }}>Returns</th></tr></thead>
            <tbody>
              {matching.map((s) => (
                <tr key={s.domain}>
                  <td style={{ paddingLeft: 20 }}><Link href={`/sites/${s.domain}`} style={{ fontWeight: 600 }}>{siteName(s)}</Link></td>
                  <td className="muted">{s.segment || "—"}</td><td>{val(s, "tech_stack.platform") || "—"}</td>
                  <td>{list(s, "payments.bnpl_providers").map(label).join(", ") || <span className="muted">Not stated</span>}</td>
                  <td style={{ textAlign: "right" }}>{num(s, "shipping.free_shipping_threshold") !== undefined ? money(num(s, "shipping.free_shipping_threshold")) : <span className="muted">Not stated</span>}</td>
                  <td style={{ textAlign: "right" }}>{num(s, "policies.returns.period_days") !== undefined ? `${num(s, "policies.returns.period_days")} days` : <span className="muted">Not stated</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
