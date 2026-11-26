import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPromotions, getSites } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Industries we cover",
  description: "Ledger covers Australian online stores industry by industry, so every comparison is like for like: jewellery, fashion, beauty, health, homewares, pet, baby & kids, sports and electronics.",
  alternates: { canonical: "/industries" },
};

export default async function Industries() {
  const [sites, promos] = await Promise.all([getSites(), getPromotions()]);
  const count = (slug: string) => sites.filter((s) => (s.industry || "jewellery") === slug);
  const live = (slug: string) => { const d = new Set(count(slug).map((s) => s.domain)); return promos.filter((p) => d.has(p.domain) && p.live).length; };
  const [jew, ...rest] = INDUSTRIES;
  return (
    <>
      <Header active="/industries" />
      <main className="wrap page">
        <h1 className="title">Industries</h1>
        <p className="lede">We cover Australian online stores industry by industry, so every comparison is like for like. New stores are added every week.</p>
        <Link href="/industries/jewellery" className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "center", marginTop: 28, background: "var(--dark)", color: "#F6F5F1", border: 0, padding: 28, textDecoration: "none" }}>
          <div>
            <span className="tag" style={{ background: "#5FD3C4", color: "#15171C" }}>FULL COVERAGE</span>
            <div className="display" style={{ fontSize: 32, fontWeight: 600, marginTop: 12 }}>{jew.name}</div>
            <div style={{ fontSize: 15, color: "#C9CCD3", marginTop: 6 }}>{jew.why} Weekly feed, benchmarks, explore lists and promotions calendar.</div>
          </div>
          <div className="row" style={{ gap: 32 }}>
            <div><div className="display" style={{ fontSize: 32, fontWeight: 600 }}>{count("jewellery").length}</div><div className="small" style={{ color: "#C9CCD3" }}>sites tracked</div></div>
            <div><div className="display" style={{ fontSize: 32, fontWeight: 600 }}>{live("jewellery")}</div><div className="small" style={{ color: "#C9CCD3" }}>promotions live</div></div>
            <div style={{ alignSelf: "center", fontWeight: 600, color: "#5FD3C4" }}>Open →</div>
          </div>
        </Link>
        <h2 style={{ margin: "40px 0 14px", fontSize: 24 }}>Growing coverage</h2>
        <div className="grid g4">
          {rest.map((i) => {
            const n = count(i.slug).length;
            return (
              <Link key={i.slug} href={`/industries/${i.slug}`} className="card" style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--ink)", textDecoration: "none" }}>
                <span className={`tag${n ? "" : " grey"}`} style={{ alignSelf: "flex-start" }}>{n ? `${n} SITES` : "ADDING SITES"}</span>
                <div className="display" style={{ fontSize: 20, fontWeight: 600 }}>{i.name}</div>
                <div className="small muted" style={{ flex: "1 1 auto", lineHeight: 1.5 }}>{i.why}</div>
                <span className="small" style={{ fontWeight: 600, color: "var(--accent)" }}>{n ? `See ${n} sites →` : "First scans under way →"}</span>
              </Link>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 24 }}>Want an industry that isn't listed? <Link href="/contact" style={{ fontWeight: 600 }}>Tell us</Link>, or suggest a store below.</p>
      </main>
    </>
  );
}
