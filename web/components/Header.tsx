import Link from "next/link";
import { BRAND } from "@/lib/brand";

// Grouped by what people come to do: look around the market, or analyse it.
const GROUPS = [
  ["Explore", [["/industries", "Industries"], ["/sites", "Stores"], ["/promotions", "Promotions"], ["/payments", "Payments"]]],
  ["Analyse", [["/compare", "Compare"], ["/benchmarks", "Benchmarks"], ["/tech", "Technology"]]],
] as const;

export default function Header({ active }: { active?: string }) {
  return (
    <header style={{ background: "#15171C", color: "#F6F5F1" }}>
      <div className="wrap" style={{ padding: "14px 32px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }}>
        <Link href="/" className="display" aria-label={`${BRAND} home`} style={{ fontWeight: 700, fontSize: 22, color: "#F6F5F1", textDecoration: "none" }}>
          {BRAND}{" "}
          <span style={{ fontFamily: "var(--font-inter)", fontSize: 11, fontWeight: 600, color: "#15171C", background: "#5FD3C4", borderRadius: 4, padding: "2px 6px", verticalAlign: "middle" }}>AU</span>
        </Link>
        <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", gap: 28, fontSize: 14, fontWeight: 500, alignItems: "center" }}>
          {GROUPS.map(([group, links]) => (
            <div key={group} style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#8A8F99" }}>{group}</span>
              {links.map(([href, text]) => (
                <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
                  style={{ color: active === href ? "#fff" : "#C9CCD3", paddingBottom: 4, textDecoration: "none",
                    borderBottom: `2px solid ${active === href ? "#5FD3C4" : "transparent"}` }}>{text}</Link>
              ))}
            </div>
          ))}
        </nav>
        <form action="/search" role="search" style={{ flex: "1 1 220px", display: "flex", justifyContent: "flex-end", margin: 0 }}>
          <label htmlFor="site-search" className="sr">Search</label>
          <input id="site-search" name="q" type="search" placeholder="Search a store, promotion or technology"
            style={{ width: "100%", maxWidth: 300, height: 40, borderRadius: "8px 0 0 8px", border: "1px solid #3A3F4A", borderRight: 0, background: "#23262E", color: "#F6F5F1", padding: "0 14px", fontSize: 14 }} />
          <button type="submit" aria-label="Search" style={{ height: 40, width: 44, border: "1px solid #3A3F4A", borderRadius: "0 8px 8px 0", background: "#2E323C", color: "#F6F5F1", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </button>
        </form>
      </div>
    </header>
  );
}
