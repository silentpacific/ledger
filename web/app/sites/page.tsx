import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getSites } from "@/lib/data";
import { dateAU, list, money, num, siteName, val } from "@/lib/format";
import { INDUSTRIES, industryName } from "@/lib/industries";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Australian online stores we track",
  description: "Every Australian jewellery store Ledger tracks, with returns, shipping, buy now pay later and loyalty at a glance.",
  alternates: { canonical: "/sites" },
};

export default async function Sites({ searchParams }: { searchParams: Promise<{ segment?: string; industry?: string }> }) {
  const { segment, industry } = await searchParams;
  const every = (await getSites()).sort((a, b) => siteName(a).localeCompare(siteName(b)));
  const all = industry ? every.filter((s) => (s.industry || "jewellery") === industry) : every;
  const segs = [...new Set(all.map((s) => s.segment).filter(Boolean))] as string[];
  const sites = segment ? all.filter((s) => s.segment === segment) : all;
  return (
    <>
      <Header active="/sites" />
      <main className="wrap page">
        <div className="eyebrow">Sites{industry ? ` · ${industryName(industry)}` : ""}</div>
        <h1 className="title">Stores we track</h1>
        <p className="lede">{every.length} Australian online stores across {new Set(every.map((s) => s.industry || "jewellery")).size} industries, scanned every week. Open a store for its full profile, change history, promotions and prices.</p>
        <div className="row" style={{ gap: 8, marginTop: 20 }}>
          <Link href="/sites" className={`chip${!industry ? " on" : ""}`}>All industries · {every.length}</Link>
          {INDUSTRIES.map((i) => ({ i, n: every.filter((s) => (s.industry || "jewellery") === i.slug).length })).filter(({ n }) => n > 0)
            .map(({ i, n }) => <Link key={i.slug} href={`/sites?industry=${i.slug}`} className={`chip${industry === i.slug ? " on" : ""}`}>{i.name} · {n}</Link>)}
        </div>
        {segs.length > 1 && (
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            {segs.sort().map((g) => <Link key={g} href={`/sites?${industry ? `industry=${industry}&` : ""}segment=${encodeURIComponent(g)}`} className={`chip${segment === g ? " on" : ""}`}>{g} · {all.filter((s) => s.segment === g).length}</Link>)}
          </div>
        )}
        <div className="card scroll" style={{ padding: 0, marginTop: 20 }}>
          <table className="t" style={{ minWidth: 900 }}>
            <thead><tr><th style={{ paddingLeft: 20 }}>Store</th><th>Industry</th><th>Platform</th><th style={{ textAlign: "right" }}>Free shipping over</th><th style={{ textAlign: "right" }}>Returns</th><th>Buy now, pay later</th><th>Loyalty</th><th>Last scan</th></tr></thead>
            <tbody>
              {sites.map((s) => {
                const fs = num(s, "shipping.free_shipping_threshold");
                const rd = num(s, "policies.returns.period_days");
                const bn = list(s, "payments.bnpl_providers");
                const lp = val(s, "loyalty.program");
                return (
                  <tr key={s.domain}>
                    <td style={{ paddingLeft: 20 }}><Link href={`/sites/${s.domain}`} style={{ fontWeight: 600 }}>{siteName(s)}</Link><div className="tiny muted">{s.domain}</div></td>
                    <td className="muted">{industryName(s.industry)}{s.segment ? ` · ${s.segment}` : ""}</td>
                    <td>{val(s, "tech_stack.platform") || "—"}</td>
                    <td style={{ textAlign: "right" }}>{fs !== undefined ? money(fs) : <span className="muted">Not stated</span>}</td>
                    <td style={{ textAlign: "right" }}>{rd !== undefined ? `${rd} days` : <span className="muted">Not stated</span>}</td>
                    <td>{bn.length ? bn.map((b) => b.replace(/_/g, " ")).map((b) => b.charAt(0).toUpperCase() + b.slice(1)).join(", ") : <span className="muted">Not stated</span>}</td>
                    <td>{typeof lp === "string" ? lp : <span className="muted">—</span>}</td>
                    <td className="muted">{dateAU(s.last_scanned_at, { day: "numeric", month: "short" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>"Not stated" means the store doesn't publish it, not that it isn't offered. Know a store we should add? Use "Suggest a site" below.</p>
      </main>
    </>
  );
}
