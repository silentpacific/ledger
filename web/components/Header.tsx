import Link from "next/link";
import { BRAND } from "@/lib/brand";
import MenuCloser from "./MenuCloser";
import MobileNav from "./MobileNav";
import { COMPANY, INDUSTRY_LINKS, INSIGHTS } from "./nav";

/** Site header (redesign, 28 Nov 2026): white, logo placeholder, three drop-down menus that close on a click outside. */
export default function Header({ active }: { active?: string }) {
  const link = (href: string, text: string) => (
    <Link href={href} aria-current={active === href ? "page" : undefined} className="hd-link">{text}</Link>
  );
  const menu = (name: string, items: [string, string, string?][], wide = true, extra?: React.ReactNode) => (
    <details className="hd-menu">
      <summary className="hd-link">{name}</summary>
      <div className={wide ? "hd-panel" : "hd-panel one"}>
        {items.map(([h, t, d]) => <Link key={h} href={h} className="hd-item"><b>{t}</b>{d && <span>{d}</span>}</Link>)}
        {extra}
      </div>
    </details>
  );
  return (
    <header className="hd">
      <MenuCloser />
      <div className="hd-in">
        <Link href="/" className="hd-logo" aria-label={`${BRAND} home`}>
          <span className="hd-mark" aria-hidden="true">SL</span><span>{BRAND}</span>
        </Link>
        <nav aria-label="Main" className="hd-nav">
          {menu("Industries", INDUSTRY_LINKS, true, <Link href="/industries" className="hd-item hd-all"><b>All industries, side by side</b></Link>)}
          {menu("Insights", INSIGHTS)}
          {link("/compare", "Compare")}
          {link("/pricing", "Pricing")}
          {menu("Company", COMPANY, false)}
        </nav>
        <form action="/search" role="search" className="hd-search">
          <label htmlFor="site-search" className="sr">Search</label>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input id="site-search" name="q" type="search" placeholder="Search stores, tools, payments" />
        </form>
        <MobileNav />
      </div>
    </header>
  );
}
