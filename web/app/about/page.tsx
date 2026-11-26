import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import SuggestSite from "@/components/SuggestSite";

export const metadata: Metadata = {
  title: "About Ledger",
  description: "Ledger is the record of how Australian online stores sell, and how that changes: dated, sourced facts on policies, prices, promotions, payments and tech.",
  alternates: { canonical: "/about" },
};

const C = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <div className="card"><h2 style={{ fontSize: 19, marginBottom: 8 }}>{t}</h2><p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--body)" }}>{children}</p></div>
);

export default function About() {
  return (
    <>
      <Header />
      <main className="narrow page">
        <div className="eyebrow">About us</div>
        <h1 className="title" style={{ fontSize: 48, maxWidth: 820 }}>The record of how Australian online stores sell, and how that changes</h1>
        <p className="prose" style={{ fontSize: 18, maxWidth: 760, marginTop: 18 }}>Ledger tracks the public commercial facts of Australian ecommerce: returns windows, delivery fees, buy now pay later options, loyalty programmes, promotions, prices and the tools behind each store. Every fact is dated and sourced, and every change is kept, so you can see not just what a store does today, but what it did last month and last Black Friday.</p>
        <div className="grid g3" style={{ marginTop: 40 }}>
          <C t="Australian by design">We only cover stores selling to Australian shoppers. Prices are in AUD, policies are read against Australian Consumer Law, and we track the payment options Australians actually use: Afterpay, Zip, Humm, Latitude and more.</C>
          <C t="Facts, not opinions">Every value shows the date it was seen and the words it came from on the store's own site. If a store doesn't say something, we show "Not stated" rather than guessing.</C>
          <C t="History is the point">One look at a website tells you little. Week after week, the changes add up to a picture of how a market competes: who discounts, when, and by how much.</C>
        </div>
        <div className="prose" style={{ maxWidth: 760 }}>
          <h2>Who it's for</h2>
          <ul style={{ paddingLeft: 22 }}>
            <li><strong style={{ color: "var(--ink)" }}>Ecommerce and marketing teams</strong> keeping an eye on competitors' offers, policies and promotions.</li>
            <li><strong style={{ color: "var(--ink)" }}>Agencies</strong> preparing audits, pitches and benchmarks for Australian clients.</li>
            <li><strong style={{ color: "var(--ink)" }}>Payment, app and platform providers</strong> looking for stores that use, or have just dropped, a product like theirs.</li>
          </ul>
          <h2>Our story</h2>
          <p>[Founder story: who started Ledger, the experience behind it in conversion optimisation and analytics, and why this data didn't exist for Australia.]</p>
          <h2>How we work</h2>
          <p>We read public pages only, follow each site's robots.txt, identify our crawler, and stop tracking any site whose owner asks. The full rules are on the <Link href="/methodology">methodology page</Link>.</p>
        </div>
        <div className="card" style={{ marginTop: 40, background: "var(--dark)", color: "#F6F5F1", padding: 28, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "center", border: 0 }}>
          <div style={{ flex: "1 1 300px" }}>
            <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>Know a store we should track?</div>
            <div style={{ fontSize: 15, color: "#C9CCD3", marginTop: 4 }}>We'll check its terms automatically and add it if they allow it.</div>
          </div>
          <div style={{ flex: "1 1 360px" }}><SuggestSite /></div>
        </div>
      </main>
    </>
  );
}
