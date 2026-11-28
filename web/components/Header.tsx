import Link from "next/link";
import { BRAND } from "@/lib/brand";

const INSIGHTS: [string, string, string][] = [
  ["/payments", "Payments", "Cards, wallets and buy now, pay later"],
  ["/promotions", "Promotions", "Who's on sale, how deep, how long"],
  ["/policies", "Policies", "Returns, warranty and delivery terms"],
  ["/tech", "Technologies", "Apps and tools behind each store"],
  ["/platforms", "Platforms", "Shopify, BigCommerce and the rest"],
  ["/benchmarks", "Benchmarks", "What's normal, with the full spread"],
  ["/changes", "What changed", "Every change, dated"],
];

/** Site header (redesign, 28 Nov 2026): white, logo placeholder, Insights opens a panel of the analysis pages. */
export default function Header({ active }: { active?: string }) {
  const link = (href: string, text: string) => (
    <Link href={href} aria-current={active === href ? "page" : undefined} className="hd-link">{text}</Link>
  );
  return (
    <header className="hd">
      <div className="hd-in">
        <Link href="/" className="hd-logo" aria-label={`${BRAND} home`}>
          <span className="hd-mark" aria-hidden="true">SL</span><span>{BRAND}</span>
        </Link>
        <nav aria-label="Main" className="hd-nav">
          {link("/industries", "Industries")}
          <details className="hd-menu">
            <summary className="hd-link">Insights</summary>
            <div className="hd-panel">
              {INSIGHTS.map(([h, t, d]) => (
                <Link key={h} href={h} className="hd-item"><b>{t}</b><span>{d}</span></Link>
              ))}
            </div>
          </details>
          {link("/compare", "Compare")}
          {link("/pricing", "Pricing")}
          {link("/about", "About")}
        </nav>
        <form action="/search" role="search" className="hd-search">
          <label htmlFor="site-search" className="sr">Search</label>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input id="site-search" name="q" type="search" placeholder="Search stores, tools, payments" />
        </form>
      </div>
    </header>
  );
}
