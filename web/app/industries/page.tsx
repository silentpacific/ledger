import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPromotions, getSites } from "@/lib/data";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Industries we cover",
  description: "Ledger covers Australian online stores one industry at a time, so every comparison is like for like. Jewellery is live; fashion, beauty, health and more are next.",
  alternates: { canonical: "/industries" },
};

const NEXT = [
  ["Fashion & apparel", "The biggest group of Australian DTC stores, with constant promotions and fast-changing returns rules."],
  ["Beauty & skincare", "Heavy use of loyalty programmes, gifts with purchase and subscriptions."],
  ["Health & personal care", "Oral care, supplements and pharmacy-adjacent brands; subscriptions and bundles."],
  ["Homewares & furniture", "High order values: delivery fees, BNPL limits and long returns windows matter most."],
  ["Pet care", "Repeat purchases, autoship discounts and same-day delivery competition."],
  ["Baby & kids", "Price-sensitive shoppers, frequent sales and safety-related policy wording."],
  ["Sports & outdoors", "Seasonal sales, click and collect, and many Shopify brands."],
  ["Consumer electronics", "Price matching, extended warranties and finance offers."],
];

export default async function Industries() {
  const [sites, promos] = await Promise.all([getSites(), getPromotions()]);
  return (
    <>
      <Header active="/industries" />
      <main className="wrap page">
        <h1 className="title">Industries</h1>
        <p className="lede">We cover Australian online stores one industry at a time, so every comparison is like for like. Jewellery is live; these are next.</p>
        <Link href="/" className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "center", marginTop: 28, background: "var(--dark)", color: "#F6F5F1", border: 0, padding: 28, textDecoration: "none" }}>
          <div>
            <span className="tag" style={{ background: "#5FD3C4", color: "#15171C" }}>LIVE</span>
            <div className="display" style={{ fontSize: 32, fontWeight: 600, marginTop: 12 }}>Jewellery</div>
            <div style={{ fontSize: 15, color: "#C9CCD3", marginTop: 6 }}>Chains, demi-fine DTC brands, bridal and designer jewellers</div>
          </div>
          <div className="row" style={{ gap: 32 }}>
            <div><div className="display" style={{ fontSize: 32, fontWeight: 600 }}>{sites.length}</div><div className="small" style={{ color: "#C9CCD3" }}>sites tracked</div></div>
            <div><div className="display" style={{ fontSize: 32, fontWeight: 600 }}>{promos.length}</div><div className="small" style={{ color: "#C9CCD3" }}>promotions recorded</div></div>
            <div style={{ alignSelf: "center", fontWeight: 600, color: "#5FD3C4" }}>Open →</div>
          </div>
        </Link>
        <h2 style={{ margin: "40px 0 14px", fontSize: 24 }}>Coming next</h2>
        <div className="grid g4">
          {NEXT.map(([n, why]) => (
            <div key={n} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="tag grey" style={{ alignSelf: "flex-start" }}>PLANNED</span>
              <div className="display" style={{ fontSize: 20, fontWeight: 600 }}>{n}</div>
              <div className="small muted" style={{ flex: "1 1 auto", lineHeight: 1.5 }}>{why}</div>
              <Link className="btn ghost" style={{ alignSelf: "flex-start", height: 40 }} href={`/contact?topic=industry`}>Notify me</Link>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 24 }}>Want an industry that isn't listed? <Link href="/contact" style={{ fontWeight: 600 }}>Tell us</Link>, or suggest a store below.</p>
      </main>
    </>
  );
}
