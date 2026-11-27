import Link from "next/link";
import SuggestSite from "./SuggestSite";
import { BRAND } from "@/lib/brand";

const col = (title: string, links: [string, string][]) => (
  <nav aria-label={title} style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#8F95A1" }}>{title}</div>
    {links.map(([h, t]) => <Link key={h + t} href={h} style={{ color: "#E6E8EC" }}>{t}</Link>)}
  </nav>
);

export default function Footer() {
  return (
    <footer style={{ background: "#15171C", color: "#C9CCD3", fontSize: 14 }}>
      <div className="wrap" style={{ padding: "48px 32px 24px", display: "flex", flexWrap: "wrap", gap: 40 }}>
        <div style={{ flex: "2 1 360px", minWidth: 0 }}>
          <div className="display" style={{ fontWeight: 700, fontSize: 22, color: "#F6F5F1" }}>{BRAND}</div>
          <p style={{ margin: "8px 0 20px", lineHeight: 1.55, maxWidth: 420 }}>Dated, sourced facts on how Australian online stores sell: policies, prices, promotions, payments and the tools behind them, tracked over time.</p>
          <SuggestSite />
        </div>
        {col("Product", [["/", "This week"], ["/industries", "Industries"], ["/explore", "Explore"], ["/compare", "Compare"], ["/benchmarks", "Benchmarks"], ["/promotions", "Promotions calendar"]])}
        {col("Company", [["/about", "About us"], ["/contact", "Contact us"], ["/methodology", "Methodology"]])}
        {col("Site owners & legal", [["/methodology#opt-out", "Opt out of tracking"], ["/contact?topic=wrong-fact", "Report a wrong fact"], ["/methodology#privacy", "Privacy"], ["/methodology#terms", "Terms of use"]])}
      </div>
      <div className="wrap" style={{ padding: "16px 32px 28px", borderTop: "1px solid #2E323C", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", fontSize: 13, color: "#8F95A1" }}>
        <span>© 2026 {BRAND} (working name) · Made in Australia · Covers Australian online stores only</span>
        <span>Facts are observed on public web pages and dated. They are not advice.</span>
      </div>
    </footer>
  );
}
